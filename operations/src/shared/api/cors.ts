import { NextRequest, NextResponse } from "next/server";

const METHODS =
  "GET,POST,PATCH,PUT,DELETE,OPTIONS";

const ALLOWED_HEADERS =
  "Content-Type, X-Request-ID, Authorization";

const PRODUCTION_STUDENT_ORIGIN =
  "https://sih26238-student-v25-free.onrender.com";

function normalizeOrigin(
  value: string | null | undefined,
): string {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configured =
    process.env.STUDENT_APP_ORIGIN || "";

  /*
   * Support a single origin or a comma-separated list.
   *
   * This also tolerates accidental trailing slashes.
   */
  configured
    .split(",")
    .map((origin) =>
      normalizeOrigin(origin),
    )
    .filter(Boolean)
    .forEach((origin) =>
      origins.add(origin),
    );

  /*
   * Always allow the production Student App.
   *
   * This prevents a missing/malformed Render environment
   * variable from breaking browser-to-API communication.
   */
  origins.add(
    PRODUCTION_STUDENT_ORIGIN,
  );

  /*
   * Local development support.
   */
  origins.add(
    "http://localhost:3000",
  );

  origins.add(
    "http://127.0.0.1:3000",
  );

  return origins;
}

export function isAllowedOrigin(
  origin: string | null,
): boolean {
  if (!origin) return false;

  return getAllowedOrigins().has(
    normalizeOrigin(origin),
  );
}

export function addCorsHeaders(
  req: NextRequest,
  response: NextResponse,
): NextResponse {
  const origin =
    req.headers.get("origin");

  if (isAllowedOrigin(origin)) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      normalizeOrigin(origin),
    );

    response.headers.set(
      "Access-Control-Allow-Methods",
      METHODS,
    );

    response.headers.set(
      "Access-Control-Allow-Headers",
      ALLOWED_HEADERS,
    );

    response.headers.set(
      "Access-Control-Max-Age",
      "600",
    );

    response.headers.set(
      "Access-Control-Expose-Headers",
      "X-Request-ID",
    );
  }

  response.headers.set(
    "Vary",
    "Origin",
  );

  return response;
}

export function createCorsPreflightResponse(
  req: NextRequest,
): NextResponse {
  const response =
    new NextResponse(null, {
      status: 204,
    });

  return addCorsHeaders(
    req,
    response,
  );
}
