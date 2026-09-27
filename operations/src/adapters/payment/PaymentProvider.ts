import { PaymentStatus } from "@contracts/v1/types";

export interface PaymentInitiationResult {
  paymentReference: string;
  status: PaymentStatus;
  message: string;
}

export interface PaymentSimulationResult {
  paymentReference: string;
  status: PaymentStatus;
  completedAt?: string | null;
  failureReason?: string | null;
}

export interface PaymentProvider {
  initiatePayment(
    paymentId: string,
    amount: number,
    accountMasked: string,
    ifsc: string
  ): Promise<PaymentInitiationResult>;
  simulatePayment(
    paymentId: string,
    targetStatus: "PROCESSING" | "SUCCESS" | "FAILED" | "RETURNED",
    failureReason?: string
  ): Promise<PaymentSimulationResult>;
  getPaymentStatus(paymentReference: string): Promise<{ status: PaymentStatus; failureReason?: string | null }>;
}
