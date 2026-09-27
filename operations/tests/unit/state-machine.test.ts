import { describe, it, expect } from "vitest";
import { ApplicationStateMachine } from "@/modules/applications/ApplicationStateMachine";
import { AppError } from "@/shared/errors/AppError";

describe("Application State Machine Test Suite", () => {
  it("allows valid forward transition from DRAFT to SUBMITTED", () => {
    expect(ApplicationStateMachine.canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(() => ApplicationStateMachine.validateTransition("DRAFT", "SUBMITTED")).not.toThrow();
  });

  it("allows valid transitions through verification to sanction and payment", () => {
    expect(ApplicationStateMachine.canTransition("SUBMITTED", "UNDER_VERIFICATION")).toBe(true);
    expect(ApplicationStateMachine.canTransition("UNDER_VERIFICATION", "VERIFIED")).toBe(true);
    expect(ApplicationStateMachine.canTransition("VERIFIED", "SANCTIONED")).toBe(true);
    expect(ApplicationStateMachine.canTransition("SANCTIONED", "PAYMENT_PROCESSING")).toBe(true);
    expect(ApplicationStateMachine.canTransition("PAYMENT_PROCESSING", "PAID")).toBe(true);
  });

  it("blocks illegal transitions (e.g. PAID -> DRAFT, REJECTED -> PAID)", () => {
    expect(ApplicationStateMachine.canTransition("PAID", "DRAFT")).toBe(false);
    expect(() => ApplicationStateMachine.validateTransition("PAID", "DRAFT")).toThrowError(AppError);

    expect(ApplicationStateMachine.canTransition("REJECTED", "PAID")).toBe(false);
    expect(() => ApplicationStateMachine.validateTransition("REJECTED", "PAID")).toThrowError(AppError);
  });

  it("identifies terminal states correctly", () => {
    expect(ApplicationStateMachine.isTerminal("PAID")).toBe(true);
    expect(ApplicationStateMachine.isTerminal("REJECTED")).toBe(true);
    expect(ApplicationStateMachine.isTerminal("WITHDRAWN")).toBe(true);
    expect(ApplicationStateMachine.isTerminal("CANCELLED")).toBe(true);
    expect(ApplicationStateMachine.isTerminal("UNDER_VERIFICATION")).toBe(false);
  });
});
