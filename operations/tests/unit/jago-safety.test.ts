import { describe, it, expect } from "vitest";
import { jagoService } from "@/modules/jago/JagoService";

describe("JAGO Safety & Identity Boundary Test Suite", () => {
  it("enforces student identity boundary when accessing another student's application", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_002", // Requesting as student 2
      applicationId: "app_demo_03", // Application belongs to student 1 (stu_demo_001)
      query: "Give me details on this application",
      language: "en",
    });

    expect(res.response).toContain("Privacy Protection");
    expect(res.response).not.toContain("another student's");
    expect(res.source_refs.length).toBe(0);
  });

  it("handles unknown or general queries with helpful, grounded guidance", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "How can I contact the Ministry helpline?",
      language: "en",
    });

    expect(res.intent).toBe("GENERAL_ASSISTANCE");
    expect(res.response).toBeDefined();
    expect(res.response.length).toBeGreaterThan(10);
  });
});
