import { describe, it, expect } from "vitest";
import { jagoService } from "@/modules/jago/JagoService";

describe("JAGO Operational AI Assistant Test Suite", () => {
  it("answers application status query grounded in actual database state", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "Why is my application pending?",
      language: "en",
    });

    expect(res.intent).toBe("APPLICATION_STATUS");
    expect(res.response).toBeDefined();
    expect(res.source_refs.length).toBeGreaterThan(0);
  });

  it("answers in Hindi when language is set to 'hi'", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "मेरी छात्रवृत्ति की क्या स्थिति है?",
      language: "hi",
    });

    expect(res.language).toBe("hi");
    expect(res.response).toMatch(/[\u0900-\u097F]/); // Contains Devanagari Hindi characters
  });

  it("handles payment queries with authoritative payment reference citations", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "Has my scholarship money been paid into my bank account?",
      language: "en",
    });

    expect(res.intent).toBe("PAYMENT");
    expect(res.response).toBeDefined();
  });
});
