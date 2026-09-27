import { NextRequest, NextResponse } from "next/server";

const methods = "GET,POST,PATCH,PUT,DELETE,OPTIONS";

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = process.env.STUDENT_APP_ORIGIN || "http://localhost:3000";
  const response = req.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  if (origin === allowed) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID, Authorization");
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}

export const config = { matcher: ["/api/:path*"] };
