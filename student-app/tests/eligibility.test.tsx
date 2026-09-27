import { describe, it, expect } from "vitest";
import { eligibilityApi } from "../lib/api/eligibility";
import { EligibilityAnswers } from "../lib/contracts/types";

describe("Eligibility Evaluation Service (Deterministic Rule Engine)", () => {
  it("determines ELIGIBLE when ST student meets all criteria for Post-Matric", async () => {
    const answers: EligibilityAnswers = {
      scheme_id: "mota-post-matric-2026",
      category: "ST",
      annual_family_income: 180000, // Below 2.5L limit
      education_stage: "POST_MATRIC",
      current_class_or_course: "B.Tech Computer Science",
      institution_recognized: true,
      institution_state: "Jharkhand",
      has_active_other_scholarship: false,
      is_hosteller: true,
    };

    const res = await eligibilityApi.evaluateEligibility(answers);
    expect(res.status).toBe("ELIGIBLE");
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it("determines NOT_ELIGIBLE when non-ST/PVTG student applies", async () => {
    const answers: EligibilityAnswers = {
      scheme_id: "mota-post-matric-2026",
      category: "OTHER",
      annual_family_income: 150000,
      education_stage: "POST_MATRIC",
      current_class_or_course: "B.Tech",
      institution_recognized: true,
      institution_state: "Jharkhand",
      has_active_other_scholarship: false,
    };

    const res = await eligibilityApi.evaluateEligibility(answers);
    expect(res.status).toBe("NOT_ELIGIBLE");
    const stCheck = res.checks.find((c) => c.criteria.includes("Community"));
    expect(stCheck?.passed).toBe(false);
  });

  it("enforces the 'One Scholarship at a Time' constraint", async () => {
    const answers: EligibilityAnswers = {
      scheme_id: "mota-post-matric-2026",
      category: "ST",
      annual_family_income: 180000,
      education_stage: "POST_MATRIC",
      current_class_or_course: "B.Tech",
      institution_recognized: true,
      institution_state: "Jharkhand",
      has_active_other_scholarship: true, // Violation of single-scholarship rule
    };

    const res = await eligibilityApi.evaluateEligibility(answers);
    expect(res.status).toBe("NOT_ELIGIBLE");
    const singleCheck = res.checks.find((c) => c.criteria.includes("One Scholarship"));
    expect(singleCheck?.passed).toBe(false);
  });

  it("enforces the annual parental income ceiling of ₹2.5 Lakh for Post-Matric", async () => {
    const answers: EligibilityAnswers = {
      scheme_id: "mota-post-matric-2026",
      category: "ST",
      annual_family_income: 300000, // Exceeds 2.5L limit
      education_stage: "POST_MATRIC",
      current_class_or_course: "B.Tech",
      institution_recognized: true,
      institution_state: "Jharkhand",
      has_active_other_scholarship: false,
    };

    const res = await eligibilityApi.evaluateEligibility(answers);
    expect(res.status).toBe("NOT_ELIGIBLE");
    const incCheck = res.checks.find((c) => c.criteria.includes("Income Ceiling"));
    expect(incCheck?.passed).toBe(false);
  });
});
