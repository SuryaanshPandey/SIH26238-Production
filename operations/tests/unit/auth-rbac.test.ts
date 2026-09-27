import { describe, it, expect } from "vitest";
import { signToken, verifyToken, mintDemoToken } from "@/shared/auth/jwt";
import { authorize, AuthenticatedUser } from "@/shared/auth/rbac";
import { AppError } from "@/shared/errors/AppError";

describe("Authentication & RBAC Enforcement Test Suite", () => {
  it("generates and verifies valid JWT tokens with role claims", () => {
    const token = signToken({
      sub: "usr_rev_01",
      role: "REVIEWER",
      email: "reviewer@tribal.gov.in",
      name: "Desk Officer",
    });

    const payload = verifyToken(token);
    expect(payload.sub).toBe("usr_rev_01");
    expect(payload.role).toBe("REVIEWER");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("rejects tampered tokens with signature error (401)", () => {
    const validToken = mintDemoToken("ADMIN");
    const tamperedToken = validToken.substring(0, validToken.length - 4) + "XXXX";

    expect(() => verifyToken(tamperedToken)).toThrowError(AppError);
    try {
      verifyToken(tamperedToken);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects expired tokens (401)", () => {
    const expiredToken = signToken(
      {
        sub: "usr_exp_01",
        role: "STUDENT",
        email: "student@example.com",
        name: "Student",
      },
      -10 // Expired 10 seconds ago
    );

    expect(() => verifyToken(expiredToken)).toThrowError(AppError);
    try {
      verifyToken(expiredToken);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain("expired");
    }
  });

  it("authorizes allowed role and allows SUPER_ADMIN universally", () => {
    const reviewerUser: AuthenticatedUser = {
      sub: "usr_rev_01",
      role: "REVIEWER",
      email: "rev@gov.in",
      name: "Reviewer",
      iat: 100,
      exp: 200,
      isAuthenticated: true,
    };

    expect(() => authorize(reviewerUser, ["REVIEWER", "ADMIN"])).not.toThrow();

    const superAdminUser: AuthenticatedUser = {
      sub: "usr_super_01",
      role: "SUPER_ADMIN",
      email: "super@gov.in",
      name: "Super Admin",
      iat: 100,
      exp: 200,
      isAuthenticated: true,
    };

    expect(() => authorize(superAdminUser, ["FINANCE_OFFICER"])).not.toThrow();
  });

  it("denies access with 403 FORBIDDEN when user has insufficient role", () => {
    const studentUser: AuthenticatedUser = {
      sub: "usr_stu_01",
      role: "STUDENT",
      email: "student@example.com",
      name: "Student",
      iat: 100,
      exp: 200,
      isAuthenticated: true,
    };

    expect(() => authorize(studentUser, ["ADMIN", "FINANCE_OFFICER"])).toThrowError(AppError);
    try {
      authorize(studentUser, ["ADMIN", "FINANCE_OFFICER"]);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toContain("STUDENT");
    }
  });
});
