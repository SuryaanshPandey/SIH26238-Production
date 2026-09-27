import { VerificationAttributeCheck } from "../contracts/types";
import { VERIFICATION_API_URL } from "../config";
import { apiFetch } from "./http";

function sourceFromRef(ref?: string | null): VerificationAttributeCheck["source_name"] {
  const value = (ref || "").toLowerCase();
  if (value.startsWith("digilocker:")) return "DIGILOCKER";
  if (value.startsWith("apaar:")) return "APAAR";
  if (value.startsWith("aishe:")) return "AISHE";
  if (value.startsWith("edistrict:")) return "STATE_EDISTRICT";
  if (value.startsWith("uidai:")) return "UIDAI_TEST";
  if (value.startsWith("institution:")) return "AISHE";
  return "STATE_EDISTRICT";
}

function logicalAttribute(v: any): string {
  const field = String(v.subject?.name || "").toLowerCase();
  if (/income_annual|income/.test(field)) return "Annual Family Income";
  if (/category|caste|tribe/.test(field)) return "ST Community Status";
  if (/institution_id|institution_name|education_level|course|enrollment_status|year_of_study/.test(field)) return "College Enrollment & Course";
  if (/date_of_birth|full_name|identifier_last4|identity_status/.test(field)) return field === "date_of_birth" ? "Date of Birth (DOB)" : "Full Name / Identity";
  return v.subject?.name || "Verified Attribute";
}

const rank: Record<string, number> = {
  MISMATCH: 7,
  SOURCE_UNAVAILABLE: 6,
  PENDING_REVIEW: 5,
  PARTIAL_MATCH: 4,
  NOT_VERIFIABLE: 3,
  INSUFFICIENT_EVIDENCE: 2,
  MATCH: 1,
};

function fallbackNote(state: string, source: string): string {
  if (state === "SOURCE_UNAVAILABLE") {
    return `${source} did not return a usable record. This attribute is pending source availability or official review.`;
  }
  if (state === "NOT_VERIFIABLE") {
    return "No authoritative value was available to verify this attribute.";
  }
  if (state === "INSUFFICIENT_EVIDENCE") {
    return "Available evidence was insufficient to complete this verification.";
  }
  return "Verification result recorded by the Documents & Verification service.";
}

function mapVerification(v: any, attributeName?: string): VerificationAttributeCheck {
  const source_name = sourceFromRef(v.source_reference);
  const result = v.result || "NOT_VERIFIABLE";
  const sourceLabel = source_name === "DIGILOCKER" ? "DigiLocker" : source_name.replaceAll("_", " ");
  return {
    verification_id: v.verification_id,
    entity_type: v.subject?.type === "INSTITUTION" ? "INSTITUTE" : "STUDENT",
    attribute_name: attributeName || logicalAttribute(v),
    claimed_value: v.submitted_value ?? "",
    source_name,
    source_value: result === "SOURCE_UNAVAILABLE" ? "Not available" : (v.source_value ?? ""),
    match_state: result,
    review_status: v.review_status || (result === "SOURCE_UNAVAILABLE" ? "PENDING" : "NOT_REQUIRED"),
    confidence: Number(v.confidence ?? 0),
    notes: v.verification_notes || v.notes || fallbackNote(result, sourceLabel),
    verified_at: v.verified_at || v.created_at || new Date().toISOString(),
    action_required_detail: ["MISMATCH", "SOURCE_UNAVAILABLE", "PENDING_REVIEW"].includes(result)
      ? result === "SOURCE_UNAVAILABLE"
        ? "No action is required from you until the official source is available."
        : "This difference is surfaced for review; it is not an automatic rejection."
      : undefined,
  };
}

function dedupeNotes(notes: string[]): string {
  const unique = [...new Set(notes.map((n) => n.trim()).filter(Boolean))];
  return unique.join(" ");
}

function aggregate(raw: any[]): VerificationAttributeCheck[] {
  const groups = new Map<string, VerificationAttributeCheck[]>();
  for (const item of raw) {
    const key = logicalAttribute(item);
    const mapped = mapVerification(item, key);
    const list = groups.get(key) || [];
    list.push(mapped);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort(
      (a, b) =>
        (rank[b.match_state] || 0) - (rank[a.match_state] || 0) ||
        b.confidence - a.confidence ||
        new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()
    );
    const primary = sorted[0];
    const sourceStates = new Set(list.map((x) => x.source_name));
    const states = new Set(list.map((x) => x.match_state));
    const sourceUnavailable = states.has("SOURCE_UNAVAILABLE") && ![...states].some((s) => ["MATCH", "PARTIAL_MATCH", "MISMATCH"].includes(s));

    return {
      ...primary,
      attribute_name: key,
      confidence: Math.max(...list.map((x) => x.confidence)),
      source_value: sourceUnavailable ? "Not available" : primary.source_value,
      notes: dedupeNotes(list.map((x) => x.notes)),
      action_required_detail: sourceUnavailable
        ? "No action is required from you until the official source is available."
        : primary.action_required_detail,
    };
  });
}

export const verificationApi = {
  async getConnectors(): Promise<Array<{ system: string; display_name: string; status: string; government_managed: boolean; live_integration: boolean }>> {
    return apiFetch(`${VERIFICATION_API_URL}/connectors`);
  },
  async getVerificationChecks(applicationId?: string): Promise<VerificationAttributeCheck[]> {
    if (!applicationId) throw new Error("Application ID is required for verification lookup.");
    const raw = await apiFetch<any[]>(`${VERIFICATION_API_URL}/applications/${encodeURIComponent(applicationId)}/verifications`);
    return aggregate(raw);
  },
};
