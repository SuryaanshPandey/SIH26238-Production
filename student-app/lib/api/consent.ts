import { LIVE_BACKEND, VERIFICATION_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";

export interface ConsentRecord {
  consent_id: string;
  student_id: string;
  purpose: string;
  status: "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED";
  granted_at?: string | null;
  revoked_at?: string | null;
  source: string;
}

export const consentApi = {
  async grantScholarshipVerificationConsent(): Promise<ConsentRecord | null> {
    if (!LIVE_BACKEND) return null;
    return apiFetch<ConsentRecord>(`${VERIFICATION_API_URL}/consents`, {
      method: "POST",
      body: JSON.stringify({
        student_id: getCurrentStudentId() || "",
        purpose: "SCHOLARSHIP_VERIFICATION",
        source: "APP",
      }),
    });
  },
};
