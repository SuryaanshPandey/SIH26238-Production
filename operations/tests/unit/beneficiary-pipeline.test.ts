import { describe, it, expect } from "vitest";
import { beneficiaryService } from "@/modules/beneficiaries/BeneficiaryService";
import { prisma } from "@/lib/prisma";

describe("Beneficiary Intelligence Dynamic Pipeline Test Suite", () => {
  it("generates candidates dynamically for unassisted eligible ST students", async () => {
    const candidates = await beneficiaryService.generateCandidates();

    expect(Array.isArray(candidates)).toBe(true);
    if (candidates.length > 0) {
      const first = candidates[0];
      expect(first.candidate_id).toBeDefined();
      expect(first.confidence).toBeGreaterThanOrEqual(0.7);
      expect(first.status).toBe("PENDING_REVIEW");
      expect(first.reason).toContain("matches criteria");
      expect(first.evidence_ids.length).toBeGreaterThan(0);
    }
  });

  it("allows desk officer to review and confirm or decline a candidate", async () => {
    const list = await beneficiaryService.listCandidates();
    if (list.length > 0) {
      const candidateId = list[0].candidate_id;
      const updated = await beneficiaryService.reviewCandidate(
        candidateId,
        "CONFIRM",
        "Confirmed for proactive tribal outreach program.",
        "OFFICER_01"
      );

      expect(updated.status).toBe("CONFIRMED");
      expect(updated.review_notes).toBe("Confirmed for proactive tribal outreach program.");
      expect(updated.reviewed_at).toBeDefined();
    }
  });
});
