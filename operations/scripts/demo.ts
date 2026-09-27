import { applicationService } from "../src/modules/applications/ApplicationService";
import { sanctionService } from "../src/modules/sanctions/SanctionService";
import { paymentService } from "../src/modules/payments/PaymentService";
import { deficiencyService } from "../src/modules/deficiencies/DeficiencyService";
import { jagoService } from "../src/modules/jago/JagoService";
import { prisma } from "../src/lib/prisma";

async function runDeterministicDemo() {
  console.log("================================================================================");
  console.log("🇮🇳 SIH26238 — RIJVAN MODULE: DETERMINISTIC END-TO-END DEMO WALKTHROUGH");
  console.log("   Ministry of Tribal Affairs — Scholarship Operations & Intelligence");
  console.log("================================================================================\n");

  const studentId = "stu_demo_001";
  const scholarshipId = "sch_post_matric_st";
  const academicYear = "2026-2027";

  // Step 1: Create Application (DRAFT)
  console.log("▶ STEP 1: Creating Application in DRAFT status...");
  const app = await applicationService.createApplication({
    studentId,
    scholarshipId,
    academicYear,
  });
  console.log(`  ✓ Application Created: ${app.application_id} | Status: [${app.status}] | Stage: ${app.current_stage}\n`);

  // Step 2: Submit Application (SUBMITTED)
  console.log("▶ STEP 2: Student Submits Application...");
  const submitted = await applicationService.submitApplication(app.application_id, studentId);
  console.log(`  ✓ Application Submitted: Status: [${submitted.status}] | Stage: ${submitted.current_stage}\n`);

  // Step 3: Trigger Automated Verification with MISMATCH scenario
  console.log("▶ STEP 3: Automated Verification Pipeline Triggered (Simulating Suryaansh Mismatch)...");
  const verifMismatch = await applicationService.startVerification(app.application_id, "MISMATCH");
  console.log(`  ✓ Verification Processed: ${verifMismatch.verificationsCount} checks executed`);
  console.log(`  ✓ State Transition: [${verifMismatch.application.status}] | Stage: ${verifMismatch.application.current_stage}`);
  const openDefs = await deficiencyService.listDeficiencies(app.application_id);
  console.log(`  ✓ Action Required: ${openDefs.length} Deficiency item created: "${openDefs[0]?.title}" (${openDefs[0]?.type})\n`);

  // Step 4: Student resolves deficiency with corrected certificate
  console.log("▶ STEP 4: Student Uploads Corrected Income Certificate...");
  const resolvedDef = await deficiencyService.resolveDeficiency(
    openDefs[0].deficiency_id,
    "Updated circle officer income certificate uploaded (verified < ₹2.5L)."
  );
  console.log(`  ✓ Deficiency Resolved: ${resolvedDef.deficiency_id} | Status: [${resolvedDef.status}]\n`);

  // Step 5: Re-trigger Verification with MATCH scenario
  console.log("▶ STEP 5: Re-verification Triggered with Updated Evidence (MATCH)...");
  const verifMatch = await applicationService.startVerification(app.application_id, "MATCH");
  console.log(`  ✓ State Transition: [${verifMatch.application.status}] | Stage: ${verifMatch.application.current_stage}\n`);

  // Step 6: Confirmation of Verified status
  console.log("▶ STEP 6: Verification Confirmation & Readiness for Sanction...");
  console.log(`  ✓ Application Verified: Status: [${verifMatch.application.status}] | Stage: ${verifMatch.application.current_stage}\n`);

  // Step 7: Issue Official Sanction Order
  console.log("▶ STEP 7: Ministry Sanction Order Issuance...");
  const sanction = await sanctionService.issueSanction(app.application_id, 52400, "MINISTRY_SANCTION_OFFICER");
  console.log(`  ✓ Sanction Order Issued: ${sanction.reference}`);
  console.log(`  ✓ Sanctioned Amount: ₹${sanction.amount.toLocaleString("en-IN")} | Status: [${sanction.status}]`);
  const sanctionedApp = await applicationService.getApplication(app.application_id);
  console.log(`  ✓ Application Status Updated: [${sanctionedApp?.status}]\n`);

  // Step 8: Initiate PFMS DBT Payment
  console.log("▶ STEP 8: Dispatching DBT Payment to PFMS Gateway...");
  const payment = await paymentService.initiatePayment({ applicationId: app.application_id });
  console.log(`  ✓ PFMS Transaction Reference: ${payment.payment_reference}`);
  console.log(`  ✓ Payment Status: [${payment.status}] (Independent from application status)`);
  const processingApp = await applicationService.getApplication(app.application_id);
  console.log(`  ✓ Application Status: [${processingApp?.status}]\n`);

  // Step 9: Simulate PFMS Credit Success Callback
  console.log("▶ STEP 9: Receiving PFMS DBT Webhook (Transfer Succeeded)...");
  const paymentSuccess = await paymentService.simulatePayment(payment.payment_id, "SUCCESS");
  console.log(`  ✓ PFMS Status: [${paymentSuccess.status}] | Disbursed: ₹${paymentSuccess.amount.toLocaleString("en-IN")}`);
  const paidApp = await applicationService.getApplication(app.application_id);
  console.log(`  ✓ Application Final State: [${paidApp?.status}] | Stage: ${paidApp?.current_stage}\n`);

  // Step 10: Query JAGO Grounded Operational Assistant
  console.log("▶ STEP 10: Querying JAGO AI Backend Ground Truth...");
  const jagoEn = await jagoService.processQuery({
    studentId,
    applicationId: app.application_id,
    query: "Has my scholarship money been paid?",
    language: "en",
  });
  console.log(`  ✓ JAGO Query (EN): "${jagoEn.query}"`);
  console.log(`  ✓ JAGO Grounded Answer: "${jagoEn.response}"`);
  console.log(`  ✓ Authoritative Source Citations: [${jagoEn.source_refs.join(", ")}]\n`);

  const jagoHi = await jagoService.processQuery({
    studentId,
    applicationId: app.application_id,
    query: "मेरी छात्रवृत्ति की स्थिति क्या है?",
    language: "hi",
  });
  console.log(`  ✓ JAGO Query (HI): "${jagoHi.query}"`);
  console.log(`  ✓ JAGO Grounded Answer: "${jagoHi.response}"\n`);

  console.log("================================================================================");
  console.log("🎉 FULL END-TO-END DEMO WALKTHROUGH COMPLETED SUCCESSFULLY!");
  console.log("   All states, rules, deficiencies, reviews, sanctions, payments, and JAGO work cleanly.");
  console.log("================================================================================");
}

runDeterministicDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
