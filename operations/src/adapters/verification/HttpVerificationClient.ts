import { DocumentContract, StudentContract, VerificationContract } from "@contracts/v1/types";
import { fetchJson } from "@/adapters/httpClient";
import { VerificationClient, VerificationRunContext, VerificationSummary } from "./VerificationClient";

type RemoteSourceRecord = {
  source_system: string;
  source_reference: string;
  status: "FOUND" | "NOT_FOUND" | "UNAVAILABLE";
  subject_id: string;
  attributes: Record<string, unknown>;
  retrieved_at: string;
  response_hash?: string | null;
  document_type?: string | null;
  institution_id?: string | null;
  metadata?: Record<string, string>;
};

function sourceNameFromReference(reference?: string | null): string {
  const value = (reference || "").toLowerCase();
  if (value.startsWith("digilocker:")) return "DigiLocker";
  if (value.startsWith("apaar:")) return "APAAR";
  if (value.startsWith("aishe:")) return "AISHE";
  if (value.startsWith("edistrict:")) return "StateRevenuePortal";
  if (value.startsWith("uidai:")) return "UIDAI_TOKEN";
  if (value.startsWith("institution:")) return "INSTITUTION";
  return "SuryaanshVerificationService";
}


function mapRemoteVerification(raw: any): VerificationContract {
  const sourceReference = raw.source_reference ?? raw.evidence_refs?.[0] ?? null;
  const sourceSystem = sourceNameFromReference(sourceReference);
  return {
    verification_id: String(raw.verification_id),
    application_id: String(raw.application_id),
    attribute_name: String(raw.subject?.name || raw.attribute_name || "VERIFIED_ATTRIBUTE"),
    status: (raw.result ?? raw.status ?? "NOT_VERIFIABLE") as VerificationContract["status"],
    confidence: Number(raw.confidence ?? 0),
    source_system: sourceSystem,
    evidence_refs: Array.isArray(raw.evidence_ids) ? raw.evidence_ids.map(String) : (Array.isArray(raw.evidence_refs) ? raw.evidence_refs.map(String) : []),
    verification_notes: raw.verification_notes ?? raw.notes ?? null,
    verified_at: String(raw.verified_at ?? raw.created_at ?? new Date().toISOString()),
  };
}

function rank(status: VerificationContract["status"]): number {
  return ({
    MISMATCH: 7,
    SOURCE_UNAVAILABLE: 6,
    PENDING_REVIEW: 5,
    PARTIAL_MATCH: 4,
    NOT_VERIFIABLE: 3,
    INSUFFICIENT_EVIDENCE: 2,
    MATCH: 1,
  } as const)[status];
}

export class HttpVerificationClient implements VerificationClient {
  constructor(private readonly baseUrl: string) {}

  private endpoint(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async querySource(
    system: string,
    student: StudentContract,
    attributes: string[],
    consentId: string,
  ): Promise<RemoteSourceRecord | null> {
    try {
      return await fetchJson<RemoteSourceRecord>(this.endpoint("/source-records/query"), {
        method: "POST",
        body: JSON.stringify({
          system,
          student_id: student.student_id,
          attributes,
          institution_id: student.institution_id,
          state: student.domicile_state,
          authorized: true,
          purpose: "SCHOLARSHIP_VERIFICATION",
          consent_id: consentId,
        }),
      });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      const status = (error as any)?.status;
      const code = (error as any)?.code;
      if (status === 503 || code === "SOURCE_UNAVAILABLE") {
        return {
          source_system: system,
          source_reference: `${system.toLowerCase()}:unavailable:${student.student_id}`,
          status: "UNAVAILABLE",
          subject_id: student.student_id,
          attributes: {},
          retrieved_at: new Date().toISOString(),
          response_hash: null,
          institution_id: student.institution_id,
          metadata: { adapter_mode: "HTTP", reason: "SOURCE_UNAVAILABLE" },
        };
      }
      throw error;
    }
  }

  private buildSubmitted(student: StudentContract): Record<string, unknown> {
    return {
      full_name: `${student.first_name} ${student.last_name}`.trim(),
      date_of_birth: student.date_of_birth,
      category: student.category,
      income_annual: student.annual_family_income,
      domicile_state: student.domicile_state,
      institution_id: student.institution_id,
      institution_name: student.institution_name,
      education_level: student.education_level,
      course: student.course_name,
      ...(student.masked_aadhaar && student.masked_aadhaar !== "NOT_AVAILABLE"
        ? { identifier_last4: student.masked_aadhaar.slice(-4) }
        : {}),
    };
  }

  private toLogicalChecks(applicationId: string, records: VerificationContract[]): VerificationContract[] {
    const groups: Record<string, VerificationContract[]> = {};
    for (const record of records) {
      let logical = "";
      const subjectName = String((record as any).subject?.name || "").toLowerCase();
      const source = sourceNameFromReference(record.evidence_refs?.[0]);
      if (/income_annual|income/.test(subjectName)) logical = "INCOME_THRESHOLD";
      else if (/category|caste|tribe/.test(subjectName)) logical = "CASTE_ST";
      else if (/institution_id|institution_name|education_level|course|enrollment_status|year_of_study/.test(subjectName)) logical = "INSTITUTION_ENROLLMENT";
      else if (/date_of_birth|full_name|identifier_last4|identity_status/.test(subjectName)) logical = "AADHAAR_IDENTITY";
      else {
        const lowerRef = (record.evidence_refs?.[0] || "").toLowerCase();
        if (lowerRef.startsWith("edistrict:")) logical = "INCOME_THRESHOLD";
        else if (lowerRef.startsWith("aishe:") || lowerRef.startsWith("institution:")) logical = "INSTITUTION_ENROLLMENT";
        else logical = "AADHAAR_IDENTITY";
      }
      groups[logical] ||= [];
      groups[logical].push({ ...record, verification_id: `${applicationId}:${logical}:${record.verification_id}` });
    }

    return Object.entries(groups).map(([attribute, list]) => {
      const sorted = [...list].sort((a, b) => rank(b.status) - rank(a.status) || b.confidence - a.confidence);
      const primary = sorted[0];
      return {
        ...primary,
        attribute_name: attribute,
        confidence: Math.max(...list.map(v => v.confidence ?? 0)),
        evidence_refs: [...new Set(list.flatMap(v => v.evidence_refs || []))],
        verification_notes: list.map(v => v.verification_notes).filter(Boolean).join(" ") || primary.verification_notes,
      };
    });
  }

  async getVerificationByApplication(applicationId: string): Promise<VerificationContract[]> {
    const raw = await fetchJson<any[]>(this.endpoint(`/applications/${encodeURIComponent(applicationId)}/verifications`));
    return raw.map(mapRemoteVerification);
  }

  async getVerificationSummary(applicationId: string): Promise<VerificationSummary> {
    const list = await this.getVerificationByApplication(applicationId);
    const matchesCount = list.filter(v => v.status === "MATCH").length;
    const mismatchesCount = list.filter(v => v.status === "MISMATCH").length;
    const sourceUnavailableCount = list.filter(v => v.status === "SOURCE_UNAVAILABLE").length;
    const pendingReviewCount = list.filter(v => v.status === "PENDING_REVIEW" || v.status === "PARTIAL_MATCH").length;
    return {
      isFullyVerified: list.length > 0 && matchesCount === list.length,
      hasMismatch: mismatchesCount > 0,
      hasSourceUnavailable: sourceUnavailableCount > 0,
      matchesCount,
      mismatchesCount,
      sourceUnavailableCount,
      pendingReviewCount,
      verifications: list,
    };
  }

  async getVerificationByAttribute(applicationId: string, attribute: string): Promise<VerificationContract | null> {
    const list = await this.getVerificationByApplication(applicationId);
    return list.find(v => v.attribute_name === attribute) || null;
  }

  async simulateVerification(applicationId: string, scenario: "MATCH" | "MISMATCH" | "SOURCE_UNAVAILABLE" | "PARTIAL_MATCH" = "MATCH", context?: VerificationRunContext): Promise<VerificationContract[]> {
    if (!context) throw new Error("Verification context is required for the HTTP verification provider");

    const student = context.student;
    const consentResponse = await fetchJson<{ consent_id: string }>(
      this.endpoint(`/consents/latest?student_id=${encodeURIComponent(student.student_id)}&purpose=${encodeURIComponent("SCHOLARSHIP_VERIFICATION")}`)
    );
    const consentId = consentResponse.consent_id;
    if (!consentId) throw new Error("Verification consent is required");

    const queried = await Promise.all([
      this.querySource("DIGILOCKER", student, ["full_name", "date_of_birth", "category"], consentId),
      this.querySource("APAAR", student, ["full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course"], consentId),
      this.querySource("AISHE", student, ["institution_id", "institution_name", "education_level", "course"], consentId),
      this.querySource("STATE_EDISTRICT", student, ["full_name", "category", "income_annual", "domicile_state"], consentId),
      this.querySource("INSTITUTION", student, ["full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course", "enrollment_status", "year_of_study"], consentId),
      this.querySource("UIDAI", student, ["full_name", "date_of_birth", "identity_status", "identifier_last4"], consentId),
    ]);

    const sourceRecords = queried.filter(Boolean) as RemoteSourceRecord[];
    if (!sourceRecords.length) throw new Error("No verification source returned a usable record");

    const remoteResult = await fetchJson<{ verification_ids: string[] }>(this.endpoint("/verifications/run"), {
      method: "POST",
      body: JSON.stringify({
        application_id: applicationId,
        student_id: student.student_id,
        submitted_attributes: this.buildSubmitted(student),
        source_records: sourceRecords,
        document_ids: context.documents.map(d => d.document_id),
      }),
    });

    const verified: VerificationContract[] = [];
    for (const verificationId of remoteResult.verification_ids || []) {
      try {
        const remote = await fetchJson<any>(this.endpoint(`/verifications/${encodeURIComponent(verificationId)}`));
        verified.push(mapRemoteVerification(remote));
      } catch (error) {
        throw new Error(`Verification result ${verificationId} could not be retrieved: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
    const logical = this.toLogicalChecks(applicationId, verified);

    // In the real HTTP provider, the source/verification service is authoritative.
    // Scenario overrides are retained only for the deterministic mock provider used by tests.
    if (scenario !== "MATCH") {
      throw new Error("Synthetic verification scenarios are disabled in real-data mode.");
    }

    // Keep remoteResult referenced so a contract-breaking remote server cannot silently be ignored.
    if (!remoteResult.verification_ids) throw new Error("Verification service returned no verification IDs");
    return logical;
  }
}
