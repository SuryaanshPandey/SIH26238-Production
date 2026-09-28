import {
  NextRequest,
  NextResponse,
} from "next/server";

const METHODS =
  "GET, POST, PATCH, PUT, DELETE, OPTIONS";

const DEFAULT_HEADERS = [
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
    .map(normalizeOrigin)
    .filter(Boolean)
    .forEach((origin) => {
      origins.add(origin);
    });

  /*
   * Production Student frontend.
   *
   * Keep this hard-coded as a safety fallback so a missing
   * Render environment variable cannot break production CORS.
   */
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

function getRequestedHeaders(
  req: NextRequest,
): string {
  const requested =
    req.headers.get(
      "access-control-request-headers",
    );

  if (!requested) {
    return DEFAULT_HEADERS.join(", ");
  }

  const merged = new Set<string>(
    DEFAULT_HEADERS,
  );

  requested
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      merged.add(value);
    });

  return Array.from(merged).join(", ");
}

export function addCorsHeaders(
  req: NextRequest,
  response: NextResponse,
): NextResponse {
  const origin = normalizeOrigin(
    req.headers.get("origin"),
  );

  if (
    origin &&
    isAllowedOrigin(origin)
  ) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      origin,
    );

    response.headers.set(
      "Access-Control-Allow-Methods",
      METHODS,
    );

    response.headers.set(
      "Access-Control-Allow-Headers",
      getRequestedHeaders(req),
    );

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

  response.headers.set(
    "Vary",
    "Origin",
  );

  return response;
}

export function createCorsPreflightResponse(
  req: NextRequest,
): NextResponse {
  const origin = normalizeOrigin(
    req.headers.get("origin"),
  );

  /*
   * Requests without an Origin header are not browser CORS
   * requests. Let them receive an ordinary empty response.
   */
  if (!origin) {
    return new NextResponse(null, {
      status: 204,
    });
  }

  /*
   * Explicitly reject untrusted browser origins.
   */
  if (!isAllowedOrigin(origin)) {
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

  response.headers.set(
    "Access-Control-Allow-Origin",
    origin,
  );

  response.headers.set(
    "Access-Control-Allow-Methods",
    METHODS,
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    getRequestedHeaders(req),
  );

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

  response.headers.set(
    "Vary",
    "Origin",
  );

  return response;
}
