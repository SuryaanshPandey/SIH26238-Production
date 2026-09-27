import { NextRequest, NextResponse } from "next/server";

const publicPaths = new Set(["/", "/login", "/register"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  const token = request.cookies.get("sih26238_session")?.value;
  if (!token) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/scholarships/:path*", "/eligibility/:path*", "/applications/:path*", "/documents/:path*", "/notifications/:path*", "/actions/:path*", "/jago/:path*"],
};
