import { NextRequest, NextResponse } from "next/server";
import {
  addCorsHeaders,
  createCorsPreflightResponse,
} from "@/shared/api/cors";

export function middleware(
  req: NextRequest,
) {
  /*
   * Browser CORS preflight.
   *
   * Handle this explicitly before the request
   * reaches authentication/business logic.
   */
  if (req.method === "OPTIONS") {
    return createCorsPreflightResponse(
      req,
    );
  }

  /*
   * Add CORS headers to every API response.
   *
   * This includes successful responses and
   * error responses such as 401/403/404.
   */
  return addCorsHeaders(
    req,
    NextResponse.next(),
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
