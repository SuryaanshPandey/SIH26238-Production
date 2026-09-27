import { describe, it, expect } from "vitest";
import { paymentApi } from "../lib/api/payment";

describe("Sanction Order & PFMS DBT Payment Tracking", () => {
  it("fetches sanction details with tuition and maintenance breakdown", async () => {
    const sanction = await paymentApi.getSanctionByAppId("APP-2025-ST-39102");
    expect(sanction).toBeDefined();
    expect(sanction?.sanction_order_no).toBe("MOTA/TC/2025-26/9921");
    expect(sanction?.approved_tuition_fee).toBe(32500);
    expect(sanction?.approved_maintenance_allowance).toBe(36000);
    expect(sanction?.total_sanctioned_amount).toBe(68500);
  });

  it("fetches PFMS DBT payment record with masked bank account", async () => {
    const payment = await paymentApi.getPaymentByAppId("APP-2025-ST-39102");
    expect(payment).toBeDefined();
    expect(payment?.dbt_state).toBe("PROCESSING");
    expect(payment?.pfms_transaction_ref).toBe("PFMS2026MOTA882194");
    // Verify security requirement: Bank account is strictly masked!
    expect(payment?.bank_account_masked).toBe("XXXXXX4512");
    expect(payment?.bank_account_masked).not.toMatch(/^\d{11,}$/);
    expect(payment?.steps.length).toBeGreaterThan(0);
  });
});
