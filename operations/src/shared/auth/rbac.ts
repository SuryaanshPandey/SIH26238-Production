import { NextRequest } from "next/server";
import { verifyToken, TokenPayload, UserRole, mintDemoToken } from "./jwt";
import { AppError } from "@/shared/errors/AppError";

export interface AuthenticatedUser extends TokenPayload {
  isAuthenticated: boolean;
}

export function extractAuthToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Support demo cookie or custom header in local development
  const demoRole = req.headers.get("x-demo-role") as UserRole | null;
  const demoUser = req.headers.get("x-demo-user-id");
  if (process.env.DEMO_MODE === "true" && demoRole) {
    return mintDemoToken(demoRole, demoUser || undefined);
  }

  return null;
}

export function authenticate(req: NextRequest): AuthenticatedUser {
  const token = extractAuthToken(req);
  if (!token) {
    // In demo mode without headers, default to ADMIN for browser UI unless strict auth is requested
    const isStrict = req.headers.get("x-strict-auth") === "true";
    if (process.env.DEMO_MODE === "true" && !isStrict) {
      return {
        sub: "user_admin_default",
        role: "ADMIN",
        email: "admin@tribal.gov.in",
        name: "Desk Officer / Administrator",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        isAuthenticated: true,
      };
    }
    throw new AppError("UNAUTHORIZED", "Missing authentication credentials. Bearer token is required.", 401);
  }

  const payload = verifyToken(token);
  return {
    ...payload,
    isAuthenticated: true,
  };
}

export function authorize(user: AuthenticatedUser, allowedRoles: UserRole[]): void {
  // SUPER_ADMIN has universal clearance
  if (user.role === "SUPER_ADMIN") {
    return;
  }

  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      "FORBIDDEN",
      `Access denied. Role '${user.role}' does not have sufficient permissions for this operation. Required: [${allowedRoles.join(", ")}].`,
      403,
      { userRole: user.role, requiredRoles: allowedRoles }
    );
  }
}

export function authenticateAndAuthorize(req: NextRequest, allowedRoles: UserRole[]): AuthenticatedUser {
  const user = authenticate(req);
  authorize(user, allowedRoles);
  return user;
}
