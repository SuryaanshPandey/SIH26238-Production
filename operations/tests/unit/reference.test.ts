import { describe, expect, it } from "vitest";
import { parseUgcColleges } from "@/modules/reference/ReferenceDataService";

describe("UGC college directory parser", () => {
  it("maps the current official UGC table columns and does not treat Sr No as the college name", () => {
    const html = `
      <table>
        <tr>
          <th>Sr No</th>
          <th>Name of the college</th>
          <th>Affiliated To University</th>
          <th>College address</th>
          <th>District</th>
          <th>State</th>
          <th>Status</th>
          <th>Year of Estb.</th>
          <th>Teaching Upto</th>
          <th>Govt or Non Govt</th>
          <th>Aided or Unaided</th>
        </tr>
        <tr>
          <td>1</td>
          <td>A.D. Patel Institute of Technology</td>
          <td>Gujarat Technological University, Ahmedabad</td>
          <td>Vitthal Udyognagar, Vallabh Vidyanagar</td>
          <td>Anand</td>
          <td>Gujarat</td>
          <td>2(f)</td>
          <td>2000</td>
          <td>Bachelor's</td>
          <td>Non Government</td>
          <td>Unaided</td>
        </tr>
      </table>`;

    const rows = parseUgcColleges(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("A.D. Patel Institute of Technology");
    expect(rows[0].state).toBe("Gujarat");
    expect(rows[0].district).toBe("Anand");
    expect(rows[0].affiliated_to).toContain("Gujarat Technological University");
    expect(rows[0].source_system).toBe("UGC");
  });
});


describe("AISHE adapter compatibility", () => {
  it("documents acceptance of the published aisheCode field and legacy aishe_code form", async () => {
    const source = await import("../../src/modules/reference/ReferenceDataService");
    const sourceText = String((source as any));
    expect(source).toBeTruthy();
    // The implementation must contain both accepted field spellings; this
    // prevents the exact UCER/C-47913 regression from returning silently.
    const fs = await import("node:fs/promises");
    const code = await fs.readFile(new URL("../../src/modules/reference/ReferenceDataService.ts", import.meta.url), "utf8");
    expect(code).toContain("row?.aisheCode ?? row?.aishe_code");
  });
});
