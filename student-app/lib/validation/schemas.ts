import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(3, "Please enter your Mobile Number, Student ID, or Email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid date of birth"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  category: z.enum(["ST", "PVTG"]),
  subTribe: z.string().optional(),
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
  state: z.string().min(2, "State is required"),
  stateCode: z.string().regex(/^\d+$/, "Please select a valid state from the official directory"),
  district: z.string().min(2, "District is required"),
  districtCode: z.string().regex(/^\d+$/, "Please select a valid district from the official directory"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  institutionName: z.string().min(3, "Institution name is required"),
  institutionId: z.string().optional(),
  institutionSourceSystem: z.string().optional(),
  institutionSourceReference: z.string().optional(),
  institutionSourceUrl: z.string().url().optional(),
  course: z.string().min(2, "Course / Class is required"),
  stage: z.enum([
    "PRE_MATRIC",
    "POST_MATRIC",
    "HIGHER_EDUCATION",
    "FELLOWSHIP",
    "OVERSEAS",
  ]),
  annualIncome: z.coerce.number().min(0, "Income cannot be negative"),
  consentDigilocker: z.boolean(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const eligibilityAnswersSchema = z.object({
  scheme_id: z.string().min(1, "Please select a scheme"),
  category: z.enum(["ST", "PVTG", "OTHER"]),
  annual_family_income: z.coerce.number().min(0, "Income cannot be negative"),
  education_stage: z.enum([
    "PRE_MATRIC",
    "POST_MATRIC",
    "HIGHER_EDUCATION",
    "FELLOWSHIP",
    "OVERSEAS",
  ]),
  current_class_or_course: z.string().min(1, "Course or class is required"),
  institution_recognized: z.boolean(),
  institution_state: z.string().min(1, "Institution state is required"),
  has_active_other_scholarship: z.boolean(),
  is_hosteller: z.boolean().optional(),
});

export type EligibilityFormValues = z.infer<typeof eligibilityAnswersSchema>;

export const deficiencyResolutionSchema = z.object({
  action: z.enum(["RE_UPLOAD_DOCUMENT", "SUBMIT_CLARIFICATION", "CONFIRM_ATTRIBUTES"]),
  clarificationText: z
    .string()
    .min(10, "Please provide a clear explanation (minimum 10 characters)"),
  replacementDocName: z.string().optional(),
});

export type DeficiencyResolutionValues = z.infer<typeof deficiencyResolutionSchema>;

export const documentUploadSchema = z.object({
  document_type: z.enum([
    "CASTE_CERTIFICATE",
    "INCOME_CERTIFICATE",
    "DOMICILE_CERTIFICATE",
    "AADHAAR_CARD",
    "MARKSHEET",
    "ADMISSION_PROOF",
    "FEE_RECEIPT",
    "BANK_PASSBOOK",
    "BONAFIDE_CERTIFICATE",
    "HOSTEL_CERTIFICATE",
    "RESEARCH_PROPOSAL",
  ]),
  document_name: z.string().min(2, "Document name is required"),
  issuer: z.string().min(2, "Issuing authority is required"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid issue date required"),
  expiry_date: z.string().optional(),
});

export type DocumentUploadValues = z.infer<typeof documentUploadSchema>;
