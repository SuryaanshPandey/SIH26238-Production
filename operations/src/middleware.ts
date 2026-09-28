import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  addCorsHeaders,
  createCorsPreflightResponse,
} from "@/shared/api/cors";

export default function middleware(
  req: NextRequest,
): NextResponse {
  /*
   * CORS preflight must be handled before the request
   * reaches an API route.
   */
  if (req.method === "OPTIONS") {
    return createCorsPreflightResponse(req);
  }

  /*
   * Add CORS headers to every API response,
   * including error responses.
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
