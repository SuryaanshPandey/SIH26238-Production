import { describe, it, expect } from "vitest";
import { verificationApi } from "../lib/api/verification";

describe("Attribute-Level Verification & Source Provenance", () => {
  it("fetches granular attribute-level checks rather than an opaque score", async () => {
    const checks = await verificationApi.getVerificationChecks("APP-2026-ST-84091");
    expect(checks.length).toBeGreaterThanOrEqual(4);

    const attributes = checks.map((c) => c.attribute_name);
    expect(attributes).toContain("Full Name");
    expect(attributes).toContain("Date of Birth (DOB)");
    expect(attributes).toContain("ST Community Status");
    expect(attributes).toContain("Annual Family Income");
  });

  it("proves that data mismatch does not immediately reject the applicant", async () => {
    const checks = await verificationApi.getVerificationChecks("APP-2026-ST-84091");
    const incomeCheck = checks.find((c) => c.attribute_name.includes("Income"));

    expect(incomeCheck).toBeDefined();
    expect(incomeCheck?.match_state).toBe("MISMATCH");
    // Crucial requirement: Mismatch is in review / pending review, NOT rejected
    expect(["IN_REVIEW", "PENDING"]).toContain(incomeCheck?.review_status);
  });
});
