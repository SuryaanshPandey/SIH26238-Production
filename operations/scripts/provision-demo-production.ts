import "dotenv/config";
import crypto from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRMATION = "SIH26238-PRODUCTION-DEMO-2026";

const DEMO = {
  studentId: "STU-2026-JH-88391",
  mobileNumber: "9000000001",
  email: "asha.sih26238.demo@example.invalid",
  password: "LocalTest@2026!",

  firstName: "Asha",
  lastName: "Kumar",
  dateOfBirth: new Date("2005-07-14T00:00:00.000Z"),
  gender: "FEMALE",
  category: "ST",
  subTribe: "Munda",
  annualFamilyIncome: 180000,

  state: "Jharkhand",
  stateLgdCode: "20",
  district: "Dhanbad",
  districtLgdCode: "346",
  pincode: "828120",

  institutionId: "INST-JH-00412",
  institutionName: "Birsa Institute of Technology (BIT) Sindri",
  institutionSourceSystem: "AISHE",

  educationLevel: "UNDERGRADUATE",
  courseName: "B.Tech Computer Science",
  currentAcademicYear: "2026-2027",

  maskedAadhaar: "XXXX-XXXX-1234",
  bankAccountMasked: "XXXXXX7890",
  bankIfsc: "SBIN0000001",

  apaarToken: "NOT_CONNECTED",
  digilockerIdMasked: "DL-DEMO-****",
};

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");

  const derived = crypto.scryptSync(
    password,
    salt,
    64,
  ).toString("hex");

  return `${salt}:${derived}`;
}

async function ensureStatusHistory(
  tx: PrismaClient,
  applicationId: string,
  toStatus: string,
  correlationId: string,
  reason: string,
) {
  const existing = await tx.applicationStatusHistory.findFirst({
    where: {
      applicationId,
      toStatus,
      correlationId,
    },
  });

  if (existing) {
    return existing;
  }

  return tx.applicationStatusHistory.create({
    data: {
      applicationId,
      fromStatus: "NONE",
      toStatus,
      actorType: "SYSTEM",
      actorId: "PRODUCTION_DEMO_PROVISIONER",
      reason,
      correlationId,
    },
  });
}

async function main() {
  console.log("");
  console.log("==============================================================");
  console.log("SIH26238 PRODUCTION DEMO PROVISIONER");
  console.log("==============================================================");

  if (
    process.env.CONFIRM_PRODUCTION_DEMO !== CONFIRMATION
  ) {
    throw new Error(
      [
        "Safety check failed.",
        "",
        "Before running this script, set:",
        `CONFIRM_PRODUCTION_DEMO=${CONFIRMATION}`,
      ].join("\n"),
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to continue.",
    );
  }

  console.log("✓ Safety confirmation accepted.");
  console.log("✓ DATABASE_URL is present.");

  /*
   * Everything below runs inside one transaction.
   *
   * If any part fails, PostgreSQL rolls back the entire provisioning
   * operation rather than leaving a partially-created demo account.
   */
  await prisma.$transaction(
    async (tx) => {
      // ----------------------------------------------------------
      // 1. Verify production scholarship catalogue.
      // ----------------------------------------------------------

      console.log("");
      console.log("1. Checking production scholarship catalogue...");

      const scholarship = await tx.scholarship.findFirst({
        where: {
          academicYear: "2026-2027",
          status: "ACTIVE",
          sourceSystem: {
            not: "LOCAL",
          },
          OR: [
            {
              schemeName: {
                contains: "Post-Matric",
                mode: "insensitive",
              },
            },
            {
              schemeName: {
                contains: "Post Matric",
                mode: "insensitive",
              },
            },
            {
              schemeCode: {
                contains: "PMS",
                mode: "insensitive",
              },
            },
          ],
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          scholarshipId: true,
          schemeName: true,
          schemeCode: true,
          academicYear: true,
          status: true,
          sourceSystem: true,
          sourceUrl: true,
        },
      });

      if (!scholarship) {
        throw new Error(
          [
            "No active official 2026-2027 Post-Matric scholarship was found.",
            "",
            "The script will NOT create a fake/local scholarship.",
            "Verify that the official scholarship catalogue is populated",
            "in the production Operations database before running this job.",
          ].join("\n"),
        );
      }

      console.log(
        `✓ Scholarship found: ${scholarship.schemeName}`,
      );
      console.log(
        `  ID           : ${scholarship.scholarshipId}`,
      );
      console.log(
        `  Code         : ${scholarship.schemeCode}`,
      );
      console.log(
        `  AcademicYear : ${scholarship.academicYear}`,
      );
      console.log(
        `  Source       : ${scholarship.sourceSystem}`,
      );

      const scholarshipId = scholarship.scholarshipId;

      // ----------------------------------------------------------
      // 2. Check for conflicting mobile/email/student ID.
      // ----------------------------------------------------------

      console.log("");
      console.log("2. Checking demo identity uniqueness...");

      const existingByMobile =
        await tx.studentAccount.findUnique({
          where: {
            mobileNumber: DEMO.mobileNumber,
          },
        });

      const existingByEmail =
        await tx.studentAccount.findUnique({
          where: {
            email: DEMO.email,
          },
        });

      const existingByStudentId =
        await tx.studentAccount.findUnique({
          where: {
            studentId: DEMO.studentId,
          },
        });

      if (
        existingByEmail &&
        existingByMobile &&
        existingByEmail.id !== existingByMobile.id
      ) {
        throw new Error(
          "Demo email belongs to a different production student account.",
        );
      }

      if (
        existingByStudentId &&
        existingByMobile &&
        existingByStudentId.id !== existingByMobile.id
      ) {
        throw new Error(
          "Demo studentId belongs to a different production student account.",
        );
      }

      if (
        existingByStudentId &&
        !existingByMobile
      ) {
        throw new Error(
          `Student ID ${DEMO.studentId} already belongs to a different account.`,
        );
      }

      if (
        existingByEmail &&
        !existingByMobile
      ) {
        throw new Error(
          `Email ${DEMO.email} already belongs to a different account.`,
        );
      }

      console.log("✓ No identity conflict detected.");

      // ----------------------------------------------------------
      // 3. Upsert demo StudentAccount.
      // ----------------------------------------------------------

      console.log("");
      console.log("3. Provisioning demo StudentAccount...");

      const passwordHash = hashPassword(DEMO.password);

      const student = await tx.studentAccount.upsert({
        where: {
          mobileNumber: DEMO.mobileNumber,
        },

        create: {
          studentId: DEMO.studentId,
          mobileNumber: DEMO.mobileNumber,
          email: DEMO.email,
          passwordHash,

          firstName: DEMO.firstName,
          lastName: DEMO.lastName,
          dateOfBirth: DEMO.dateOfBirth,
          gender: DEMO.gender,
          category: DEMO.category,
          subTribe: DEMO.subTribe,
          annualFamilyIncome: DEMO.annualFamilyIncome,

          state: DEMO.state,
          stateLgdCode: DEMO.stateLgdCode,
          district: DEMO.district,
          districtLgdCode: DEMO.districtLgdCode,
          pincode: DEMO.pincode,

          institutionId: DEMO.institutionId,
          institutionName: DEMO.institutionName,
          institutionSourceSystem:
            DEMO.institutionSourceSystem,

          educationLevel: DEMO.educationLevel,
          courseName: DEMO.courseName,
          currentAcademicYear:
            DEMO.currentAcademicYear,

          maskedAadhaar: DEMO.maskedAadhaar,
          bankAccountMasked:
            DEMO.bankAccountMasked,
          bankIfsc: DEMO.bankIfsc,

          apaarToken: DEMO.apaarToken,
          digilockerIdMasked:
            DEMO.digilockerIdMasked,
        },

        update: {
          studentId: DEMO.studentId,
          email: DEMO.email,
          passwordHash,

          firstName: DEMO.firstName,
          lastName: DEMO.lastName,
          dateOfBirth: DEMO.dateOfBirth,
          gender: DEMO.gender,
          category: DEMO.category,
          subTribe: DEMO.subTribe,
          annualFamilyIncome:
            DEMO.annualFamilyIncome,

          state: DEMO.state,
          stateLgdCode: DEMO.stateLgdCode,
          district: DEMO.district,
          districtLgdCode:
            DEMO.districtLgdCode,
          pincode: DEMO.pincode,

          institutionId:
            DEMO.institutionId,
          institutionName:
            DEMO.institutionName,
          institutionSourceSystem:
            DEMO.institutionSourceSystem,

          educationLevel:
            DEMO.educationLevel,
          courseName:
            DEMO.courseName,
          currentAcademicYear:
            DEMO.currentAcademicYear,

          maskedAadhaar:
            DEMO.maskedAadhaar,
          bankAccountMasked:
            DEMO.bankAccountMasked,
          bankIfsc:
            DEMO.bankIfsc,

          apaarToken:
            DEMO.apaarToken,
          digilockerIdMasked:
            DEMO.digilockerIdMasked,
        },
      });

      console.log(
        `✓ Student account ready: ${student.studentId}`,
      );
      console.log(
        `  Mobile: ${student.mobileNumber}`,
      );

      // ----------------------------------------------------------
      // 4. Current action-required application.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "4. Provisioning action-required application...",
      );

      const actionApplication =
        await tx.application.upsert({
          where: {
            applicationId:
              "APP-2026-ST-84091",
          },

          create: {
            applicationId:
              "APP-2026-ST-84091",

            studentId:
              DEMO.studentId,

            scholarshipId,

            academicYear:
              "2026-2027",

            status:
              "ACTION_REQUIRED",

            currentStage:
              "DEFICIENCY_RESOLUTION",

            submittedAt:
              new Date("2026-08-18T10:30:00Z"),

            institutionId:
              DEMO.institutionId,
          },

          update: {
            studentId:
              DEMO.studentId,

            scholarshipId,

            academicYear:
              "2026-2027",

            status:
              "ACTION_REQUIRED",

            currentStage:
              "DEFICIENCY_RESOLUTION",

            submittedAt:
              new Date("2026-08-18T10:30:00Z"),

            institutionId:
              DEMO.institutionId,
          },
        });

      await ensureStatusHistory(
        tx,
        actionApplication.applicationId,
        "ACTION_REQUIRED",
        "corr_prod_demo_action_required",
        "Production demonstration application requiring student action.",
      );

      console.log(
        `✓ Application ready: ${actionApplication.applicationId}`,
      );

      // ----------------------------------------------------------
      // 5. Open deficiency.
      // ----------------------------------------------------------

      console.log("");
      console.log("5. Provisioning open deficiency...");

      const deficiency =
        await tx.deficiency.upsert({
          where: {
            deficiencyId:
              "def_asha_income_mismatch",
          },

          create: {
            deficiencyId:
              "def_asha_income_mismatch",

            applicationId:
              actionApplication.applicationId,

            type:
              "DATA_MISMATCH",

            title:
              "Annual Family Income Mismatch",

            description:
              "Student-declared annual income is ₹1,80,000 while the State e-District source record reports ₹2,40,000. The discrepancy is surfaced for official review; it is not an automatic rejection.",

            severity:
              "HIGH",

            status:
              "OPEN",

            requiredAction:
              "CLARIFICATION",

            dueAt:
              new Date("2026-10-10T23:59:59Z"),
          },

          update: {
            applicationId:
              actionApplication.applicationId,

            type:
              "DATA_MISMATCH",

            title:
              "Annual Family Income Mismatch",

            description:
              "Student-declared annual income is ₹1,80,000 while the State e-District source record reports ₹2,40,000. The discrepancy is surfaced for official review; it is not an automatic rejection.",

            severity:
              "HIGH",

            status:
              "OPEN",

            requiredAction:
              "CLARIFICATION",

            dueAt:
              new Date("2026-10-10T23:59:59Z"),
          },
        });

      console.log(
        `✓ Deficiency ready: ${deficiency.deficiencyId}`,
      );

      // ----------------------------------------------------------
      // 6. Historical sanctioned application.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "6. Provisioning historical sanctioned application...",
      );

      const sanctionedApplication =
        await tx.application.upsert({
          where: {
            applicationId:
              "APP-2025-ST-39102",
          },

          create: {
            applicationId:
              "APP-2025-ST-39102",

            studentId:
              DEMO.studentId,

            scholarshipId,

            academicYear:
              "2025-2026",

            status:
              "SANCTIONED",

            currentStage:
              "SANCTION_ISSUED",

            submittedAt:
              new Date("2025-08-10T12:00:00Z"),

            institutionId:
              DEMO.institutionId,
          },

          update: {
            studentId:
              DEMO.studentId,

            scholarshipId,

            academicYear:
              "2025-2026",

            status:
              "SANCTIONED",

            currentStage:
              "SANCTION_ISSUED",

            submittedAt:
              new Date("2025-08-10T12:00:00Z"),

            institutionId:
              DEMO.institutionId,
          },
        });

      await ensureStatusHistory(
        tx,
        sanctionedApplication.applicationId,
        "SANCTIONED",
        "corr_prod_demo_sanctioned",
        "Production demonstration application with an issued sanction.",
      );

      console.log(
        `✓ Historical application ready: ${sanctionedApplication.applicationId}`,
      );

      // ----------------------------------------------------------
      // 7. Sanction.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "7. Provisioning sanction record...",
      );

      const sanction =
        await tx.sanction.upsert({
          where: {
            applicationId:
              sanctionedApplication.applicationId,
          },

          create: {
            sanctionId:
              "sanc_asha_2025",

            applicationId:
              sanctionedApplication.applicationId,

            status:
              "ISSUED",

            amount:
              52400,

            currency:
              "INR",

            reference:
              "SANCTION-MTA-2025-ASHA-001",

            sanctionedAt:
              new Date("2026-08-25T11:00:00Z"),
          },

          update: {
            sanctionId:
              "sanc_asha_2025",

            status:
              "ISSUED",

            amount:
              52400,

            currency:
              "INR",

            reference:
              "SANCTION-MTA-2025-ASHA-001",

            sanctionedAt:
              new Date("2026-08-25T11:00:00Z"),
          },
        });

      console.log(
        `✓ Sanction ready: ${sanction.sanctionId}`,
      );
      console.log(
        `  Amount: ₹${sanction.amount.toLocaleString("en-IN")}`,
      );

      // ----------------------------------------------------------
      // 8. Payment.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "8. Provisioning payment tracking record...",
      );

      const payment =
        await tx.payment.upsert({
          where: {
            applicationId:
              sanctionedApplication.applicationId,
          },

          create: {
            paymentId:
              "pay_asha_2025",

            applicationId:
              sanctionedApplication.applicationId,

            status:
              "PROCESSING",

            amount:
              52400,

            currency:
              "INR",

            paymentReference:
              "PFMS-ASHA-2026-001",

            initiatedAt:
              new Date("2026-09-10T14:00:00Z"),

            source:
              "PFMS_DBT",
          },

          update: {
            paymentId:
              "pay_asha_2025",

            status:
              "PROCESSING",

            amount:
              52400,

            currency:
              "INR",

            paymentReference:
              "PFMS-ASHA-2026-001",

            initiatedAt:
              new Date("2026-09-10T14:00:00Z"),

            source:
              "PFMS_DBT",
          },
        });

      console.log(
        `✓ Payment ready: ${payment.paymentId}`,
      );
      console.log(
        `  Status: ${payment.status}`,
      );

      // ----------------------------------------------------------
      // 9. Notifications.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "9. Provisioning student notifications...",
      );

      const notifications = [
        {
          notificationId:
            "notif_demo_deficiency_001",

          type:
            "DEFICIENCY",

          title:
            "Action required on your scholarship application",

          message:
            "Your annual family income needs clarification. Open Action Centre to review the discrepancy.",

          priority:
            "HIGH",

          applicationId:
            actionApplication.applicationId,
        },

        {
          notificationId:
            "notif_demo_sanction_001",

          type:
            "SANCTION",

          title:
            "Scholarship sanctioned",

          message:
            "Your previous scholarship application has been sanctioned for ₹52,400.",

          priority:
            "NORMAL",

          applicationId:
            sanctionedApplication.applicationId,
        },

        {
          notificationId:
            "notif_demo_payment_001",

          type:
            "PAYMENT",

          title:
            "Payment processing",

          message:
            "Your scholarship payment is currently being processed through DBT.",

          priority:
            "NORMAL",

          applicationId:
            sanctionedApplication.applicationId,
        },

        {
          notificationId:
            "notif_demo_welcome_001",

          type:
            "SYSTEM",

          title:
            "Welcome to your scholarship dashboard",

          message:
            "Your profile, applications, document verification and scholarship tracking are available here.",

          priority:
            "NORMAL",

          applicationId:
            null,
        },
      ];

      for (const item of notifications) {
        await tx.notification.upsert({
          where: {
            notificationId:
              item.notificationId,
          },

          create: {
            notificationId:
              item.notificationId,

            studentId:
              DEMO.studentId,

            applicationId:
              item.applicationId,

            type:
              item.type,

            title:
              item.title,

            message:
              item.message,

            priority:
              item.priority,

            channel:
              "IN_APP",

            isRead:
              false,
          },

          update: {
            studentId:
              DEMO.studentId,

            applicationId:
              item.applicationId,

            type:
              item.type,

            title:
              item.title,

            message:
              item.message,

            priority:
              item.priority,

            channel:
              "IN_APP",

            isRead:
              false,
          },
        });
      }

      console.log(
        `✓ ${notifications.length} notifications provisioned.`,
      );

      // ----------------------------------------------------------
      // 10. JAGO context.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "10. Provisioning JAGO context...",
      );

      const jago =
        await tx.jagoAssistance.upsert({
          where: {
            assistanceId:
              "assist_demo_welcome_001",
          },

          create: {
            assistanceId:
              "assist_demo_welcome_001",

            studentId:
              DEMO.studentId,

            applicationId:
              null,

            query:
              "Welcome to JAGO",

            intent:
              "GENERAL_ASSISTANCE",

            response:
              "Namaste! I’m JAGO. Tell me what you want to find, open, understand, or do inside this scholarship app.",

            language:
              "en",

            sourceRefs:
              JSON.stringify([
                "SYSTEM_ASSISTANT",
                "SCHOLARSHIP_PORTAL",
              ]),
          },

          update: {
            studentId:
              DEMO.studentId,

            applicationId:
              null,

            query:
              "Welcome to JAGO",

            intent:
              "GENERAL_ASSISTANCE",

            response:
              "Namaste! I’m JAGO. Tell me what you want to find, open, understand, or do inside this scholarship app.",

            language:
              "en",

            sourceRefs:
              JSON.stringify([
                "SYSTEM_ASSISTANT",
                "SCHOLARSHIP_PORTAL",
              ]),
          },
        });

      console.log(
        `✓ JAGO context ready: ${jago.assistanceId}`,
      );

      // ----------------------------------------------------------
      // 11. Final consistency checks inside the transaction.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "11. Running final database consistency checks...",
      );

      const verifiedStudent =
        await tx.studentAccount.findUnique({
          where: {
            mobileNumber:
              DEMO.mobileNumber,
          },

          select: {
            studentId: true,
            mobileNumber: true,
            email: true,
          },
        });

      if (!verifiedStudent) {
        throw new Error(
          "Final verification failed: demo StudentAccount not found.",
        );
      }

      if (
        verifiedStudent.studentId !==
        DEMO.studentId
      ) {
        throw new Error(
          "Final verification failed: demo studentId mismatch.",
        );
      }

      const applicationCount =
        await tx.application.count({
          where: {
            studentId:
              DEMO.studentId,
          },
        });

      if (applicationCount < 2) {
        throw new Error(
          `Final verification failed: expected at least 2 applications, found ${applicationCount}.`,
        );
      }

      const deficiencyCount =
        await tx.deficiency.count({
          where: {
            applicationId:
              actionApplication.applicationId,
            status: "OPEN",
          },
        });

      if (deficiencyCount < 1) {
        throw new Error(
          "Final verification failed: expected an OPEN deficiency.",
        );
      }

      const notificationCount =
        await tx.notification.count({
          where: {
            studentId:
              DEMO.studentId,
          },
        });

      if (notificationCount < 4) {
        throw new Error(
          `Final verification failed: expected at least 4 notifications, found ${notificationCount}.`,
        );
      }

      const jagoCount =
        await tx.jagoAssistance.count({
          where: {
            studentId:
              DEMO.studentId,
          },
        });

      if (jagoCount < 1) {
        throw new Error(
          "Final verification failed: expected JAGO context.",
        );
      }

      const verifiedSanction =
        await tx.sanction.findUnique({
          where: {
            applicationId:
              sanctionedApplication.applicationId,
          },

          select: {
            sanctionId: true,
            status: true,
            amount: true,
          },
        });

      if (!verifiedSanction) {
        throw new Error(
          "Final verification failed: sanction record missing.",
        );
      }

      const verifiedPayment =
        await tx.payment.findUnique({
          where: {
            applicationId:
              sanctionedApplication.applicationId,
          },

          select: {
            paymentId: true,
            status: true,
            amount: true,
          },
        });

      if (!verifiedPayment) {
        throw new Error(
          "Final verification failed: payment record missing.",
        );
      }

      console.log(
        "✓ Student account check passed.",
      );
      console.log(
        `✓ Application count: ${applicationCount}`,
      );
      console.log(
        `✓ Open deficiencies: ${deficiencyCount}`,
      );
      console.log(
        `✓ Notifications: ${notificationCount}`,
      );
      console.log(
        `✓ JAGO records: ${jagoCount}`,
      );
      console.log(
        `✓ Sanction: ${verifiedSanction.status} / ₹${verifiedSanction.amount.toLocaleString("en-IN")}`,
      );
      console.log(
        `✓ Payment: ${verifiedPayment.status} / ₹${verifiedPayment.amount.toLocaleString("en-IN")}`,
      );

      // ----------------------------------------------------------
      // 12. Final transaction success message.
      // ----------------------------------------------------------

      console.log("");
      console.log(
        "==============================================================",
      );
      console.log(
        "PRODUCTION DEMO PROVISIONING COMPLETED",
      );
      console.log(
        "==============================================================",
      );

      console.log(
        `Student ID      : ${DEMO.studentId}`,
      );

      console.log(
        `Demo Mobile     : ${DEMO.mobileNumber}`,
      );

      console.log(
        `Demo Password   : ${DEMO.password}`,
      );

      console.log(
        `Scholarship ID  : ${scholarshipId}`,
      );

      console.log(
        `Action App      : ${actionApplication.applicationId}`,
      );

      console.log(
        `Historical App  : ${sanctionedApplication.applicationId}`,
      );

      console.log(
        "==============================================================",
      );
    },
    {
      maxWait: 10000,
      timeout: 60000,
    },
  );

  console.log("");
  console.log(
    "✓ PostgreSQL transaction committed successfully.",
  );
  console.log(
    "✓ The production demo account is now database-backed.",
  );
  console.log(
    "✓ No DEMO_MODE bypass was added to authentication.",
  );
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "==============================================================",
    );
    console.error(
      "❌ PRODUCTION DEMO PROVISIONING FAILED",
    );
    console.error(
      "==============================================================",
    );

    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error("");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
