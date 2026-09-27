import { DocumentContract } from "@contracts/v1/types";
import { DocumentClient, CreateDocumentParams } from "./DocumentClient";
import { fetchJson } from "@/adapters/httpClient";

export class HttpDocumentClient implements DocumentClient {
  constructor(private readonly baseUrl: string) {}

  private headers(): HeadersInit {
    const headers: Record<string, string> = {};
    const apiKey = process.env.VERIFICATION_SERVICE_API_KEY || process.env.SIH_API_KEY;
    if (apiKey) headers["X-SIH-API-Key"] = apiKey;
    return headers;
  }

  async getDocumentsByStudentId(studentId: string): Promise<DocumentContract[]> {
    return fetchJson<DocumentContract[]>(
      `${this.baseUrl.replace(/\/$/, "")}/students/${encodeURIComponent(studentId)}/documents`,
      { headers: this.headers() },
    );
  }

  async getDocumentById(documentId: string): Promise<DocumentContract | null> {
    try {
      return await fetchJson<DocumentContract>(
        `${this.baseUrl.replace(/\/$/, "")}/documents/${encodeURIComponent(documentId)}`,
        { headers: this.headers() },
      );
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  }

  async createDocument(params: CreateDocumentParams): Promise<any> {
    return fetchJson<any>(
      `${this.baseUrl.replace(/\/$/, "")}/documents`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(params),
      },
    );
  }
}
