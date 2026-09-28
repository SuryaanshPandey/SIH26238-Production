import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  addCorsHeaders,
  createCorsPreflightResponse,
} from "@/shared/api/cors";

export function middleware(
  req: NextRequest,
): NextResponse {
  /*
   * Handle CORS preflight before any API route,
   * authentication middleware, or business logic.
   */
  if (req.method === "OPTIONS") {
    return createCorsPreflightResponse(
      req,
    );
  }

  /*
   * Every API response gets CORS headers,
   * including:
   *
   * 200
   * 201
   * 400
   * 401
   * 403
   * 404
   * 409
   * 500
   */
  return addCorsHeaders(
    req,
    NextResponse.next(),
  );
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
