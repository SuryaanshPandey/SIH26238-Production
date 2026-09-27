import { EligibilityAnswers, EligibilityEvaluationResult } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";

export const eligibilityApi = {
  async evaluateEligibility(answers: EligibilityAnswers): Promise<EligibilityEvaluationResult> {
    const studentId = getCurrentStudentId() || "";
    if (!studentId) throw new Error("Please sign in before checking eligibility.");
    const data = await apiFetch<any>(`${RIJVAN_API_URL}/eligibility/evaluate`, {
      method: "POST",
      body: JSON.stringify({
        studentId,
        scholarshipId: answers.scheme_id,
        applicationId: `eligibility_${studentId}_${answers.scheme_id}`,
        answers: {
          category: answers.category,
          annualFamilyIncome: answers.annual_family_income,
          educationStage: answers.education_stage,
          currentClassOrCourse: answers.current_class_or_course,
          institutionRecognized: answers.institution_recognized,
          institutionState: answers.institution_state,
          hasActiveOtherScholarship: answers.has_active_other_scholarship,
          isHosteller: answers.is_hosteller,
        },
      }),
    });
    const status = data.result === "NEEDS_VERIFICATION" ? "FURTHER_REVIEW" : data.result;
    const dependency = Array.isArray(data.verification_dependencies) ? data.verification_dependencies : [];
    const failed = Array.isArray(data.failed_rules) ? data.failed_rules : [];
    const missing = Array.isArray(data.missing_information) ? data.missing_information : [];
    return {
      scheme_id: data.scholarshipId,
      scheme_name: data.scholarshipName || answers.scheme_id,
      status,
      overall_verdict:
        status === "ELIGIBLE" ? "All currently configured eligibility rules are satisfied." :
        status === "NOT_ELIGIBLE" ? (failed.join(" ") || "One or more eligibility rules failed.") :
        (dependency.join(" ") || "The official scheme rules need to be verified before a final decision can be made."),
      confidence_score: Number(data.confidence || 0),
      checks: (data.rule_results || []).map((r: any) => ({
        criteria: r.rule_code,
        passed: Boolean(r.passed),
        status: r.status,
        claimed_value: "Profile data",
        threshold_or_rule: r.rule_code,
        explanation: r.reason,
      })),
      recommended_actions: [...missing, ...dependency].slice(0, 6),
      evaluated_at: data.evaluated_at,
    };
  },
};
