import {
  EligibilityEvaluationResult,
  EligibilityRule,
  RuleEvaluationContext,
  SingleRuleResult,
} from "./types";
import {
  CategoryRule,
  IncomeRule,
  EducationLevelRule,
  InstitutionRule,
  ApplicationPeriodRule,
  VerificationEvidenceRule,
} from "./rules";

export class EligibilityEngine {
  private rules: EligibilityRule[] = [];

  constructor(customRules?: EligibilityRule[]) {
    this.rules = customRules || [
      new ApplicationPeriodRule(),
      new CategoryRule(),
      new IncomeRule(),
      new EducationLevelRule(),
      new InstitutionRule(),
      new VerificationEvidenceRule(),
    ];
  }

  public evaluate(
    applicationId: string,
    context: RuleEvaluationContext
  ): EligibilityEvaluationResult {
    const ruleResults: SingleRuleResult[] = [];

    // In real-data mode, public NSP catalogue records contain scheme identity and
    // application-window metadata, but not the complete machine-readable eligibility
    // rule set needed to make a deterministic eligibility decision. Never apply the
    // legacy demo rules to a live catalogue record because that would fabricate an
    // eligibility decision from incomplete source data.
    if (
      process.env.REAL_DATA_MODE !== "false" &&
      ["NSP_SOURCE", "NSP_SNAPSHOT"].includes(context.scholarship.eligibility_rule_version)
    ) {
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const result: SingleRuleResult = {
        ruleCode: "NSP_OFFICIAL_RULESET_REQUIRED",
        ruleName: "Official NSP Scheme Eligibility Rules",
        category: "VERIFICATION",
        status: "NEEDS_VERIFICATION",
        passed: false,
        reason:
          context.scholarship.eligibility_rule_version === "NSP_SNAPSHOT"
            ? "The bundled official NSP snapshot provides the scheme and application window, but the complete machine-readable eligibility rules were not imported. Eligibility must be checked against the current official scheme specification or an authorized source before a final decision."
            : "The live National Scholarship Portal catalogue entry provides the scheme and application window, but the complete machine-readable eligibility rules were not imported. Eligibility must be checked against the official scheme specification or an authorized source before a final decision.",
        evidenceRefs: context.scholarship.source_url ? [context.scholarship.source_url] : [],
      };
      ruleResults.push(result);
      return {
        evaluationId,
        applicationId,
        scholarshipId: context.scholarship.scholarship_id,
        ruleVersion: context.scholarship.eligibility_rule_version,
        result: "NEEDS_VERIFICATION",
        confidence: 0,
        reasons: [],
        failedRules: [],
        missingInformation: [],
        verificationDependencies: [result.reason],
        ruleResults,
        evaluatedAt: new Date().toISOString(),
      };
    }
    const reasons: string[] = [];
    const failedRules: string[] = [];
    const missingInformation: string[] = [];
    const verificationDependencies: string[] = [];

    for (const rule of this.rules) {
      const res = rule.evaluate(context);
      ruleResults.push(res);

      if (res.status === "SATISFIED") {
        reasons.push(res.reason);
      } else if (res.status === "FAILED") {
        failedRules.push(`${res.ruleName}: ${res.reason}`);
      } else if (res.status === "MISSING_INFORMATION") {
        missingInformation.push(`${res.ruleName}: ${res.reason}`);
      } else if (res.status === "NEEDS_VERIFICATION") {
        verificationDependencies.push(`${res.ruleName}: ${res.reason}`);
      }
    }

    // Determine overall result
    let overallResult: "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_VERIFICATION" = "ELIGIBLE";
    let confidence = 1.0;

    if (failedRules.length > 0) {
      overallResult = "NOT_ELIGIBLE";
      confidence = 0.95;
    } else if (verificationDependencies.length > 0 || missingInformation.length > 0) {
      overallResult = "NEEDS_VERIFICATION";
      confidence = 0.85;
    } else {
      overallResult = "ELIGIBLE";
      confidence = 0.99;
    }

    const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      evaluationId,
      applicationId,
      scholarshipId: context.scholarship.scholarship_id,
      ruleVersion: context.scholarship.eligibility_rule_version || "v1.0",
      result: overallResult,
      confidence,
      reasons,
      failedRules,
      missingInformation,
      verificationDependencies,
      ruleResults,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const eligibilityEngine = new EligibilityEngine();
