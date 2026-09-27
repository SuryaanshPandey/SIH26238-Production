/**
 * Common Data Contract v1 - Standard API Envelope
 * All cross-module API responses must be wrapped in this envelope.
 */

export interface ApiMetaContract {
  contract_version: "v1";
  request_id: string;
  timestamp: string; // ISO-8601 UTC
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiResponseEnvelope<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiMetaContract;
}

export interface ApiErrorEnvelope {
  success: false;
  data: null;
  error: ApiErrorDetail;
  meta: ApiMetaContract;
}

export type ApiResponse<T> = ApiResponseEnvelope<T> | ApiErrorEnvelope;

export function createSuccessEnvelope<T>(data: T, requestId?: string): ApiResponseEnvelope<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      contract_version: "v1",
      request_id: requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createErrorEnvelope(
  code: string,
  message: string,
  details?: Record<string, unknown> | null,
  requestId?: string
): ApiErrorEnvelope {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      contract_version: "v1",
      request_id: requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    },
  };
}
