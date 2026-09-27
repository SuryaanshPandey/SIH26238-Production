import crypto from "crypto";
import { AppError } from "@/shared/errors/AppError";

export type UserRole =
  | "ADMIN"
  | "REVIEWER"
  | "SCHOLARSHIP_OFFICER"
  | "FINANCE_OFFICER"
  | "SUPER_ADMIN"
  | "STUDENT";

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "sih-2026-mota-rijvan-secret-key-min-32-chars";

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

export function signToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
  expiresInSeconds = 3600
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError("UNAUTHORIZED", "Malformed JWT token structure.", 401);
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw new AppError("UNAUTHORIZED", "Invalid token signature or tampered credentials.", 401);
  }

  try {
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new AppError("UNAUTHORIZED", "Authentication token has expired. Please re-authenticate.", 401);
    }

    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("UNAUTHORIZED", "Failed to parse authentication token payload.", 401);
  }
}

/**
 * Mint helper for testing & development scenarios
 */
export function mintDemoToken(role: UserRole, userId?: string): string {
  return signToken({
    sub: userId || `user_${role.toLowerCase()}_01`,
    role,
    email: `${role.toLowerCase()}@tribal.gov.in`,
    name: `${role.replace("_", " ")} Officer`,
  });
}
