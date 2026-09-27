/**
 * Common Data Contract v1 - Entity Definitions
 * Standardized across Suryansh (Student), Suryaansh (Verification), and Rijvan (Operations).
 */

// Scheme types supported
export type SchemeType =
  | "PRE_MATRIC"
  | "POST_MATRIC"
  | "HIGHER_EDUCATION"
  | "FELLOWSHIP"
  | "OVERSEAS"
  | "OTHER";

// Application statuses owned solely by Rijvan
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_VERIFICATION"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "SANCTIONED"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "ACTION_REQUIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CANCELLED";

// Deficiency types
export type DeficiencyType =
  | "DOCUMENT_MISSING"
  | "DOCUMENT_INVALID"
  | "DOCUMENT_EXPIRED"
  | "DOCUMENT_MISMATCH"
  | "IDENTITY_MISMATCH"
  | "DATA_MISMATCH"
  | "INSTITUTION_VERIFICATION_PENDING"
  | "STATE_VERIFICATION_PENDING"
  | "SOURCE_UNAVAILABLE"
  | "ADDITIONAL_INFORMATION_REQUIRED"
  | "OTHER";

export type DeficiencySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DeficiencyStatus =
  | "OPEN"
  | "ACTION_REQUIRED"
  | "IN_REVIEW"
  | "RESOLVED"
  | "CLOSED"
  | "WAIVED";

export type RequiredAction =
  | "REUPLOAD_DOCUMENT"
  | "PROVIDE_INFORMATION"
  | "CLARIFICATION"
  | "WAIT_FOR_VERIFICATION"
  | "MANUAL_REVIEW"
  | "CONTACT_INSTITUTION"
  | "NO_ACTION";

// Review workflow
export type ReviewStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_REVIEW"
  | "DECIDED"
  | "ESCALATED"
  | "CLOSED";

export type ReviewDecision =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CORRECTION"
  | "REQUEST_CLARIFICATION"
  | "ESCALATE";

// Sanction statuses
export type SanctionStatus =
  | "NOT_READY"
  | "PENDING"
  | "APPROVED"
  | "ISSUED"
  | "REVOKED"
  | "CANCELLED";

// Payment statuses (strictly separated from application status)
export type PaymentStatus =
  | "NOT_APPLICABLE"
  | "NOT_INITIATED"
  | "INITIATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "RETURNED"
  | "UNKNOWN";

// Eligibility Result
export type EligibilityResult =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NEEDS_VERIFICATION";

export type RuleEvaluationStatus =
  | "SATISFIED"
  | "FAILED"
  | "MISSING_INFORMATION"
  | "NEEDS_VERIFICATION"
  | "NOT_APPLICABLE";

// Verification result statuses (from Suryaansh)
export type VerificationStatus =
  | "MATCH"
  | "PARTIAL_MATCH"
  | "MISMATCH"
  | "NOT_VERIFIABLE"
  | "SOURCE_UNAVAILABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "PENDING_REVIEW";

// Beneficiary Candidate Status
export type BeneficiaryCandidateStatus =
  | "CANDIDATE"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "NOT_ELIGIBLE"
  | "ALREADY_BENEFITING"
  | "OUTREACH_COMPLETED"
  | "CLOSED";

// Audit Actor Types
export type ActorType =
  | "STUDENT"
  | "INSTITUTE"
  | "REVIEWER"
  | "MINISTRY"
  | "SYSTEM"
  | "ADMIN";

// 1. Student Contract (consumed from Suryansh via mock)
export interface StudentContract {
  student_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string; // ISO-8601 YYYY-MM-DD
  gender: "MALE" | "FEMALE" | "OTHER";
  category: "ST" | "SC" | "OBC" | "GENERAL";
  sub_caste_tribe?: string | null;
  annual_family_income: number;
  domicile_state: string;
  domicile_district?: string | null;
  masked_aadhaar?: string | null; // masked/tokenized only; never raw Aadhaar
  email: string;
  mobile_masked: string; // e.g. "XXXXXX7890"
  institution_id: string;
  institution_name: string;
  education_level: "CLASS_9" | "CLASS_10" | "CLASS_11" | "CLASS_12" | "UNDERGRADUATE" | "POSTGRADUATE" | "M_PHIL" | "PHD" | "POST_DOCTORAL";
  course_name: string;
  current_academic_year: string; // e.g. "2026-2027"
  bank_account_masked?: string | null; // masked only
  bank_ifsc?: string | null;
}

export interface ScholarshipSourceEvidence {
  source_id: string;
  source_name: string;
  source_url: string;
  fetched_at: string;
  extraction_method: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
}

// 2. Scholarship Contract (owned by Rijvan)
export interface ScholarshipContract {
  scholarship_id: string;
  scheme_name: string;
  scheme_code: string;
  scheme_type: SchemeType;
  education_level?: "PRE_MATRIC" | "POST_MATRIC" | "HIGHER_EDUCATION" | "FELLOWSHIP" | "OVERSEAS";
  academic_year: string;
  status: "ACTIVE" | "INACTIVE" | "UPCOMING" | "CLOSED" | "INFORMATION_ONLY";
  jurisdiction: string; // e.g. "National - Ministry of Tribal Affairs"
  eligibility_rule_version: string;
  application_start_date: string | null;
  application_end_date: string | null;
  required_document_types: string[];
  benefit_summary: {
    maintenance_allowance_annual?: number;
    tuition_fee_annual?: number;
    book_grant_annual?: number;
    contingency_annual?: number;
    maximum_amount: number;
  };
  application_channel: "ONLINE_PORTAL" | "DIRECT_BENEFIT";
  created_at: string;
  updated_at: string;
  source_system?: string;
  source_url?: string | null;
  source_fetched_at?: string | null;
  source_mode?: "LIVE" | "SNAPSHOT";
  description?: string;
  target_group?: string;
  income_ceiling?: number | null;
  source_evidence?: ScholarshipSourceEvidence[];
  source_count?: number;
  eligibility_summary?: string;
}

// 3. Application Contract (owned solely by Rijvan)
export interface ApplicationContract {
  application_id: string;
  student_id: string;
  scholarship_id: string;
  academic_year: string;
  status: ApplicationStatus;
  current_stage: string;
  submitted_at: string | null;
  updated_at: string;
  institution_id: string;
  deficiency_ids: string[];
  verification_ids: string[];
  sanction_id: string | null;
  payment_id: string | null;
}

// 4. Document Metadata Contract (consumed from Suryaansh via mock)
export interface DocumentContract {
  document_id: string;
  student_id: string;
  document_type: string; // "INCOME_CERTIFICATE", "CASTE_CERTIFICATE", "AADHAAR", "MARKSHEET", "FEE_RECEIPT"
  status: "AVAILABLE" | "VERIFIED" | "MISMATCH" | "EXPIRED" | "REJECTED" | "SOURCE_UNAVAILABLE";
  issuer_authority?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  document_ref: string; // SHA-256 or secure storage pointer, no raw content
  verified_at?: string | null;
}

// 5. Verification Contract (consumed from Suryaansh via mock)
export interface VerificationContract {
  verification_id: string;
  application_id: string;
  attribute_name: string; // "CASTE_ST", "INCOME_THRESHOLD", "INSTITUTION_ENROLLMENT", "AADHAAR_IDENTITY"
  status: VerificationStatus;
  confidence: number; // 0.0 - 1.0
  source_system: string; // "DigiLocker", "StateRevenuePortal", "AISHE", "UIDAI_TOKEN"
  evidence_refs: string[];
  verification_notes?: string | null;
  verified_at: string;
}

// 6. Deficiency Contract (owned by Rijvan)
export interface DeficiencyContract {
  deficiency_id: string;
  application_id: string;
  type: DeficiencyType;
  title: string;
  description: string;
  severity: DeficiencySeverity;
  status: DeficiencyStatus;
  required_action: RequiredAction;
  created_at: string;
  due_at: string;
  resolved_at: string | null;
}

// 7. Manual Review Contract (owned by Rijvan)
export interface ReviewContract {
  review_id: string;
  application_id: string;
  reason: string;
  severity: DeficiencySeverity;
  status: ReviewStatus;
  assigned_reviewer: string | null;
  created_at: string;
  updated_at: string;
  decision: ReviewDecision | null;
  decision_reason: string | null;
  resolved_at: string | null;
}

// 8. Sanction Contract (owned by Rijvan)
export interface SanctionContract {
  sanction_id: string;
  application_id: string;
  status: SanctionStatus;
  amount: number;
  currency: "INR";
  reference: string; // e.g. "SANCTION-MTA-2026-0001"
  sanctioned_at: string | null;
  created_at: string;
  updated_at: string;
}

// 9. Payment Contract (owned by Rijvan)
export interface PaymentContract {
  payment_id: string;
  application_id: string;
  status: PaymentStatus;
  amount: number;
  currency: "INR";
  payment_reference: string; // PFMS transaction tracking ID
  initiated_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  source: "PFMS_DBT" | "STATE_TREASURY" | "DIRECT_TRANSFER";
}

// 10. Notification Contract (owned by Rijvan)
export interface NotificationContract {
  notification_id: string;
  student_id: string;
  application_id: string | null;
  type: string;
  title: string;
  message: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  channel: "IN_APP" | "PUSH" | "SMS" | "EMAIL";
  read: boolean;
  created_at: string;
  action_url?: string;
}

// 11. Beneficiary Candidate Contract (owned by Rijvan)
export interface BeneficiaryCandidateContract {
  candidate_id: string;
  student_id: string;
  potential_scholarship_id: string;
  scheme_name: string;
  reason_code: "ENROLLED_WITHOUT_ACTIVE_BENEFIT" | "POTENTIAL_ELIGIBILITY_MATCH" | "APPLICATION_ABANDONED" | "BENEFIT_GAP_DETECTED";
  reason: string;
  confidence: number;
  status: BeneficiaryCandidateStatus;
  evidence_ids: string[];
  created_at: string;
  reviewed_at: string | null;
  review_notes?: string | null;
}

// 12. Assistance / JAGO Contract (owned by Rijvan)
export type JagoIntent =
  | "SCHOLARSHIP_DISCOVERY"
  | "ELIGIBILITY"
  | "APPLICATION_STATUS"
  | "DOCUMENT_HELP"
  | "DEFICIENCY"
  | "VERIFICATION"
  | "SANCTION"
  | "PAYMENT"
  // Personal profile questions: category/tribe, income, education, location, identity, DOB
  | "PROFILE"
  | "GENERAL_ASSISTANCE";

export interface JagoAction {
  type: "NAVIGATE";
  label: string;
  href: string;
}

export interface JagoAssistanceContract {
  assistance_id: string;
  student_id: string;
  application_id: string | null;
  query: string;
  intent: JagoIntent;
  response: string;
  language: "en" | "hi";
  source_refs: string[];
  generated_at: string;
  suggested_actions?: JagoAction[];
  suggested_followups?: string[];
}

// 13. Audit Event Contract (owned by Rijvan)
export interface AuditEventContract {
  audit_event_id: string;
  actor_type: ActorType;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  reason: string | null;
  correlation_id: string;
  payload?: Record<string, unknown> | null;
}

// 14. External Reference Contract
export interface ExternalReferenceContract {
  external_reference_id: string;
  system: "NSP" | "DigiLocker" | "UDISE_PLUS" | "APAAR" | "AISHE" | "PFMS" | "STATE_SYSTEM" | "INSTITUTIONAL_SYSTEM";
  entity_type: string;
  entity_id: string;
  external_id: string;
  status: "ACTIVE" | "VERIFIED" | "STALE" | "DISCONNECTED";
  created_at: string;
}
