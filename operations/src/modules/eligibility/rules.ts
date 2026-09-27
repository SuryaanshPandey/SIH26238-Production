import { EligibilityRule, RuleEvaluationContext, SingleRuleResult } from "./types";

/**
 * 1. CategoryRule: Ensures student belongs to Scheduled Tribes (ST).
 */
export class CategoryRule implements EligibilityRule {
  ruleCode = "CATEGORY_ST_REQUIREMENT";
  ruleName = "Scheduled Tribe (ST) Category Verification";
  category = "DEMOGRAPHIC" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    if (!ctx.student.category) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "MISSING_INFORMATION",
        passed: false,
        reason: "Student category is not provided in application profile.",
        evidenceRefs: [],
      };
    }

    if (ctx.student.category !== "ST") {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Student belongs to '${ctx.student.category}', but this scheme is exclusively reserved for Scheduled Tribes (ST).`,
        evidenceRefs: [],
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `Category criteria satisfied: Student is verified as Scheduled Tribe (${ctx.student.sub_caste_tribe || "ST"}).`,
      evidenceRefs: [],
    };
  }
}

/**
 * 2. IncomeRule: Validates family annual income against scheme ceilings.
 */
export class IncomeRule implements EligibilityRule {
  ruleCode = "ANNUAL_INCOME_LIMIT";
  ruleName = "Annual Family Income Ceiling";
  category = "FINANCIAL" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    if (ctx.student.annual_family_income === undefined || ctx.student.annual_family_income === null) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "MISSING_INFORMATION",
        passed: false,
        reason: "Annual family income data is missing.",
        evidenceRefs: [],
      };
    }

    // Scheme threshold logic
    let maxIncome = 250000; // Default 2.5 Lakhs for Pre/Post Matric
    if (ctx.scholarship.scheme_type === "HIGHER_EDUCATION" || ctx.scholarship.scheme_type === "FELLOWSHIP") {
      maxIncome = 600000;
    } else if (ctx.scholarship.scheme_type === "OVERSEAS") {
      maxIncome = 800000;
    }

    if (ctx.student.annual_family_income > maxIncome) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Declared income of ₹${ctx.student.annual_family_income.toLocaleString("en-IN")} exceeds the maximum allowable limit of ₹${maxIncome.toLocaleString("en-IN")} for ${ctx.scholarship.scheme_name}.`,
        evidenceRefs: [],
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `Income criteria satisfied: Family income of ₹${ctx.student.annual_family_income.toLocaleString("en-IN")} is within the limit of ₹${maxIncome.toLocaleString("en-IN")}.`,
      evidenceRefs: [],
    };
  }
}

/**
 * 3. EducationLevelRule: Validates education level matches scheme category.
 */
export class EducationLevelRule implements EligibilityRule {
  ruleCode = "EDUCATION_LEVEL_MATCH";
  ruleName = "Academic Level & Course Eligibility";
  category = "ACADEMIC" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    const level = ctx.student.education_level;
    const type = ctx.scholarship.scheme_type;

    if (!level) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "MISSING_INFORMATION",
        passed: false,
        reason: "Student academic level is not specified.",
        evidenceRefs: [],
      };
    }

    const preMatricLevels = ["CLASS_9", "CLASS_10"];
    const postMatricLevels = ["CLASS_11", "CLASS_12", "UNDERGRADUATE", "POSTGRADUATE"];
    const higherEdLevels = ["UNDERGRADUATE", "POSTGRADUATE", "M_PHIL", "PHD"];
    const fellowshipLevels = ["M_PHIL", "PHD", "POST_DOCTORAL"];

    let isMatch = false;
    let expected = "";

    if (type === "PRE_MATRIC") {
      isMatch = preMatricLevels.includes(level);
      expected = "Class 9 or Class 10";
    } else if (type === "POST_MATRIC") {
      isMatch = postMatricLevels.includes(level);
      expected = "Class 11, Class 12, Undergraduate, or Postgraduate";
    } else if (type === "HIGHER_EDUCATION") {
      isMatch = higherEdLevels.includes(level);
      expected = "Top-Class Higher Education (UG/PG/PhD)";
    } else if (type === "FELLOWSHIP") {
      isMatch = fellowshipLevels.includes(level);
      expected = "M.Phil / Ph.D Fellowship";
    } else {
      isMatch = true;
    }

    if (!isMatch) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Student academic level '${level}' does not qualify for ${type} scheme. Expected level: ${expected}.`,
        evidenceRefs: [],
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `Academic level criteria satisfied: ${level} matches ${type} requirements.`,
      evidenceRefs: [],
    };
  }
}

/**
 * 4. InstitutionRule: Validates enrollment and active institution details.
 */
export class InstitutionRule implements EligibilityRule {
  ruleCode = "INSTITUTION_ENROLLMENT_VALID";
  ruleName = "Recognized Institution Enrollment";
  category = "ACADEMIC" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    if (!ctx.student.institution_id || !ctx.student.institution_name) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "MISSING_INFORMATION",
        passed: false,
        reason: "Institution enrollment record or AISHE identifier is missing.",
        evidenceRefs: [],
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `Institution criteria satisfied: Enrolled in recognized institute '${ctx.student.institution_name}'.`,
      evidenceRefs: [ctx.student.institution_id],
    };
  }
}

/**
 * 5. ApplicationPeriodRule: Checks if application falls within active window.
 */
export class ApplicationPeriodRule implements EligibilityRule {
  ruleCode = "APPLICATION_PERIOD_WINDOW";
  ruleName = "Active Application Window Check";
  category = "TEMPORAL" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    const now = ctx.applicationDate || new Date();
    const start = new Date(ctx.scholarship.application_start_date);
    const end = new Date(ctx.scholarship.application_end_date);

    if (ctx.scholarship.status === "CLOSED") {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Scholarship scheme '${ctx.scholarship.scheme_name}' is currently marked CLOSED for applications.`,
        evidenceRefs: [],
      };
    }

    if (now < start) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Application period has not commenced yet. Starts on ${start.toISOString().split("T")[0]}.`,
        evidenceRefs: [],
      };
    }

    if (now > end) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Application period closed on ${end.toISOString().split("T")[0]}.`,
        evidenceRefs: [],
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `Application window criteria satisfied: Active until ${end.toISOString().split("T")[0]}.`,
      evidenceRefs: [],
    };
  }
}

/**
 * 6. VerificationEvidenceRule: Integrates verification feedback from Suryaansh.
 * CRITICAL RULE: SOURCE_UNAVAILABLE must NEVER become FAILED/NOT_ELIGIBLE.
 */
export class VerificationEvidenceRule implements EligibilityRule {
  ruleCode = "VERIFICATION_EVIDENCE_DEPENDENCY";
  ruleName = "External Verification and Evidence Review";
  category = "VERIFICATION" as const;

  evaluate(ctx: RuleEvaluationContext): SingleRuleResult {
    if (!ctx.verifications || ctx.verifications.length === 0) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "NEEDS_VERIFICATION",
        passed: false,
        reason: "No automated verification results received yet. Application is pending verification pipeline.",
        evidenceRefs: [],
      };
    }

    const mismatches = ctx.verifications.filter((v) => v.status === "MISMATCH");
    if (mismatches.length > 0) {
      const details = mismatches.map((m) => `${m.attribute_name}: ${m.verification_notes || "Data mismatch"}`).join("; ");
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "FAILED",
        passed: false,
        reason: `Verification discrepancy detected: ${details}`,
        evidenceRefs: mismatches.flatMap((m) => m.evidence_refs),
      };
    }

    const unavailable = ctx.verifications.filter((v) => v.status === "SOURCE_UNAVAILABLE");
    if (unavailable.length > 0) {
      const sources = unavailable.map((u) => u.source_system).join(", ");
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "NEEDS_VERIFICATION",
        passed: false,
        reason: `Upstream verification source(s) [${sources}] are currently unreachable. Retrying or routing to manual desk verification.`,
        evidenceRefs: [],
      };
    }

    const pending = ctx.verifications.filter((v) => v.status === "PENDING_REVIEW" || v.status === "PARTIAL_MATCH");
    if (pending.length > 0) {
      return {
        ruleCode: this.ruleCode,
        ruleName: this.ruleName,
        category: this.category,
        status: "NEEDS_VERIFICATION",
        passed: false,
        reason: "Partial verification or manual desk review pending for some attributes.",
        evidenceRefs: pending.flatMap((p) => p.evidence_refs),
      };
    }

    return {
      ruleCode: this.ruleCode,
      ruleName: this.ruleName,
      category: this.category,
      status: "SATISFIED",
      passed: true,
      reason: `All automated verification checks matched with high confidence (${ctx.verifications.length} verified attributes).`,
      evidenceRefs: ctx.verifications.flatMap((v) => v.evidence_refs),
    };
  }
}
