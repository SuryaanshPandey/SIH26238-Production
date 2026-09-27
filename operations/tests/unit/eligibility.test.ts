import { describe, it, expect } from "vitest";
import { eligibilityEngine } from "@/modules/eligibility/EligibilityEngine";
import { mockStudentClient } from "@/adapters/student/MockStudentClient";

describe("Eligibility Engine Test Suite", () => {
  const dummyScholarship: any = {
    scholarship_id: "sch_post_matric_st",
    scheme_name: "Post-Matric Scholarship for ST Students",
    scheme_code: "PMS-ST-2026",
    scheme_type: "POST_MATRIC",
    academic_year: "2026-2027",
    status: "ACTIVE",
    jurisdiction: "National - Ministry of Tribal Affairs",
    eligibility_rule_version: "v1.0",
    application_start_date: "2026-07-01T00:00:00Z",
    application_end_date: "2026-12-31T23:59:59Z",
    required_document_types: ["CASTE_CERTIFICATE", "INCOME_CERTIFICATE"],
    benefit_summary: { maximum_amount: 52400 },
    application_channel: "ONLINE_PORTAL",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };

  it("evaluates a fully eligible ST student with matching verification as ELIGIBLE", async () => {
    const student = (await mockStudentClient.getStudentById("stu_demo_001"))!;
    const verifications: any[] = [
      { verification_id: "v1", attribute_name: "CASTE_ST", status: "MATCH", evidence_refs: [] },
      { verification_id: "v2", attribute_name: "INCOME_THRESHOLD", status: "MATCH", evidence_refs: [] },
      { verification_id: "v3", attribute_name: "INSTITUTION_ENROLLMENT", status: "MATCH", evidence_refs: [] },
    ];

    const result = eligibilityEngine.evaluate("app_test_01", {
      student,
      scholarship: dummyScholarship,
      documents: [],
      verifications,
      applicationDate: new Date("2026-08-15"),
    });

    expect(result.result).toBe("ELIGIBLE");
    expect(result.failedRules.length).toBe(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("evaluates a high-income ST student as NOT_ELIGIBLE with documented reason", async () => {
    const student = (await mockStudentClient.getStudentById("stu_demo_high_income"))!;
    const verifications: any[] = [
      { verification_id: "v1", attribute_name: "CASTE_ST", status: "MATCH", evidence_refs: [] },
    ];

    const result = eligibilityEngine.evaluate("app_test_02", {
      student,
      scholarship: dummyScholarship,
      documents: [],
      verifications,
      applicationDate: new Date("2026-08-15"),
    });

    expect(result.result).toBe("NOT_ELIGIBLE");
    expect(result.failedRules.length).toBeGreaterThan(0);
    expect(result.failedRules[0]).toContain("exceeds the maximum allowable limit");
  });

  it("evaluates a non-ST student as NOT_ELIGIBLE", async () => {
    const student = (await mockStudentClient.getStudentById("stu_demo_non_st"))!;
    const result = eligibilityEngine.evaluate("app_test_03", {
      student,
      scholarship: dummyScholarship,
      documents: [],
      verifications: [],
      applicationDate: new Date("2026-08-15"),
    });

    expect(result.result).toBe("NOT_ELIGIBLE");
    expect(result.failedRules.some((r) => r.includes("exclusively reserved for Scheduled Tribes"))).toBe(true);
  });

  it("CRITICAL RULE: does NOT mark student NOT_ELIGIBLE when verification source is SOURCE_UNAVAILABLE", async () => {
    const student = (await mockStudentClient.getStudentById("stu_demo_001"))!;
    const verifications: any[] = [
      { verification_id: "v1", attribute_name: "CASTE_ST", status: "MATCH", evidence_refs: [] },
      { verification_id: "v2", attribute_name: "INSTITUTION_ENROLLMENT", status: "SOURCE_UNAVAILABLE", source_system: "AISHE", evidence_refs: [] },
    ];

    const result = eligibilityEngine.evaluate("app_test_04", {
      student,
      scholarship: dummyScholarship,
      documents: [],
      verifications,
      applicationDate: new Date("2026-08-15"),
    });

    expect(result.result).toBe("NEEDS_VERIFICATION");
    expect(result.result).not.toBe("NOT_ELIGIBLE");
    expect(result.verificationDependencies.length).toBeGreaterThan(0);
  });
});
