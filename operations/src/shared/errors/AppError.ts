export type ErrorCode =
  | "INVALID_REQUEST"
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "SCHOLARSHIP_NOT_ACTIVE"
  | "APPLICATION_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "ELIGIBILITY_DATA_MISSING"
  | "VERIFICATION_UNAVAILABLE"
  | "VERIFICATION_SERVICE_UNAVAILABLE"
  | "VERIFICATION_MISMATCH"
  | "DEFICIENCY_NOT_FOUND"
  | "REVIEW_NOT_FOUND"
  | "REVIEW_DECISION_INVALID"
  | "SANCTION_NOT_ALLOWED"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "PAYMENT_ALREADY_COMPLETED"
  | "DUPLICATE_OPERATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_STATE"
  | "SOURCE_UNAVAILABLE"
  | "CONSENT_REQUIRED";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | null;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static invalidRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("INVALID_REQUEST", message, 400, details);
  }

  static notFound(resource: string, id: string): AppError {
    return new AppError(
      "RESOURCE_NOT_FOUND",
      `${resource} with ID '${id}' was not found.`,
      404,
      { resource, id }
    );
  }

  static invalidStateTransition(
    currentStatus: string,
    requestedStatus: string,
    allowedTransitions: string[]
  ): AppError {
    return new AppError(
      "INVALID_STATE_TRANSITION",
      `Cannot transition application from '${currentStatus}' to '${requestedStatus}'. Allowed transitions are: [${allowedTransitions.join(", ")}].`,
      422,
      { currentStatus, requestedStatus, allowedTransitions }
    );
  }

  static sanctionNotAllowed(reason: string): AppError {
    return new AppError("SANCTION_NOT_ALLOWED", `Sanction cannot be issued: ${reason}`, 422);
  }

  static duplicateOperation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("DUPLICATE_OPERATION", message, 409, details);
  }

  /**
   * HTTP 409 helper. Registration and other idempotency-sensitive flows use
   * this when a requested resource already exists. We keep the shared error
   * contract code as DUPLICATE_OPERATION for backwards compatibility.
   */
  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("DUPLICATE_OPERATION", message, 409, details);
  }

  /** HTTP 401 helper used by authentication services. */
  static unauthorized(message = "Authentication is required.", details?: Record<string, unknown>): AppError {
    return new AppError("UNAUTHORIZED", message, 401, details);
  }

  static upstreamUnavailable(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("UPSTREAM_UNAVAILABLE", message, 503, details);
  }

  static internal(message = "An internal server error occurred."): AppError {
    return new AppError("INTERNAL_ERROR", message, 500);
  }
}
