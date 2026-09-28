import { describe, it, expect } from "vitest";
import { applicationApi } from "../lib/api/application";
import { paymentApi } from "../lib/api/payment";

describe("Application Lifecycle & Payment Separation", () => {
  it("retrieves existing student applications", async () => {
    const apps = await applicationApi.getApplications();
    expect(apps.length).toBeGreaterThanOrEqual(2);

    const postMatric = apps.find((a) => a.scheme_id === "mota-post-matric-2026");
    expect(postMatric).toBeDefined();
    expect(postMatric?.current_stage).toBe("ACTION_REQUIRED");
  });

  it("submits a new application and returns a valid application record", async () => {
    const newApp = await applicationApi.submitApplication({
      scheme_id: "mota-top-class-2026",
      student_id: "STU-2026-JH-88391",
      course: "B.Tech Computer Science",
      is_hosteller: true,
      submitted_document_ids: ["DOC-ST-001", "DOC-ST-003"],
      consent_granted: true,
    });

    expect(newApp.application_id).toMatch(/^APP-2026-ST-\d+$/);
    expect(newApp.current_stage).toBe("SUBMITTED");
    expect(newApp.timeline.length).toBeGreaterThan(0);
    expect(newApp.timeline[0].stage).toBe("SUBMITTED");
  });

  it("verifies that Application status and Payment status are separate concepts", async () => {
    // Contract requirement: Application status and Payment status are separate!
    const topClassApp = await applicationApi.getApplicationById("APP-2025-ST-39102");
    expect(topClassApp).toBeDefined();
    expect(topClassApp?.current_stage).toBe("SANCTIONED");

    const payment = await paymentApi.getPaymentByAppId("APP-2025-ST-39102");
    expect(payment).toBeDefined();
    expect(payment?.dbt_state).toBe("PROCESSING");
    expect(payment?.sanction_amount).toBe(68500);

    // Application stage is SANCTIONED while DBT payment state is PROCESSING
    expect(topClassApp?.current_stage).not.toBe(payment?.dbt_state);
  });
});
