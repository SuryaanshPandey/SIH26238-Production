import { describe, it, expect } from "vitest";
import { scholarshipApi } from "../lib/api/scholarship";
import officialSnapshot from "../lib/data/nsp-official-snapshot-2026-09.json";

describe("Scholarship Discovery catalogue resilience", () => {
  it("contains the bundled official 2026-27 NSP snapshot", () => {
    expect(officialSnapshot.records).toHaveLength(29);
    expect(new Set(officialSnapshot.records.map((record) => record.scholarship_id)).size).toBe(29);
    expect(officialSnapshot.records.every((record) => record.academic_year === "2026-2027")).toBe(true);
  });

  it("returns usable catalogue data immediately without waiting for live NSP", async () => {
    const schemes = await scholarshipApi.getScholarships();
    expect(schemes).toHaveLength(29);
    expect(schemes.every((scheme) => scheme.source_mode === "SNAPSHOT")).toBe(true);
  });

  it("resolves snapshot scheme details without a network request", async () => {
    const sourceRecord = officialSnapshot.records[0];
    const scheme = await scholarshipApi.getScholarshipById(sourceRecord.scholarship_id);

    expect(scheme?.scheme_id).toBe(sourceRecord.scholarship_id);
    expect(scheme?.scheme_code).toBe(sourceRecord.scheme_code);
    expect(scheme?.source_mode).toBe("SNAPSHOT");
  });
});
