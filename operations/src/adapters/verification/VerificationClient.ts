import { DocumentContract, StudentContract, VerificationContract } from "@contracts/v1/types";

export interface VerificationRunContext {
  student: StudentContract;
  documents: DocumentContract[];
}

export interface VerificationSummary {
  isFullyVerified: boolean;
  hasMismatch: boolean;
  hasSourceUnavailable: boolean;
  matchesCount: number;
  mismatchesCount: number;
  sourceUnavailableCount: number;
  pendingReviewCount: number;
  verifications: VerificationContract[];
}

export interface VerificationClient {
  getVerificationByApplication(applicationId: string): Promise<VerificationContract[]>;
  getVerificationSummary(applicationId: string): Promise<VerificationSummary>;
  getVerificationByAttribute(applicationId: string, attribute: string): Promise<VerificationContract | null>;
  simulateVerification(
    applicationId: string,
    scenario?: "MATCH" | "MISMATCH" | "SOURCE_UNAVAILABLE" | "PARTIAL_MATCH",
    context?: VerificationRunContext
  ): Promise<VerificationContract[]>;
}
