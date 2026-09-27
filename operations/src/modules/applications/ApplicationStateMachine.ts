import { ApplicationStatus } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";

export class ApplicationStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    DRAFT: ["SUBMITTED", "WITHDRAWN", "CANCELLED"],
    SUBMITTED: ["UNDER_VERIFICATION", "WITHDRAWN", "CANCELLED"],
    UNDER_VERIFICATION: [
      "VERIFIED",
      "UNDER_REVIEW",
      "ACTION_REQUIRED",
      "REJECTED",
      "WITHDRAWN",
      "CANCELLED",
    ],
    ACTION_REQUIRED: [
      "UNDER_VERIFICATION",
      "UNDER_REVIEW",
      "REJECTED",
      "WITHDRAWN",
      "CANCELLED",
    ],
    UNDER_REVIEW: [
      "VERIFIED",
      "ACTION_REQUIRED",
      "REJECTED",
      "WITHDRAWN",
      "CANCELLED",
    ],
    VERIFIED: ["SANCTIONED", "UNDER_REVIEW", "CANCELLED"],
    SANCTIONED: ["PAYMENT_PROCESSING", "CANCELLED"],
    PAYMENT_PROCESSING: ["PAID", "SANCTIONED", "CANCELLED"],
    PAID: [], // Terminal
    REJECTED: [], // Terminal
    WITHDRAWN: [], // Terminal
    CANCELLED: [], // Terminal
  };

  public static canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  public static validateTransition(from: ApplicationStatus, to: ApplicationStatus): void {
    if (!this.canTransition(from, to)) {
      const allowed = this.VALID_TRANSITIONS[from] || [];
      throw AppError.invalidStateTransition(from, to, allowed);
    }
  }

  public static getAllowedNextStates(from: ApplicationStatus): ApplicationStatus[] {
    return this.VALID_TRANSITIONS[from] || [];
  }

  public static isTerminal(status: ApplicationStatus): boolean {
    return ["PAID", "REJECTED", "WITHDRAWN", "CANCELLED"].includes(status);
  }
}
