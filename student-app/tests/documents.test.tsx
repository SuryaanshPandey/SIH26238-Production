import { describe, it, expect } from "vitest";
import { documentsApi } from "../lib/api/documents";

describe("Document Wallet & DigiLocker Integration", () => {
  it("fetches wallet documents with provenance sources", async () => {
    const docs = await documentsApi.getDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(4);

    const sources = docs.map((d) => d.source);
    expect(sources).toContain("STATE_EDISTRICT");
    expect(sources).toContain("DIGILOCKER");
    expect(sources).toContain("INSTITUTION");
  });

  it("synchronizes certificates from DigiLocker", async () => {
    const syncRes = await documentsApi.syncDigiLocker();
    expect(syncRes.synced_count).toBeGreaterThan(0);
    expect(syncRes.message).toContain("DigiLocker");
  });

  it("uploads or replaces a document in the wallet", async () => {
    const updated = await documentsApi.uploadOrReplaceDocument({
      document_type: "HOSTEL_CERTIFICATE",
      document_name: "BIT Sindri Hostel Warden Certificate 2026",
      issuer: "Chief Hostel Warden",
      issue_date: "2026-08-01",
      source: "STUDENT_UPLOAD",
    });

    expect(updated.document_id).toBeDefined();
    expect(updated.document_name).toBe("BIT Sindri Hostel Warden Certificate 2026");
    expect(updated.document_status).toBe("UPLOADED");
  });
});
