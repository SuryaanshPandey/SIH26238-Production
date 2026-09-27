import { PaymentProvider, PaymentInitiationResult, PaymentSimulationResult } from "./PaymentProvider";
import { PaymentStatus } from "@contracts/v1/types";

export class MockPFMSClient implements PaymentProvider {
  private transactions: Map<
    string,
    { status: PaymentStatus; failureReason?: string | null; completedAt?: string | null }
  > = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.transactions.set("PFMS-TXN-2026-8841", {
      status: "SUCCESS",
      completedAt: "2026-09-25T11:00:00Z",
    });
    this.transactions.set("PFMS-TXN-2026-9901", {
      status: "PROCESSING",
    });
    this.transactions.set("PFMS-TXN-2026-7712", {
      status: "FAILED",
      failureReason: "BENEFICIARY_ACCOUNT_INACTIVE_OR_INVALID_IFSC",
      completedAt: "2026-09-24T15:05:00Z",
    });
  }

  async initiatePayment(
    paymentId: string,
    amount: number,
    accountMasked: string,
    ifsc: string
  ): Promise<PaymentInitiationResult> {
    const reference = `PFMS-TXN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    this.transactions.set(reference, {
      status: "PROCESSING",
    });

    return {
      paymentReference: reference,
      status: "PROCESSING",
      message: `DBT payment dispatched to PFMS gateway for Account ${accountMasked} (IFSC: ${ifsc}).`,
    };
  }

  async simulatePayment(
    paymentId: string,
    targetStatus: "PROCESSING" | "SUCCESS" | "FAILED" | "RETURNED",
    failureReason?: string
  ): Promise<PaymentSimulationResult> {
    const reference = `PFMS-TXN-SIM-${paymentId}`;
    const now = new Date().toISOString();

    const record = {
      status: targetStatus as PaymentStatus,
      completedAt: targetStatus === "SUCCESS" || targetStatus === "FAILED" || targetStatus === "RETURNED" ? now : null,
      failureReason: targetStatus === "FAILED" || targetStatus === "RETURNED" ? (failureReason || "TRANSACTION_SETTLEMENT_ERROR") : null,
    };

    this.transactions.set(reference, record);

    return {
      paymentReference: reference,
      status: record.status,
      completedAt: record.completedAt,
      failureReason: record.failureReason,
    };
  }

  async getPaymentStatus(
    paymentReference: string
  ): Promise<{ status: PaymentStatus; failureReason?: string | null }> {
    const record = this.transactions.get(paymentReference);
    if (!record) {
      return { status: "UNKNOWN" };
    }
    return {
      status: record.status,
      failureReason: record.failureReason,
    };
  }
}

export const mockPFMSClient = new MockPFMSClient();
