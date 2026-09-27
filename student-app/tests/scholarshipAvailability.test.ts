import { describe, expect, it } from "vitest";
import { getScholarshipApplicationAvailability } from "../lib/scholarshipAvailability";
import type { Scholarship } from "../lib/contracts/types";

const base = {
  scheme_id: "test-scheme",
  scheme_name: "Test Scheme",
  scheme_code: "TEST-2026",
  scheme_type: "CENTRAL_SECTOR",
  jurisdiction: "CENTRAL",
  ministry: "Ministry",
  description: "",
  academic_year: "2026-2027",
  education_level: "HIGHER_EDUCATION",
  target_group: "ST",
  income_ceiling: null,
  benefits: { maintenance_allowance_per_annum: 0, tuition_fee_coverage: "See official source", additional_benefits: [] },
  required_documents: [],
  application_channel: "NSP",
  portal_name: "NSP",
  source_system: "NSP",
  source_mode: "LIVE",
  source_evidence: [],
  source_count: 0,
} as unknown as Scholarship;

describe("scholarship application availability", () => {
  it("blocks INFORMATION_ONLY schemes", () => {
    const result = getScholarshipApplicationAvailability({ ...base, status: "INFORMATION_ONLY", start_date: null, deadline: null });
    expect(result.canApply).toBe(false);
    expect(result.reason).toBe("INFORMATION_ONLY");
  });

  it("blocks upcoming schemes even when an old OPEN flag would be stale", () => {
    const result = getScholarshipApplicationAvailability({ ...base, status: "UPCOMING", start_date: "2030-01-01T00:00:00.000Z", deadline: "2030-02-01T00:00:00.000Z" });
    expect(result.canApply).toBe(false);
  });

  it("allows a genuinely open scheme", () => {
    const now = Date.parse("2026-09-27T00:00:00.000Z");
    const result = getScholarshipApplicationAvailability({ ...base, status: "OPEN", start_date: "2026-09-01T00:00:00.000Z", deadline: "2026-10-01T00:00:00.000Z" }, now);
    expect(result.canApply).toBe(true);
  });
});
