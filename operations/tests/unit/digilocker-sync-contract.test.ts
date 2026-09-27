import fs from "node:fs";
import path from "node:path";

describe("DigiLocker issued-document sync contract", () => {
  const root = process.cwd();
  const service = fs.readFileSync(path.join(root, "src/modules/government/DigiLockerService.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "src/app/api/v1/government/digilocker/documents/sync/route.ts"), "utf8");
  const client = fs.readFileSync(path.join(root, "src/adapters/document/HttpDocumentClient.ts"), "utf8");

  it("uses the official issued-document endpoint and bearer authorization", () => {
    expect(service).toContain("digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued");
    expect(service).toContain("Authorization: `Bearer ${token}");
    expect(service).toContain("syncIssuedDocuments");
  });

  it("persists fetched documents through the document service", () => {
    expect(client).toContain("createDocument");
    expect(client).toContain("/documents");
    expect(route).toContain("syncIssuedDocuments(user.sub)");
  });
});
