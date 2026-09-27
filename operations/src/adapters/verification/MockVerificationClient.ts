import { VerificationClient, VerificationSummary } from "./VerificationClient";
import { VerificationContract } from "@contracts/v1/types";

export class MockVerificationClient implements VerificationClient {
  private verifications: Map<string, VerificationContract[]> = new Map();

  constructor() {
    this.seedDefaultVerifications();
  }

  private seedDefaultVerifications() {
    this.verifications.set("app_demo_verif_01", [
      {
        verification_id: "verif_caste_001",
        application_id: "app_demo_verif_01",
        attribute_name: "CASTE_ST",
        status: "MATCH",
        confidence: 0.99,
        source_system: "StateRevenuePortal_Jharkhand",
        evidence_refs: ["doc_caste_valid_01"],
        verification_notes: "Caste verified against official State ST Registry.",
        verified_at: new Date().toISOString(),
      },
      {
        verification_id: "verif_income_001",
        application_id: "app_demo_verif_01",
        attribute_name: "INCOME_THRESHOLD",
        status: "MATCH",
        confidence: 0.98,
        source_system: "StateRevenuePortal_Jharkhand",
        evidence_refs: ["doc_income_valid_01"],
        verification_notes: "Income verified below scheme maximum ₹2.5L limit.",
        verified_at: new Date().toISOString(),
      },
      {
        verification_id: "verif_inst_001",
        application_id: "app_demo_verif_01",
        attribute_name: "INSTITUTION_ENROLLMENT",
        status: "MATCH",
        confidence: 0.95,
        source_system: "AISHE_MHRD_GATEWAY",
        evidence_refs: ["doc_inst_verif_01"],
        verification_notes: "Active enrollment confirmed by university portal.",
        verified_at: new Date().toISOString(),
      },
      {
        verification_id: "verif_ident_001",
        application_id: "app_demo_verif_01",
        attribute_name: "AADHAAR_IDENTITY",
        status: "MATCH",
        confidence: 1.0,
        source_system: "UIDAI_TOKEN_CONNECTOR",
        evidence_refs: ["ev_token_aadhaar_8921"],
        verification_notes: "Biometric KYC token validation successful.",
        verified_at: new Date().toISOString(),
      },
    ]);
  }

  async getVerificationByApplication(applicationId: string): Promise<VerificationContract[]> {
    return this.verifications.get(applicationId) || [];
  }

  async getVerificationSummary(applicationId: string): Promise<VerificationSummary> {
    const list = await this.getVerificationByApplication(applicationId);
    const matchesCount = list.filter((v) => v.status === "MATCH").length;
    const mismatchesCount = list.filter((v) => v.status === "MISMATCH").length;
    const sourceUnavailableCount = list.filter((v) => v.status === "SOURCE_UNAVAILABLE").length;
    const pendingReviewCount = list.filter((v) => v.status === "PENDING_REVIEW" || v.status === "PARTIAL_MATCH").length;

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
    return list.find((v) => v.attribute_name === attribute) || null;
  }

  async simulateVerification(
    applicationId: string,
    scenario: "MATCH" | "MISMATCH" | "SOURCE_UNAVAILABLE" | "PARTIAL_MATCH" = "MATCH",
    _context?: import("./VerificationClient").VerificationRunContext
  ): Promise<VerificationContract[]> {
    const now = new Date().toISOString();
    let records: VerificationContract[] = [];

    if (scenario === "MATCH") {
      records = [
        {
          verification_id: `verif_caste_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "CASTE_ST",
          status: "MATCH",
          confidence: 0.99,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_caste_valid"],
          verification_notes: "ST category confirmed.",
          verified_at: now,
        },
        {
          verification_id: `verif_income_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "INCOME_THRESHOLD",
          status: "MATCH",
          confidence: 0.98,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_income_valid"],
          verification_notes: "Income threshold satisfied.",
          verified_at: now,
        },
        {
          verification_id: `verif_inst_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "INSTITUTION_ENROLLMENT",
          status: "MATCH",
          confidence: 0.95,
          source_system: "AISHE",
          evidence_refs: ["doc_inst_valid"],
          verification_notes: "Enrollment valid.",
          verified_at: now,
        },
      ];
    } else if (scenario === "MISMATCH") {
      records = [
        {
          verification_id: `verif_caste_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "CASTE_ST",
          status: "MATCH",
          confidence: 0.99,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_caste_valid"],
          verification_notes: "ST category confirmed.",
          verified_at: now,
        },
        {
          verification_id: `verif_income_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "INCOME_THRESHOLD",
          status: "MISMATCH",
          confidence: 0.92,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_income_mismatch"],
          verification_notes: "Income records show income ₹3,40,000, exceeding ₹2.5L limit.",
          verified_at: now,
        },
        {
          verification_id: `verif_inst_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "INSTITUTION_ENROLLMENT",
          status: "MATCH",
          confidence: 0.95,
          source_system: "AISHE",
          evidence_refs: ["doc_inst_valid"],
          verification_notes: "Enrollment valid.",
          verified_at: now,
        },
      ];
    } else if (scenario === "SOURCE_UNAVAILABLE") {
      records = [
        {
          verification_id: `verif_caste_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "CASTE_ST",
          status: "MATCH",
          confidence: 0.99,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_caste_valid"],
          verification_notes: "ST category confirmed.",
          verified_at: now,
        },
        {
          verification_id: `verif_aishe_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "INSTITUTION_ENROLLMENT",
          status: "SOURCE_UNAVAILABLE",
          confidence: 0.0,
          source_system: "AISHE_MHRD_GATEWAY",
          evidence_refs: [],
          verification_notes: "State gateway timeout (HTTP 504). Source currently unreachable.",
          verified_at: now,
        },
      ];
    } else {
      records = [
        {
          verification_id: `verif_caste_${Date.now()}`,
          application_id: applicationId,
          attribute_name: "CASTE_ST",
          status: "PARTIAL_MATCH",
          confidence: 0.75,
          source_system: "StateRevenuePortal",
          evidence_refs: ["doc_caste_valid"],
          verification_notes: "Sub-tribe name variant requires clarification.",
          verified_at: now,
        },
      ];
    }

    this.verifications.set(applicationId, records);
    return records;
  }
}

export const mockVerificationClient = new MockVerificationClient();
