import { DocumentContract } from "@contracts/v1/types";

export interface CreateDocumentParams {
  student_id: string;
  application_id: string;
  document_type: string;
  source: "DIGITAL_SOURCE" | "USER_UPLOAD" | "INSTITUTION_SOURCE" | "GOVERNMENT_SOURCE" | "MOCK_SOURCE";
  status?: "REQUESTED" | "UPLOADED" | "PROCESSING" | "AVAILABLE" | "VERIFIED" | "MISMATCH" | "EXPIRED" | "REJECTED" | "REPLACED" | "SOURCE_UNAVAILABLE";
  issued_at?: string | null;
  expires_at?: string | null;
  issuer?: string | null;
  storage_ref?: string | null;
  integrity?: { hash: string } | null;
}

export interface DocumentClient {
  getDocumentsByStudentId(studentId: string): Promise<DocumentContract[]>;
  getDocumentById(documentId: string): Promise<DocumentContract | null>;
  createDocument?(params: CreateDocumentParams): Promise<any>;
}
