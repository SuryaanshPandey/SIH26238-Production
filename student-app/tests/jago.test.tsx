import { describe, it, expect } from "vitest";
import { jagoApi } from "../lib/api/jago";

describe("JAGO Conversational AI Assistance", () => {
  it("fetches message history containing initial welcome message", async () => {
    const messages = await jagoApi.getMessages();
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].sender).toBe("JAGO");
    expect(messages[0].text).toContain("JAGO");
  });

  it("answers income deficiency query grounded in student records", async () => {
    const reply = await jagoApi.askQuestion("Why is my income certificate flagged as a mismatch?");
    expect(reply.intent).toBe("DEFICIENCY");
    expect(reply.text).toMatch(/open action item|कमी|mismatch|मिसमैच/i);
    expect(reply.text).toMatch(/not the same as an automatic rejection|स्वतः अस्वीकृति|action item/i);
    expect(reply.suggested_actions?.some((a) => a.href === "/actions")).toBe(true);
  });

  it("answers DBT payment questions citing PFMS gateway details", async () => {
    const reply = await jagoApi.askQuestion("When will my scholarship payment arrive?");
    expect(reply.intent).toBe("PAYMENT");
    expect(reply.text).toContain("PFMS");
    expect(reply.text).toContain("PFMS");
    expect(reply.suggested_actions?.some((a) => a.href.includes("/applications/"))).toBe(true);
  });

  it("handles Hindi language queries (accessibility requirement)", async () => {
    const reply = await jagoApi.askQuestion("मुझे हिंदी में सहायता चाहिए");
    expect(reply.text).toContain("नमस्ते");
    expect(reply.text).toMatch(/[\u0900-\u097F]/);
  });
});
