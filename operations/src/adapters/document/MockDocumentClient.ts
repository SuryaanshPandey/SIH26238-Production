import { DocumentClient } from "./DocumentClient";
import { DocumentContract } from "@contracts/v1/types";

export class MockDocumentClient implements DocumentClient {
  private documents: Map<string, DocumentContract[]> = new Map();

  constructor() {
    this.seedDefaultDocuments();
  }

  private seedDefaultDocuments() {
    this.documents.set("stu_demo_001", [
      {
        document_id: "doc_caste_valid_01",
        student_id: "stu_demo_001",
        document_type: "CASTE_CERTIFICATE",
        status: "VERIFIED",
        issuer_authority: "Revenue Officer, Govt of Jharkhand",
        issue_date: "2023-01-15T00:00:00Z",
        expiry_date: null,
        document_ref: "sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
        verified_at: "2026-09-23T10:16:00Z",
      },
      {
        document_id: "doc_income_valid_01",
        student_id: "stu_demo_001",
        document_type: "INCOME_CERTIFICATE",
        status: "VERIFIED",
        issuer_authority: "Circle Officer, Ranchi",
        issue_date: "2026-04-10T00:00:00Z",
        expiry_date: "2027-03-31T23:59:59Z",
        document_ref: "sha256:e8b2b9148d88b438b432a58b68b7538cb40e6c6fa71391d4ffbc7d358be85ec0",
        verified_at: "2026-09-23T10:16:30Z",
      },
      {
        document_id: "doc_marksheet_01",
        student_id: "stu_demo_001",
        document_type: "MARKSHEET",
        status: "VERIFIED",
        issuer_authority: "JAC Ranchi",
        issue_date: "2024-06-01T00:00:00Z",
        expiry_date: null,
        document_ref: "sha256:91b456...marksheet_hash",
        verified_at: "2026-09-23T10:17:00Z",
      },
      {
        document_id: "doc_inst_verif_01",
        student_id: "stu_demo_001",
        document_type: "INSTITUTION_VERIFICATION",
        status: "VERIFIED",
        issuer_authority: "Dean Academic, Ranchi University",
        issue_date: "2026-07-20T00:00:00Z",
        expiry_date: null,
        document_ref: "sha256:321a98...inst_hash",
        verified_at: "2026-09-23T10:17:15Z",
      },
    ]);

    this.documents.set("STU-2026-JH-88391", [
      { document_id: "doc_asha_caste", student_id: "STU-2026-JH-88391", document_type: "CASTE_CERTIFICATE", status: "VERIFIED", issuer_authority: "Government of Jharkhand", issue_date: "2026-01-15T00:00:00Z", expiry_date: null, document_ref: "government://edistrict/asha-caste", verified_at: "2026-09-24T09:00:00Z" },
      { document_id: "doc_asha_income", student_id: "STU-2026-JH-88391", document_type: "INCOME_CERTIFICATE", status: "MISMATCH", issuer_authority: "Circle Officer, Kanke", issue_date: "2026-05-10T00:00:00Z", expiry_date: "2027-05-09T23:59:59Z", document_ref: "upload://asha-income-2026", verified_at: "2026-09-24T09:00:30Z" },
      { document_id: "doc_asha_bonafide", student_id: "STU-2026-JH-88391", document_type: "INSTITUTION_VERIFICATION", status: "VERIFIED", issuer_authority: "BIT Sindri Dean Academic Affairs", issue_date: "2026-07-28T00:00:00Z", expiry_date: "2027-06-30T23:59:59Z", document_ref: "institution://bitsindri/asha-bonafide", verified_at: "2026-09-24T09:01:00Z" },
    ]);
  }


  async getDocumentsByStudentId(studentId: string): Promise<DocumentContract[]> {
    return this.documents.get(studentId) || [];
  }

  async getDocumentById(documentId: string): Promise<DocumentContract | null> {
    for (const docList of this.documents.values()) {
      const found = docList.find((d) => d.document_id === documentId);
      if (found) return found;
    }
    return null;
  }
}

export const mockDocumentClient = new MockDocumentClient();
