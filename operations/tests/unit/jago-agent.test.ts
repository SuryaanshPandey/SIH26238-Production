import { describe, it, expect } from "vitest";
import { jagoService } from "@/modules/jago/JagoService";

describe("JAGO Application Agent behavior", () => {
  it("does not make history persistence part of the response path", async () => {
    const started = Date.now();
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "Show all my applications",
      language: "en",
    });
    expect(res.intent).toBe("APPLICATION_STATUS");
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("returns an in-app navigation action for document upload requests", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "I want to upload my income certificate",
      language: "en",
    });
    expect(res.intent).toBe("DOCUMENT_HELP");
    expect(res.suggested_actions?.some((a) => a.href.startsWith("/documents?jagoAction=upload&type=INCOME_CERTIFICATE"))).toBe(true);
  });

  it("gracefully declines unrelated services instead of hallucinating", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "What is the weather today?",
      language: "en",
    });
    expect(res.intent).toBe("GENERAL_ASSISTANCE");
    expect(res.response.toLowerCase()).toContain("outside jago");
  });

  it("does not substitute another application for an explicit unknown application id", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      applicationId: "does_not_exist",
      query: "show this application",
      language: "en",
    });
    expect(res.source_refs).toEqual([]);
    expect(res.response).toContain("Privacy Protection");
  });


  it("answers personal profile questions from the student's own record", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "What is my caste?",
      language: "en",
    });
    expect(res.intent).toBe("PROFILE");
    expect(res.response).toContain("Category:");
    expect(res.response).toContain("Munda");
    expect(res.source_refs).toContain("student:stu_demo_001");
  });

  it("lists applications even when the separate student-profile source is unavailable", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "Show all my applications",
      language: "en",
    });
    expect(res.intent).toBe("APPLICATION_STATUS");
    expect(res.response).toContain("application records");
    expect(res.source_refs.length).toBeGreaterThan(0);
  });

  it("routes required-document questions to document help", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      applicationId: "app_demo_04",
      query: "Which documents are required for this application?",
      language: "en",
    });
    expect(res.intent).toBe("DOCUMENT_HELP");
  });

  it("routes natural application-process language to scholarship discovery", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "How do I apply?",
      language: "en",
    });
    expect(res.intent).toBe("SCHOLARSHIP_DISCOVERY");
  });

  it("understands application-stuck and update language", async () => {
    const res = await jagoService.processQuery({
      studentId: "stu_demo_001",
      applicationId: "app_demo_04",
      query: "Any update? My application is stuck.",
      language: "en",
    });
    expect(res.intent).toBe("APPLICATION_STATUS");
    expect(res.application_id).toBe("app_demo_04");
  });

  it("keeps the previous application as context for a vague follow-up", async () => {
    const first = await jagoService.processQuery({
      studentId: "stu_demo_001",
      applicationId: "app_demo_04",
      query: "Show this application",
      language: "en",
    });
    expect(first.application_id).toBe("app_demo_04");

    const second = await jagoService.processQuery({
      studentId: "stu_demo_001",
      query: "What should I do next?",
      language: "en",
    });
    expect(second.intent).toBe("APPLICATION_STATUS");
    expect(second.application_id).toBe("app_demo_04");
    expect(second.response.toLowerCase()).toContain("next step");
  });
});
