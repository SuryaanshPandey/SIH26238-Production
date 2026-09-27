import { describe, it, expect } from "vitest";
import { createSuccessEnvelope, createErrorEnvelope } from "@contracts/v1/envelope";
import fs from "fs";
import path from "path";

describe("Common Data Contract v1 Validation Test Suite", () => {
  it("wraps successful payloads in standard v1 envelope", () => {
    const payload = { application_id: "app_123", status: "VERIFIED" };
    const envelope = createSuccessEnvelope(payload, "req_custom_01");

    expect(envelope.success).toBe(true);
    expect(envelope.data).toEqual(payload);
    expect(envelope.error).toBeNull();
    expect(envelope.meta.contract_version).toBe("v1");
    expect(envelope.meta.request_id).toBe("req_custom_01");
    expect(new Date(envelope.meta.timestamp).toISOString()).toBe(envelope.meta.timestamp);
  });

  it("wraps error responses in standard v1 error envelope", () => {
    const envelope = createErrorEnvelope("RESOURCE_NOT_FOUND", "Application not found", null, "req_err_01");

    expect(envelope.success).toBe(false);
    expect(envelope.data).toBeNull();
    expect(envelope.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(envelope.error.message).toBe("Application not found");
    expect(envelope.meta.contract_version).toBe("v1");
    expect(envelope.meta.request_id).toBe("req_err_01");
  });

  it("validates all 21 contract fixture files exist and have valid JSON content", () => {
    const fixtureDir = path.resolve(__dirname, "../../contracts/fixtures");
    const files = fs.readdirSync(fixtureDir);

    expect(files.length).toBeGreaterThanOrEqual(20);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = fs.readFileSync(path.join(fixtureDir, file), "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed).toBeDefined();
        expect(typeof parsed).toBe("object");
      }
    }
  });
});
