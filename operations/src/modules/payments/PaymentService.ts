import { prisma } from "@/lib/prisma";
import { PaymentContract, PaymentStatus } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { MockPFMSClient } from "@/adapters/payment/MockPFMSClient";
import { databaseStudentClient } from "@/adapters/student/DatabaseStudentClient";
import { auditService } from "@/modules/audit/AuditService";
import { notificationService } from "@/modules/notifications/NotificationService";
import { ApplicationStateMachine } from "@/modules/applications/ApplicationStateMachine";

export interface InitiatePaymentParams {
  applicationId: string;
  actorId?: string;
}

export interface PaymentWebhookPayload {
  paymentReference: string;
  status: PaymentStatus;
  failureReason?: string | null;
  idempotencyKey: string;
}

export class PaymentService {
  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId: params.applicationId },
      include: { sanction: true, payment: true, scholarship: true },
    });

    if (!app) {
      throw AppError.notFound("Application", params.applicationId);
    }

    if (app.status !== "SANCTIONED" && app.status !== "PAYMENT_PROCESSING") {
      throw AppError.invalidRequest(
        `Payment can only be initiated for applications in 'SANCTIONED' status. Current status is '${app.status}'.`
      );
    }

    if (app.payment && app.payment.status === "SUCCESS") {
      throw AppError.duplicateOperation("Payment for this application has already been successfully disbursed.");
    }

    if (!app.sanction || app.sanction.status !== "ISSUED") {
      throw AppError.invalidRequest("No active sanction order found. Please issue sanction before initiating payment.");
    }

    const student = await databaseStudentClient.getStudentById(app.studentId);
    if (!student) throw AppError.notFound("Student", app.studentId);
    const bankAccount = student.bank_account_masked;
    const ifsc = student.bank_ifsc;
    if (!bankAccount || bankAccount === "NOT_AVAILABLE" || !ifsc) {
      throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "Verified beneficiary bank details are not available for this student. Payment cannot be initiated safely.", 503);
    }

    const paymentId = app.payment?.paymentId || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (process.env.REAL_DATA_MODE !== "false") {
      throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "PFMS DBT live provider is not configured for this deployment. No simulated payment was created.", 503);
    }
    const initResult = await new MockPFMSClient().initiatePayment(paymentId, app.sanction.amount, bankAccount, ifsc);

    const now = new Date();
    const paymentRecord = await prisma.payment.upsert({
      where: { applicationId: params.applicationId },
      create: {
        paymentId,
        applicationId: params.applicationId,
        status: "PROCESSING",
        amount: app.sanction.amount,
        currency: "INR",
        paymentReference: initResult.paymentReference,
        initiatedAt: now,
        source: "PFMS_DBT",
      },
      update: {
        status: "PROCESSING",
        paymentReference: initResult.paymentReference,
        initiatedAt: now,
        failureReason: null,
      },
    });

    // Log payment event
    await prisma.paymentEvent.create({
      data: {
        paymentId: paymentRecord.paymentId,
        eventType: "INITIATED",
        payload: JSON.stringify(initResult),
        idempotencyKey: `init_${paymentRecord.paymentId}_${Date.now()}`,
        status: "PROCESSING",
      },
    });

    // Update application lifecycle status to PAYMENT_PROCESSING
    if (app.status === "SANCTIONED") {
      ApplicationStateMachine.validateTransition("SANCTIONED", "PAYMENT_PROCESSING");
      await prisma.application.update({
        where: { applicationId: params.applicationId },
        data: {
          status: "PAYMENT_PROCESSING",
          currentStage: "PFMS_DBT_DISBURSEMENT",
          statusHistory: {
            create: {
              fromStatus: "SANCTIONED",
              toStatus: "PAYMENT_PROCESSING",
              actorType: "SYSTEM",
              actorId: params.actorId || "PFMS_ADAPTER",
              reason: `Disbursement batch dispatched to PFMS DBT Gateway (Ref: ${initResult.paymentReference})`,
              correlationId: `corr_pay_${Date.now()}`,
            },
          },
        },
      });
    }

    await auditService.log({
      actorType: "SYSTEM",
      actorId: params.actorId || "PFMS_ADAPTER",
      action: "PAYMENT_INITIATED",
      entityType: "PAYMENT",
      entityId: paymentRecord.paymentId,
      reason: `PFMS DBT payment initiated for ₹${paymentRecord.amount}`,
      payload: { applicationId: params.applicationId, reference: initResult.paymentReference },
    });

    return this.mapToContract(paymentRecord);
  }

  async handleWebhook(payload: PaymentWebhookPayload): Promise<{ processed: boolean; message: string }> {
    // Check idempotency
    const existingEvent = await prisma.paymentEvent.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
    });
    if (existingEvent) {
      return { processed: true, message: "Duplicate event acknowledged (idempotent no-op)." };
    }

    const payment = await prisma.payment.findUnique({
      where: { paymentReference: payload.paymentReference },
      include: { application: true },
    });

    if (!payment) {
      throw AppError.notFound("Payment with reference", payload.paymentReference);
    }

    // Do not downgrade a SUCCESS payment if a stale failure callback arrives
    if (payment.status === "SUCCESS" && payload.status !== "SUCCESS") {
      return { processed: false, message: "Ignored stale callback: payment already marked SUCCESS." };
    }

    const now = new Date();
    const updatedPayment = await prisma.payment.update({
      where: { paymentReference: payload.paymentReference },
      data: {
        status: payload.status,
        completedAt: payload.status === "SUCCESS" || payload.status === "FAILED" || payload.status === "RETURNED" ? now : null,
        failureReason: payload.failureReason || null,
      },
    });

    // Record idempotent event
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.paymentId,
        eventType: `${payload.status}_CALLBACK`,
        payload: JSON.stringify(payload),
        idempotencyKey: payload.idempotencyKey,
        status: payload.status,
      },
    });

    // If payment succeeded, transition application to PAID
    if (payload.status === "SUCCESS") {
      if (ApplicationStateMachine.canTransition(payment.application.status as any, "PAID")) {
        await prisma.application.update({
          where: { applicationId: payment.applicationId },
          data: {
            status: "PAID",
            currentStage: "DISBURSED_TO_ACCOUNT",
            statusHistory: {
              create: {
                fromStatus: payment.application.status,
                toStatus: "PAID",
                actorType: "SYSTEM",
                actorId: "PFMS_CALLBACK_SERVICE",
                reason: `PFMS DBT successfully credited ₹${payment.amount} to beneficiary bank account.`,
                correlationId: `corr_pfms_${Date.now()}`,
              },
            },
          },
        });

        await notificationService.dispatch({
          studentId: payment.application.studentId,
          applicationId: payment.applicationId,
          type: "PAYMENT_UPDATED",
          title: "Scholarship Disbursed to Bank Account!",
          message: `₹${payment.amount.toLocaleString("en-IN")} has been credited directly to your bank account via PFMS DBT.`,
          priority: "HIGH",
          channel: "IN_APP",
        });
      }
    } else if (payload.status === "FAILED" || payload.status === "RETURNED") {
      await notificationService.dispatch({
        studentId: payment.application.studentId,
        applicationId: payment.applicationId,
        type: "PAYMENT_UPDATED",
        title: "Payment Transfer Notice",
        message: `DBT transfer could not be completed (${payload.failureReason || "Account validation error"}). Our finance desk will retry.`,
        priority: "HIGH",
        channel: "IN_APP",
      });
    }

    await auditService.log({
      actorType: "SYSTEM",
      actorId: "PFMS_CALLBACK_HANDLER",
      action: `PAYMENT_STATUS_${payload.status}`,
      entityType: "PAYMENT",
      entityId: payment.paymentId,
      reason: payload.failureReason || `Status updated to ${payload.status}`,
      payload: { reference: payload.paymentReference, status: payload.status },
    });

    return { processed: true, message: `Payment status updated to ${payload.status}` };
  }

  async simulatePayment(
    paymentId: string,
    targetStatus: "PROCESSING" | "SUCCESS" | "FAILED" | "RETURNED",
    failureReason?: string
  ): Promise<PaymentContract> {
    if (process.env.REAL_DATA_MODE !== "false") {
      throw new AppError(
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "PFMS DBT simulation is disabled in real-data mode. Await an authorized provider callback.",
        503
      );
    }
    const payment = await prisma.payment.findUnique({
      where: { paymentId },
    });
    if (!payment) {
      throw AppError.notFound("Payment", paymentId);
    }

    const idempotencyKey = `sim_${paymentId}_${targetStatus}_${Date.now()}`;
    await this.handleWebhook({
      paymentReference: payment.paymentReference,
      status: targetStatus,
      failureReason,
      idempotencyKey,
    });

    const refreshed = await prisma.payment.findUnique({ where: { paymentId } });
    return this.mapToContract(refreshed!);
  }

  async getPaymentByApplication(applicationId: string): Promise<PaymentContract | null> {
    const record = await prisma.payment.findUnique({
      where: { applicationId },
    });
    return record ? this.mapToContract(record) : null;
  }

  private mapToContract(record: {
    paymentId: string;
    applicationId: string;
    status: string;
    amount: number;
    currency: string;
    paymentReference: string;
    initiatedAt: Date | null;
    completedAt: Date | null;
    failureReason: string | null;
    source: string;
  }): PaymentContract {
    return {
      payment_id: record.paymentId,
      application_id: record.applicationId,
      status: record.status as PaymentStatus,
      amount: record.amount,
      currency: "INR",
      payment_reference: record.paymentReference,
      initiated_at: record.initiatedAt ? record.initiatedAt.toISOString() : null,
      completed_at: record.completedAt ? record.completedAt.toISOString() : null,
      failure_reason: record.failureReason,
      source: record.source as any,
    };
  }
}

export const paymentService = new PaymentService();
