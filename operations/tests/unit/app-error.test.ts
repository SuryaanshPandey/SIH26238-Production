import { describe, expect, it } from "vitest";
import { AppError } from "@/shared/errors/AppError";

describe("AppError authentication/conflict helpers", () => {
  it("creates a 409 duplicate-operation error for conflict()", () => {
    const error = AppError.conflict("A student account already exists.");

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("DUPLICATE_OPERATION");
    expect(error.message).toBe("A student account already exists.");
  });

  it("creates a 401 unauthorized error for unauthorized()", () => {
    const error = AppError.unauthorized("Invalid student credentials.");

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Invalid student credentials.");
  });
});
