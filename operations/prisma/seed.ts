import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.DEMO_MODE !== "true") {
    console.log("ℹ️ REAL_DATA_MODE is enabled; demo seed skipped. Official-source sync populates scholarships at runtime.");
    return;
  }
  console.log("🌱 Starting SIH26238 Rijvan Module Database Seed...");

  // 1. Clean existing records safely
  await prisma.auditEvent.deleteMany();
  await prisma.jagoAssistance.deleteMany();
  await prisma.beneficiaryCandidate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.sanction.deleteMany();
  await prisma.reviewHistory.deleteMany();
  await prisma.reviewCase.deleteMany();
  await prisma.deficiencyHistory.deleteMany();
  await prisma.deficiency.deleteMany();
  await prisma.eligibilityRuleResult.deleteMany();
  await prisma.eligibilityEvaluation.deleteMany();
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.scholarshipRule.deleteMany();
  await prisma.scholarshipRuleVersion.deleteMany();
  await prisma.scholarship.deleteMany();

  // 2. Seed 5 Official ST Scholarship Schemes
  const scholarshipsData = [
    {
      scholarshipId: "sch_pre_matric_st",
      schemeName: "Pre-Matric Scholarship for ST Students",
      schemeCode: "PRE-ST-2026",
      schemeType: "PRE_MATRIC",
      academicYear: "2026-2027",
      status: "ACTIVE",
      jurisdiction: "Ministry of Tribal Affairs, Govt of India",
      eligibilityRuleVersion: "v1.0",
      applicationStartDate: new Date("2026-07-01"),
      applicationEndDate: new Date("2026-12-31"),
      requiredDocumentTypes: JSON.stringify(["CASTE_CERTIFICATE", "INCOME_CERTIFICATE", "SCHOOL_ID"]),
      benefitSummary: JSON.stringify({ maintenance_allowance_annual: 3500, book_grant_annual: 1000, maximum_amount: 4500 }),
      applicationChannel: "ONLINE_PORTAL",
    },
    {
      scholarshipId: "sch_post_matric_st",
      schemeName: "Post-Matric Scholarship for ST Students",
      schemeCode: "PMS-ST-2026",
      schemeType: "POST_MATRIC",
      academicYear: "2026-2027",
      status: "ACTIVE",
      jurisdiction: "Ministry of Tribal Affairs, Govt of India",
      eligibilityRuleVersion: "v1.0",
      applicationStartDate: new Date("2026-07-01"),
      applicationEndDate: new Date("2026-11-30"),
      requiredDocumentTypes: JSON.stringify(["CASTE_CERTIFICATE", "INCOME_CERTIFICATE", "MARKSHEET", "INSTITUTION_VERIFICATION"]),
      benefitSummary: JSON.stringify({ maintenance_allowance_annual: 14400, tuition_fee_annual: 35000, book_grant_annual: 3000, maximum_amount: 52400 }),
      applicationChannel: "ONLINE_PORTAL",
    },
    {
      scholarshipId: "sch_higher_ed_st",
      schemeName: "National Fellowship and Scholarship for Higher Education of ST Students",
      schemeCode: "NFST-HIGHER-2026",
      schemeType: "HIGHER_EDUCATION",
      academicYear: "2026-2027",
      status: "ACTIVE",
      jurisdiction: "Ministry of Tribal Affairs, Govt of India",
      eligibilityRuleVersion: "v1.0",
      applicationStartDate: new Date("2026-06-01"),
      applicationEndDate: new Date("2026-10-31"),
      requiredDocumentTypes: JSON.stringify(["CASTE_CERTIFICATE", "INCOME_CERTIFICATE", "TOP_INSTITUTION_ADMISSION", "FEE_RECEIPT"]),
      benefitSummary: JSON.stringify({ tuition_fee_annual: 200000, living_expenses_annual: 36000, books_annual: 5000, maximum_amount: 241000 }),
      applicationChannel: "ONLINE_PORTAL",
    },
    {
      scholarshipId: "sch_fellowship_st",
      schemeName: "National Fellowship for ST Students",
      schemeCode: "NFST-RESEARCH-2026",
      schemeType: "FELLOWSHIP",
      academicYear: "2026-2027",
      status: "ACTIVE",
      jurisdiction: "Ministry of Tribal Affairs, Govt of India",
      eligibilityRuleVersion: "v1.0",
      applicationStartDate: new Date("2026-05-01"),
      applicationEndDate: new Date("2026-10-15"),
      requiredDocumentTypes: JSON.stringify(["CASTE_CERTIFICATE", "PHD_REGISTRATION", "UGC_NET_CERTIFICATE", "SYNOPSIS"]),
      benefitSummary: JSON.stringify({ fellowship_monthly: 31000, contingency_annual: 20000, maximum_amount: 392000 }),
      applicationChannel: "ONLINE_PORTAL",
    },
    {
      scholarshipId: "sch_overseas_st",
      schemeName: "National Overseas Scholarship for ST Students",
      schemeCode: "NOS-ST-2026",
      schemeType: "OVERSEAS",
      academicYear: "2026-2027",
      status: "ACTIVE",
      jurisdiction: "Ministry of Tribal Affairs, Govt of India",
      eligibilityRuleVersion: "v1.0",
      applicationStartDate: new Date("2026-04-01"),
      applicationEndDate: new Date("2026-08-31"),
      requiredDocumentTypes: JSON.stringify(["CASTE_CERTIFICATE", "PASSPORT", "FOREIGN_UNIVERSITY_OFFER", "INCOME_CERTIFICATE"]),
      benefitSummary: JSON.stringify({ tuition_fee_foreign: 1800000, maintenance_annual: 700000, maximum_amount: 2500000 }),
      applicationChannel: "ONLINE_PORTAL",
    },
  ];

  for (const item of scholarshipsData) {
    await prisma.scholarship.create({
      data: {
        ...item,
        ruleVersions: {
          create: {
            version: "v1.0",
            effectiveFrom: item.applicationStartDate,
            isActive: true,
            description: "Production baseline scheme rules (SIH Demo)",
            rules: {
              create: [
                {
                  ruleCode: "CATEGORY_ST",
                  ruleName: "Scheduled Tribe Category",
                  category: "DEMOGRAPHIC",
                  conditionType: "EQUALS",
                  parameters: JSON.stringify({ category: "ST" }),
                  errorMessage: "Applicant must belong to Scheduled Tribes.",
                },
                {
                  ruleCode: "INCOME_LIMIT",
                  ruleName: "Annual Income Limit",
                  category: "FINANCIAL",
                  conditionType: "LESS_THAN_OR_EQUAL",
                  parameters: JSON.stringify({ maxIncome: 250000 }),
                  errorMessage: "Family income must be within scheme limits.",
                },
              ],
            },
          },
        },
      },
    });
  }

  console.log("✅ Seeded 5 ST Scholarship Master Schemes.");

  // 3. Seed Applications spanning the complete state matrix
  const seededApps = [
    {
      applicationId: "app_demo_01",
      studentId: "stu_demo_incomplete",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "DRAFT",
      currentStage: "STUDENT_ENTRY",
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_02",
      studentId: "stu_demo_002",
      scholarshipId: "sch_pre_matric_st",
      academicYear: "2026-2027",
      status: "SUBMITTED",
      currentStage: "SUBMITTED_FOR_VERIFICATION",
      submittedAt: new Date("2026-09-21T08:30:00Z"),
      institutionId: "inst_manipur_high_02",
    },
    {
      applicationId: "app_demo_03",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "UNDER_VERIFICATION",
      currentStage: "AUTOMATED_VERIFICATION",
      submittedAt: new Date("2026-09-22T10:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_04",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "ACTION_REQUIRED",
      currentStage: "DEFICIENCY_RESOLUTION",
      submittedAt: new Date("2026-09-20T11:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_05",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "UNDER_REVIEW",
      currentStage: "DESK_OFFICER_REVIEW",
      submittedAt: new Date("2026-09-19T09:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_06",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "VERIFIED",
      currentStage: "READY_FOR_SANCTION",
      submittedAt: new Date("2026-09-18T14:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_07",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "SANCTIONED",
      currentStage: "SANCTION_ISSUED",
      submittedAt: new Date("2026-09-17T11:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_08",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "PAYMENT_PROCESSING",
      currentStage: "PFMS_DBT_DISBURSEMENT",
      submittedAt: new Date("2026-09-16T10:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_09",
      studentId: "stu_demo_001",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "PAID",
      currentStage: "DISBURSED_TO_ACCOUNT",
      submittedAt: new Date("2026-09-15T09:00:00Z"),
      institutionId: "inst_ranchi_univ_01",
    },
    {
      applicationId: "app_demo_10",
      studentId: "stu_demo_non_st",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "REJECTED",
      currentStage: "APPLICATION_REJECTED",
      submittedAt: new Date("2026-09-14T08:00:00Z"),
      institutionId: "inst_du_01",
    },
  ];

  seededApps.push(
    {
      applicationId: "APP-2026-ST-84091",
      studentId: "STU-2026-JH-88391",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2026-2027",
      status: "ACTION_REQUIRED",
      currentStage: "DEFICIENCY_RESOLUTION",
      submittedAt: new Date("2026-08-18T10:30:00Z"),
      institutionId: "INST-JH-00412",
    },
    {
      applicationId: "APP-2025-ST-39102",
      studentId: "STU-2026-JH-88391",
      scholarshipId: "sch_post_matric_st",
      academicYear: "2025-2026",
      status: "SANCTIONED",
      currentStage: "SANCTION_ISSUED",
      submittedAt: new Date("2025-08-10T12:00:00Z"),
      institutionId: "INST-JH-00412",
    },
  );

  for (const app of seededApps) {
    await prisma.application.create({
      data: {
        ...app,
        statusHistory: {
          create: {
            fromStatus: "NONE",
            toStatus: app.status,
            actorType: "SYSTEM",
            actorId: "SEED_ROUTER",
            reason: `Seeded in state ${app.status}`,
            correlationId: `corr_seed_${app.applicationId}`,
          },
        },
      },
    });
  }

  // 4. Seed Deficiencies
  await prisma.deficiency.create({
    data: {
      deficiencyId: "def_income_mismatch_01",
      applicationId: "app_demo_04",
      type: "DATA_MISMATCH",
      title: "Income Certificate Discrepancy",
      description: "Certificate scan indicates ₹3,40,000 whereas portal declaration is ₹1,80,000.",
      severity: "HIGH",
      status: "OPEN",
      requiredAction: "REUPLOAD_DOCUMENT",
      dueAt: new Date(Date.now() + 14 * 86400000),
    },
  });

  await prisma.deficiency.create({
    data: {
      deficiencyId: "def_caste_clarified_01",
      applicationId: "app_demo_06",
      type: "DOCUMENT_INVALID",
      title: "Sub-Tribe Seal Blurred",
      description: "The digital seal on sub-tribe document was blurred in initial scan.",
      severity: "MEDIUM",
      status: "RESOLVED",
      requiredAction: "REUPLOAD_DOCUMENT",
      dueAt: new Date(Date.now() + 10 * 86400000),
      resolvedAt: new Date("2026-09-23T09:15:00Z"),
    },
  });

  await prisma.deficiency.create({
    data: {
      deficiencyId: "def_asha_income_mismatch",
      applicationId: "APP-2026-ST-84091",
      type: "DATA_MISMATCH",
      title: "Annual Family Income Mismatch",
      description: "Student-declared annual income is ₹1,80,000 while the State e-District source record reports ₹2,40,000. The discrepancy is surfaced for official review; it is not an automatic rejection.",
      severity: "HIGH",
      status: "OPEN",
      requiredAction: "CLARIFICATION",
      dueAt: new Date("2026-10-10T23:59:59Z"),
    },
  });

  // 5. Seed Review Case
  await prisma.reviewCase.create({
    data: {
      reviewId: "rev_demo_01",
      applicationId: "app_demo_05",
      reason: "Manual verification required due to revenue portal timeout during automated run.",
      severity: "MEDIUM",
      status: "ASSIGNED",
      assignedReviewer: "OFFICER_RAMESH_TIRKEY",
    },
  });

  await prisma.sanction.create({
    data: {
      sanctionId: "sanc_asha_2025",
      applicationId: "APP-2025-ST-39102",
      status: "ISSUED",
      amount: 52400,
      currency: "INR",
      reference: "SANCTION-MTA-2025-ASHA-001",
      sanctionedAt: new Date("2026-08-25T11:00:00Z"),
    },
  });

  await prisma.payment.create({
    data: {
      paymentId: "pay_asha_2025",
      applicationId: "APP-2025-ST-39102",
      status: "PROCESSING",
      amount: 52400,
      currency: "INR",
      paymentReference: "PFMS-ASHA-2026-001",
      initiatedAt: new Date("2026-09-10T14:00:00Z"),
      source: "PFMS_DBT",
    },
  });

  // 6. Seed Sanctions & Payments
  await prisma.sanction.create({
    data: {
      sanctionId: "sanc_demo_07",
      applicationId: "app_demo_07",
      status: "ISSUED",
      amount: 52400,
      reference: "SANCTION-MTA-2026-0042",
      sanctionedAt: new Date("2026-09-22T14:30:00Z"),
    },
  });

  await prisma.sanction.create({
    data: {
      sanctionId: "sanc_demo_08",
      applicationId: "app_demo_08",
      status: "ISSUED",
      amount: 52400,
      reference: "SANCTION-MTA-2026-0039",
      sanctionedAt: new Date("2026-09-21T11:00:00Z"),
    },
  });

  await prisma.payment.create({
    data: {
      paymentId: "pay_demo_08",
      applicationId: "app_demo_08",
      status: "PROCESSING",
      amount: 52400,
      paymentReference: "PFMS-TXN-2026-9901",
      initiatedAt: new Date("2026-09-22T15:00:00Z"),
      source: "PFMS_DBT",
    },
  });

  await prisma.sanction.create({
    data: {
      sanctionId: "sanc_demo_09",
      applicationId: "app_demo_09",
      status: "ISSUED",
      amount: 52400,
      reference: "SANCTION-MTA-2026-0012",
      sanctionedAt: new Date("2026-09-18T10:00:00Z"),
    },
  });

  await prisma.payment.create({
    data: {
      paymentId: "pay_demo_09",
      applicationId: "app_demo_09",
      status: "SUCCESS",
      amount: 52400,
      paymentReference: "PFMS-TXN-2026-8841",
      initiatedAt: new Date("2026-09-18T11:00:00Z"),
      completedAt: new Date("2026-09-19T14:00:00Z"),
      source: "PFMS_DBT",
    },
  });

  // 7. Seed Beneficiary Candidates
  await prisma.beneficiaryCandidate.create({
    data: {
      candidateId: "cand_proactive_001",
      studentId: "stu_ext_aishe_881",
      potentialScholarshipId: "sch_post_matric_st",
      schemeName: "Post-Matric Scholarship for ST Students",
      reasonCode: "ENROLLED_WITHOUT_ACTIVE_BENEFIT",
      reason: "Student is verified ST enrolled in 2nd year B.Tech at NIT Jamshedpur with family income ₹1.4L, but has no active scholarship application on the portal.",
      confidence: 0.94,
      status: "PENDING_REVIEW",
      evidenceIds: JSON.stringify(["ev_aishe_nit_881", "ev_state_caste_881"]),
    },
  });

  await prisma.beneficiaryCandidate.create({
    data: {
      candidateId: "cand_proactive_002",
      studentId: "stu_ext_udise_992",
      potentialScholarshipId: "sch_post_matric_st",
      schemeName: "Post-Matric Scholarship for ST Students",
      reasonCode: "ENROLLED_WITHOUT_ACTIVE_BENEFIT",
      reason: "Enrolled in Class 11 at EMRS with confirmed ST tribal registry and income below ₹1L. Potential beneficiary gap identified.",
      confidence: 0.91,
      status: "PENDING_REVIEW",
      evidenceIds: JSON.stringify(["ev_emrs_ranchi_992", "ev_caste_cert_jh_992"]),
    },
  });

  // 8. Seed Audit Log Events
  await prisma.auditEvent.create({
    data: {
      auditEventId: "audit_init_001",
      actorType: "ADMIN",
      actorId: "SYSTEM_INITIALIZER",
      action: "DATABASE_SEEDED",
      entityType: "SCHOLARSHIP",
      entityId: "sch_post_matric_st",
      reason: "Initial government scheme catalogue seeded successfully.",
      correlationId: "corr_seed_init",
    },
  });

  console.log("✅ Seeded applications, deficiencies, reviews, sanctions, payments, candidates, and audit trail.");
  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
