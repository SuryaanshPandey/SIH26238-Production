import { NextRequest, NextResponse } from "next/server";
import { createSuccessEnvelope, createErrorEnvelope } from "@contracts/v1/envelope";
import { AppError } from "@/shared/errors/AppError";

export function getRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id") || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function handleApiSuccess<T>(data: T, req: NextRequest, status = 200) {
  const requestId = getRequestId(req);
  return NextResponse.json(createSuccessEnvelope(data, requestId), { status });
}

export function handleApiError(err: unknown, req: NextRequest) {
  const requestId = getRequestId(req);

  if (err instanceof AppError) {
    return NextResponse.json(
      createErrorEnvelope(err.code, err.message, err.details, requestId),
      { status: err.statusCode }
    );
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  return NextResponse.json(
    createErrorEnvelope("INTERNAL_ERROR", message, null, requestId),
    { status: 500 }
  );
}
