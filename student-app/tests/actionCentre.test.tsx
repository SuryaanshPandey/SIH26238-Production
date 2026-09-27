import { describe, it, expect } from "vitest";
import { applicationApi } from "../lib/api/application";

describe("Action Centre & Deficiency Resolution", () => {
  it("retrieves open deficiencies for student applications", async () => {
    const defs = await applicationApi.getDeficiencies();
    expect(defs.length).toBeGreaterThan(0);

    const incomeDef = defs.find((d) => d.deficiency_type === "DATA_MISMATCH");
    expect(incomeDef).toBeDefined();
    expect(incomeDef?.current_status).toBe("OPEN");
    expect(incomeDef?.required_action).toBe("SUBMIT_CLARIFICATION");
  });

  it("resolves a deficiency and routes the application to official review rather than rejecting", async () => {
    const resolved = await applicationApi.resolveDeficiency("DEF-2026-001", {
      action: "SUBMIT_CLARIFICATION",
      clarificationText: "Attaching verified latest income certificate from Tehsildar.",
      replacementDocName: "Updated_Income_Cert.pdf",
    });

    expect(resolved.current_status).toBe("RESOLVED");
    expect(resolved.resolved_at).toBeDefined();

    // Verify application state transitioned to UNDER_REVIEW
    const app = await applicationApi.getApplicationById(resolved.application_id);
    expect(app?.current_stage).toBe("UNDER_REVIEW");

    // Verify timeline includes clarification event
    const lastEvent = app?.timeline[app.timeline.length - 1];
    expect(lastEvent?.title).toContain("Deficiency Clarification Submitted");
    expect(lastEvent?.actor).toBe("STUDENT");
  });
});
