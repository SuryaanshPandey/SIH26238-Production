import { prisma } from "@/lib/prisma";
import { SanctionContract, SanctionStatus } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { auditService } from "@/modules/audit/AuditService";
import { notificationService } from "@/modules/notifications/NotificationService";
import { ApplicationStateMachine } from "@/modules/applications/ApplicationStateMachine";

export class SanctionService {
  async issueSanction(
    applicationId: string,
    authorizedAmount?: number,
    actorId = "OFFICER_SANCTION_DESK"
  ): Promise<SanctionContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
      include: { scholarship: true, sanction: true },
    });

    if (!app) {
      throw AppError.notFound("Application", applicationId);
    }

    if (app.status !== "VERIFIED") {
      throw AppError.sanctionNotAllowed(
        `Application must be in 'VERIFIED' status before sanctioning. Current status is '${app.status}'.`
      );
    }

    if (app.sanction && (app.sanction.status === "ISSUED" || app.sanction.status === "APPROVED")) {
      throw AppError.duplicateOperation(
        `Sanction order '${app.sanction.reference}' has already been issued for this application.`
      );
    }

    // Determine amount from scheme benefit summary
    let amount = authorizedAmount || 0;
    if (!amount) {
      try {
        const benefit = JSON.parse(app.scholarship.benefitSummary);
        amount = Number(benefit.maximum_amount) || 52400;
      } catch {
        amount = 52400;
      }
    }

    const sanctionId = `sanc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reference = `SANCTION-MTA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const sanctionRecord = await prisma.sanction.upsert({
      where: { applicationId },
      create: {
        sanctionId,
        applicationId,
        status: "ISSUED",
        amount,
        currency: "INR",
        reference,
        sanctionedAt: now,
      },
      update: {
        status: "ISSUED",
        amount,
        reference,
        sanctionedAt: now,
      },
    });

    // Update application state
    ApplicationStateMachine.validateTransition(app.status as any, "SANCTIONED");
    await prisma.application.update({
      where: { applicationId },
      data: {
        status: "SANCTIONED",
        currentStage: "SANCTION_ISSUED",
        statusHistory: {
          create: {
            fromStatus: app.status,
            toStatus: "SANCTIONED",
            actorType: "MINISTRY",
            actorId,
            reason: `Sanction Order Issued: ${reference} for ₹${amount.toLocaleString("en-IN")}`,
            correlationId: `corr_sanc_${Date.now()}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "MINISTRY",
      actorId,
      action: "SANCTION_ISSUED",
      entityType: "SANCTION",
      entityId: sanctionRecord.sanctionId,
      reason: `Sanction of ₹${amount} issued under reference ${reference}.`,
      payload: { applicationId, amount, reference },
    });

    await notificationService.dispatch({
      studentId: app.studentId,
      applicationId: app.applicationId,
      type: "SANCTIONED",
      title: "Scholarship Sanction Order Issued!",
      message: `Your scholarship under ${app.scholarship.schemeName} has been sanctioned in the application workflow for ₹${amount.toLocaleString("en-IN")} (Ref: ${reference}).`,
      priority: "HIGH",
      channel: "IN_APP",
    });

    return {
      sanction_id: sanctionRecord.sanctionId,
      application_id: sanctionRecord.applicationId,
      status: sanctionRecord.status as SanctionStatus,
      amount: sanctionRecord.amount,
      currency: "INR",
      reference: sanctionRecord.reference,
      sanctioned_at: sanctionRecord.sanctionedAt ? sanctionRecord.sanctionedAt.toISOString() : null,
      created_at: sanctionRecord.createdAt.toISOString(),
      updated_at: sanctionRecord.updatedAt.toISOString(),
    };
  }

  async getSanctionByApplication(applicationId: string): Promise<SanctionContract | null> {
    const record = await prisma.sanction.findUnique({
      where: { applicationId },
    });
    if (!record) return null;

    return {
      sanction_id: record.sanctionId,
      application_id: record.applicationId,
      status: record.status as SanctionStatus,
      amount: record.amount,
      currency: "INR",
      reference: record.reference,
      sanctioned_at: record.sanctionedAt ? record.sanctionedAt.toISOString() : null,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }
}

export const sanctionService = new SanctionService();
