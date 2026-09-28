import { NextRequest, NextResponse } from "next/server";

const ALLOWED_METHODS =
  "GET,POST,PATCH,PUT,DELETE,OPTIONS";

const DEFAULT_ALLOWED_HEADERS = [
  "Accept",
  "Content-Type",
  "Authorization",
  "X-Request-ID",
  "X-Requested-With",
  "X-Student-ID",
  "X-Contract-Version",
];

const PRODUCTION_STUDENT_ORIGIN =
  "https://sih26238-student-v25-free.onrender.com";

const LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

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

  configured
    .split(",")
    .map((origin) =>
      normalizeOrigin(origin),
    )
    .filter(Boolean)
    .forEach((origin) =>
      origins.add(origin),
    );

  origins.add(
    PRODUCTION_STUDENT_ORIGIN,
  );

  for (const origin of LOCAL_ORIGINS) {
    origins.add(origin);
  }

  return origins;
}

export function isAllowedOrigin(
  origin: string | null,
): boolean {
  if (!origin) {
    return false;
  }

  return getAllowedOrigins().has(
    normalizeOrigin(origin),
  );
}

function getAllowedHeaders(
  req: NextRequest,
): string {
  const requestedHeaders =
    req.headers.get(
      "access-control-request-headers",
    );

  if (!requestedHeaders) {
    return DEFAULT_ALLOWED_HEADERS.join(
      ", ",
    );
  }

  const requested = requestedHeaders
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);

  const merged = new Set<string>(
    DEFAULT_ALLOWED_HEADERS,
  );

  for (const header of requested) {
    merged.add(header);
  }

  return Array.from(merged).join(
    ", ",
  );
}

function getRequestedMethod(
  req: NextRequest,
): string {
  const requestedMethod =
    req.headers.get(
      "access-control-request-method",
    );

  if (!requestedMethod) {
    return ALLOWED_METHODS;
  }

  const method =
    requestedMethod
      .trim()
      .toUpperCase();

  if (
    [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ].includes(method)
  ) {
    return ALLOWED_METHODS;
  }

  return ALLOWED_METHODS;
}

export function addCorsHeaders(
  req: NextRequest,
  response: NextResponse,
): NextResponse {
  const origin =
    normalizeOrigin(
      req.headers.get("origin"),
    );

  /*
   * Only grant browser CORS access to explicitly
   * allowed frontend origins.
   */
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      origin,
    );

    response.headers.set(
      "Access-Control-Allow-Methods",
      getRequestedMethod(req),
    );

    response.headers.set(
      "Access-Control-Allow-Headers",
      getAllowedHeaders(req),
    );

    /*
     * The application authenticates using Authorization
     * headers rather than relying exclusively on cookies.
     * Keeping this enabled also permits future authenticated
     * browser requests that use credentials.
     */
    response.headers.set(
      "Access-Control-Allow-Credentials",
      "true",
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

  /*
   * Tell caches/CDNs that the response varies according
   * to the requesting browser origin.
   */
  response.headers.set(
    "Vary",
    "Origin",
  );

  return response;
}

export function createCorsPreflightResponse(
  req: NextRequest,
): NextResponse {
  const origin =
    normalizeOrigin(
      req.headers.get("origin"),
    );

  /*
   * Reject unknown browser origins at the preflight layer.
   * Browsers will block the actual request in that case.
   */
  if (
    origin &&
    !isAllowedOrigin(origin)
  ) {
    const response =
      new NextResponse(null, {
        status: 403,
      });

    response.headers.set(
      "Vary",
      "Origin",
    );

    return response;
  }

  const response =
    new NextResponse(null, {
      status: 204,
    });

  return addCorsHeaders(
    req,
    response,
  );
}
