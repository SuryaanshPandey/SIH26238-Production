import { describe, it, expect } from "vitest";
import { MockPFMSClient } from "@/adapters/payment/MockPFMSClient";

describe("Payment & PFMS Adapter Test Suite", () => {
  const client = new MockPFMSClient();

  it("initiates payment and returns PFMS transaction reference", async () => {
    const res = await client.initiatePayment("pay_test_01", 52400, "XXXXXXXX9832", "SBIN0000123");
    expect(res.status).toBe("PROCESSING");
    expect(res.paymentReference).toContain("PFMS-TXN");
  });

  it("simulates SUCCESS outcome correctly", async () => {
    const res = await client.simulatePayment("pay_test_01", "SUCCESS");
    expect(res.status).toBe("SUCCESS");
    expect(res.completedAt).toBeDefined();
    expect(res.failureReason).toBeNull();
  });

  it("simulates FAILED outcome with documented failure reason", async () => {
    const res = await client.simulatePayment("pay_test_02", "FAILED", "ACCOUNT_INVALID");
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe("ACCOUNT_INVALID");
  });
});
