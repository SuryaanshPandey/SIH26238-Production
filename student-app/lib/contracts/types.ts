/**
 * Common Data Contract v1
 * Ministry of Tribal Affairs (MoTA) - SIH26238
 * Unified Scholarship Mobile Application for Tribal Students
 * 
 * Shared Entities & Enums conforming strictly to Contract v1.
 * Ownership:
 * - Suryansh: Student Experience (UI, forms, client state, API client adapters)
 * - Suryaansh: Documents + Verification backend
 * - Rijvan: Scholarship Domain + Workflow + Intelligence backend
 */

// ==========================================
// 1. APPLICATION & WORKFLOW STATUSES
// ==========================================

export type ApplicationStage =
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

export type SchemeType = "CENTRALLY_SPONSORED" | "CENTRAL_SECTOR";
export type Jurisdiction = "CENTRAL" | "STATE_UT";
export type SchemeStatus = "OPEN" | "CLOSED" | "UPCOMING" | "INFORMATION_ONLY";
export type ApplicationChannel = "DIRECT" | "NSP" | "STATE_PORTAL";
export type EducationLevel =
  | "PRE_MATRIC"
  | "POST_MATRIC"
  | "HIGHER_EDUCATION"
  | "FELLOWSHIP"
  | "OVERSEAS";

// ==========================================
// 2. DOCUMENT & VERIFICATION STATUSES
// ==========================================

export type DocumentStatus =
  | "REQUESTED"
  | "UPLOADED"
  | "PROCESSING"
  | "AVAILABLE"
  | "VERIFIED"
  | "MISMATCH"
  | "EXPIRED"
  | "REJECTED"
  | "REPLACED"
  | "SOURCE_UNAVAILABLE";

export type VerificationMatchState =
  | "MATCH"
  | "PARTIAL_MATCH"
  | "MISMATCH"
  | "NOT_VERIFIABLE"
  | "SOURCE_UNAVAILABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "PENDING_REVIEW";

export type VerificationReviewStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "IN_REVIEW"
  | "RESOLVED";

export type DocumentSource =
  | "DIGILOCKER"
  | "STUDENT_UPLOAD"
  | "STATE_EDISTRICT"
  | "INSTITUTION";

export type DocumentType =
  | "CASTE_CERTIFICATE"
  | "INCOME_CERTIFICATE"
  | "DOMICILE_CERTIFICATE"
  | "AADHAAR_CARD"
  | "MARKSHEET"
  | "ADMISSION_PROOF"
  | "FEE_RECEIPT"
  | "BANK_PASSBOOK"
  | "BONAFIDE_CERTIFICATE"
  | "HOSTEL_CERTIFICATE"
  | "RESEARCH_PROPOSAL";

// ==========================================
// 3. DEFICIENCY & ACTION STATUSES
// ==========================================

export type DeficiencyType =
  | "DOCUMENT_MISSING"
  | "DOCUMENT_INVALID"
  | "DATA_MISMATCH"
  | "INSTITUTION_VERIFICATION_PENDING"
  | "STATE_VERIFICATION_PENDING"
  | "FINANCIAL_DETAILS_ISSUE"
  | "ACADEMIC_INFORMATION_MISMATCH";

export type DeficiencyStatus = "OPEN" | "RESOLVED" | "UNDER_REVIEW" | "WAIVED";

export type RequiredStudentAction =
  | "RE_UPLOAD_DOCUMENT"
  | "SUBMIT_CLARIFICATION"
  | "CONFIRM_ATTRIBUTES"
  | "CONTACT_INSTITUTE";

// ==========================================
// 4. SANCTION & PAYMENT (DBT) STATUSES
// (Separate from Application Status!)
// ==========================================

export type DbtPaymentState =
  | "NOT_INITIATED"
  | "INITIATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "PENDED";

// ==========================================
// 5. JAGO / ASSISTANCE INTENTS
// ==========================================

export type JagoIntent =
  | "SCHOLARSHIP_DISCOVERY"
  | "ELIGIBILITY"
  | "APPLICATION_STATUS"
  | "DOCUMENT_HELP"
  | "DEFICIENCY"
  | "VERIFICATION"
  | "SANCTION"
  | "PAYMENT"
  | "PROFILE"
  | "GENERAL_ASSISTANCE";

// ==========================================
// 6. NOTIFICATION TYPES
// ==========================================

export type NotificationType =
  | "STATUS_CHANGE"
  | "ACTION_REQUIRED"
  | "VERIFICATION_UPDATE"
  | "SANCTION_UPDATE"
  | "PAYMENT_UPDATE"
  | "JAGO_ALERT";

// ==========================================
// 7. SHARED ENTITIES
// ==========================================

/** 1. Student Entity (Sensitive items strictly masked) */
export interface StudentContact {
  phone_masked: string; // e.g. "+91 98XXX-XX210"
  email_masked: string; // e.g. "ash***@gmail.com"
}

export interface StudentLocation {
  state: string;
  district: string;
  block?: string;
  village?: string;
  pincode: string;
  address_masked: string;
}

export interface StudentEducation {
  institution_id: string;
  institution_name: string;
  aishe_code?: string;
  udise_code?: string;
  stage: EducationLevel;
  course: string;
  current_year_or_semester: string;
  academic_year: string;
  roll_no_masked: string;
  is_hosteller: boolean;
}

export interface StudentIdentifierRefs {
  apaar_token: string; // tokenized, e.g. "APAAR-ST-2026-99214"
  digilocker_id_masked: string; // e.g. "DL-ST-***-992"
  masked_aadhaar_last4: string; // Only last 4 digits: e.g. "XXXX-XXXX-8921"
}

export interface StudentProfile {
  student_id: string;
  full_name: string;
  dob: string; // ISO date e.g. "2005-07-14"
  gender: "MALE" | "FEMALE" | "OTHER";
  category: "ST" | "PVTG"; // Particularly Vulnerable Tribal Group
  sub_tribe?: string; // e.g. "Santhal", "Gond", "Bhil", "Birhor"
  contact: StudentContact;
  location: StudentLocation;
  education: StudentEducation;
  identifier_refs: StudentIdentifierRefs;
  profile_status: "VERIFIED" | "PENDING_VERIFICATION" | "ACTION_REQUIRED";
  annual_family_income: number; // e.g. 180000 (INR)
  has_active_scholarship: boolean;
  avatar_url?: string;
}

/** 2. Scholarship Entity (Owned by Rijvan) */
export interface ScholarshipBenefit {
  maintenance_allowance_per_annum: number;
  tuition_fee_coverage: string;
  books_and_stationery_allowance?: number;
  contingency_allowance?: number;
  additional_benefits: string[];
}

export interface Scholarship {
  scheme_id: string;
  scheme_name: string;
  scheme_code: string;
  scheme_type: SchemeType;
  jurisdiction: Jurisdiction;
  ministry: string;
  description: string;
  academic_year: string;
  education_level: EducationLevel;
  target_group: string;
  income_ceiling: number | null; // null when the official source does not publish a machine-readable ceiling
  benefits: ScholarshipBenefit;
  required_documents: {
    document_type: DocumentType;
    document_name: string;
    is_mandatory: boolean;
  }[];
  application_channel: ApplicationChannel;
  portal_name: string;
  status: SchemeStatus;
  start_date: string | null;
  deadline: string | null;
  selection_criteria: string;
  source_system?: string;
  source_url?: string | null;
  source_fetched_at?: string | null;
  source_mode?: "LIVE" | "SNAPSHOT";
  source_evidence?: { source_id: string; source_name: string; source_url: string; fetched_at: string; extraction_method: string; confidence: string }[];
  source_count?: number;
  eligibility_summary?: string;
}

/** 3. Application Entity (Owned by Rijvan) */
export interface TimelineEvent {
  event_id: string;
  stage: ApplicationStage;
  title: string;
  description: string;
  timestamp: string;
  actor: "STUDENT" | "INSTITUTE" | "STATE_DNO" | "MINISTRY" | "PFMS_SYSTEM";
  status: "COMPLETED" | "CURRENT" | "PENDING" | "ALERT";
  action_needed?: string;
}

export interface Application {
  application_id: string;
  student_id: string;
  scheme_id: string;
  scheme_name: string;
  academic_year: string;
  institution_name: string;
  course: string;
  current_stage: ApplicationStage;
  submitted_at: string;
  last_updated_at: string;
  submitted_documents: {
    document_id: string;
    document_type: DocumentType;
    document_name: string;
    source: DocumentSource;
  }[];
  timeline: TimelineEvent[];
  deficiency_ids: string[];
  sanction_id?: string;
  payment_id?: string;
}

/** 4. Document Entity (Owned by Suryaansh) */
export interface DocumentItem {
  document_id: string;
  student_id: string;
  document_type: DocumentType;
  document_name: string;
  source: DocumentSource;
  document_status: DocumentStatus;
  verification_status: VerificationMatchState;
  issuer: string;
  issue_date: string;
  expiry_date?: string;
  uri?: string;
  integrity_hash: string;
  related_application_id?: string;
  file_size_kb?: number;
  uploaded_at: string;
  verified_at?: string;
}

/** 5. Verification Result Entity (Owned by Suryaansh) */
export interface VerificationAttributeCheck {
  verification_id: string;
  entity_type: "STUDENT" | "DOCUMENT" | "INSTITUTE";
  attribute_name: string; // e.g. "Full Name", "Date of Birth", "ST Category", "Annual Income", "College Enrollment"
  claimed_value: string;
  source_name: "DIGILOCKER" | "UDISE_PLUS" | "AISHE" | "APAAR" | "STATE_EDISTRICT" | "UIDAI_TEST";
  source_value: string;
  match_state: VerificationMatchState;
  review_status: VerificationReviewStatus;
  confidence: number; // 0.0 to 1.0
  notes: string;
  verified_at: string;
  action_required_detail?: string;
}

/** 6. Deficiency Entity (Owned by Rijvan) */
export interface Deficiency {
  deficiency_id: string;
  application_id: string;
  scheme_name: string;
  deficiency_type: DeficiencyType;
  title: string;
  description: string;
  affected_field_or_doc: string;
  current_status: DeficiencyStatus;
  required_action: RequiredStudentAction;
  action_instructions: string;
  deadline: string;
  created_at: string;
  resolved_at?: string;
}

/** 7. Sanction & Payment Entity (Separate from Application!) */
export interface SanctionDetails {
  sanction_id: string;
  application_id: string;
  sanction_order_no: string;
  sanction_date: string;
  approved_tuition_fee: number;
  approved_maintenance_allowance: number;
  total_sanctioned_amount: number;
  sanctioning_authority: string;
}

export interface PaymentRecord {
  payment_id: string;
  application_id: string;
  sanction_id: string;
  sanction_amount: number;
  disbursed_amount: number;
  dbt_state: DbtPaymentState;
  pfms_transaction_ref?: string;
  beneficiary_name_masked: string;
  bank_account_masked: string; // e.g. "XXXXXX4512"
  bank_name: string;
  ifsc_masked: string; // e.g. "SBIN0***412"
  disbursement_date?: string;
  failure_or_pending_reason?: string;
  last_updated_at: string;
  steps: {
    name: string;
    state: "COMPLETED" | "CURRENT" | "PENDING" | "FAILED";
    timestamp?: string;
  }[];
}

/** 8. Notification Entity */
export interface NotificationItem {
  notification_id: string;
  student_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  action_url?: string;
  scheme_name?: string;
}

/** 9. Assistance / JAGO Entity */
export interface JagoClientAction {
  type: "NAVIGATE";
  label: string;
  href: string;
}

export interface JagoMessage {
  id: string;
  sender: "STUDENT" | "JAGO";
  text: string;
  timestamp: string;
  intent?: JagoIntent;
  application_id?: string | null;
  sources_cited?: {
    scheme_code?: string;
    title: string;
    url?: string;
  }[];
  suggested_actions?: {
    label: string;
    href: string;
  }[];
  actions?: JagoClientAction[];
  suggested_followups?: string[];
}

/** 10. Eligibility Assessment */
export interface EligibilityCriteriaCheck {
  criteria: string;
  passed: boolean;
  status?: "SATISFIED" | "FAILED" | "MISSING_INFORMATION" | "NEEDS_VERIFICATION" | "NOT_APPLICABLE";
  claimed_value: string | number;
  threshold_or_rule: string;
  explanation: string;
}

export type EligibilityResultStatus =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "FURTHER_REVIEW";

export interface EligibilityEvaluationResult {
  scheme_id: string;
  scheme_name: string;
  status: EligibilityResultStatus;
  overall_verdict: string;
  confidence_score: number;
  checks: EligibilityCriteriaCheck[];
  recommended_actions: string[];
  evaluated_at: string;
}

export interface EligibilityAnswers {
  scheme_id: string;
  category: "ST" | "PVTG" | "OTHER";
  annual_family_income: number;
  education_stage: EducationLevel;
  current_class_or_course: string;
  institution_recognized: boolean;
  institution_state: string;
  has_active_other_scholarship: boolean;
  is_hosteller?: boolean;
}
