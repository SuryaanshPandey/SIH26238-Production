import { StudentContract, ScholarshipContract, DocumentContract, VerificationContract } from "@contracts/v1/types";

export interface RuleEvaluationContext {
  student: StudentContract;
  scholarship: ScholarshipContract;
  documents: DocumentContract[];
  verifications: VerificationContract[];
  applicationDate?: Date;
}

export type RuleStatus =
  | "SATISFIED"
  | "FAILED"
  | "MISSING_INFORMATION"
  | "NEEDS_VERIFICATION"
  | "NOT_APPLICABLE";

export interface SingleRuleResult {
  ruleCode: string;
  ruleName: string;
  category: "DEMOGRAPHIC" | "FINANCIAL" | "ACADEMIC" | "DOCUMENT" | "VERIFICATION" | "TEMPORAL";
  status: RuleStatus;
  passed: boolean;
  reason: string;
  evidenceRefs: string[];
}

export interface EligibilityEvaluationResult {
  evaluationId: string;
  applicationId: string;
  scholarshipId: string;
  ruleVersion: string;
  result: "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_VERIFICATION";
  confidence: number;
  reasons: string[];
  failedRules: string[];
  missingInformation: string[];
  verificationDependencies: string[];
  ruleResults: SingleRuleResult[];
  evaluatedAt: string;
}

export interface EligibilityRule {
  ruleCode: string;
  ruleName: string;
  category: "DEMOGRAPHIC" | "FINANCIAL" | "ACADEMIC" | "DOCUMENT" | "VERIFICATION" | "TEMPORAL";
  evaluate(context: RuleEvaluationContext): SingleRuleResult;
}
