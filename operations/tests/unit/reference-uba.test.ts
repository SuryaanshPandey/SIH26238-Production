import { describe, expect, it } from "vitest";
import { parseUbaInstitutions } from "@/modules/reference/ReferenceDataService";

describe("UBA institution directory parser", () => {
  it("finds UCER from the published UBA table shape", () => {
    const html = `
      <table>
        <tr><th>ID</th><th>Institute Name</th><th>Aishe Code</th><th>Districts</th><th>Coordinator</th><th>Email ID</th></tr>
        <tr><td>118</td><td>United College of Engineering and Research, Allahabad</td><td>C-47913</td><td>Prayagraj</td><td>Coordinator</td><td>example@united.ac.in</td></tr>
      </table>`;

    const rows = parseUbaInstitutions(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      institution_id: "C-47913",
      name: "United College of Engineering and Research, Allahabad",
      district: "Prayagraj",
      state: "Uttar Pradesh",
      source_system: "UBA",
      source_mode: "LIVE",
    });
  });

  it("does not lose the name when table markup lacks a usable header", () => {
    const html = `
      <table>
        <tr><td>118</td><td>United College of Engineering and Research, Allahabad</td><td>C-47913</td><td>Prayagraj</td></tr>
      </table>`;
    const rows = parseUbaInstitutions(html);
    expect(rows[0]?.institution_id).toBe("C-47913");
    expect(rows[0]?.name).toContain("United College of Engineering");
  });
});
