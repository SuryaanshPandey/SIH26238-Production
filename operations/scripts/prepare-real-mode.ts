import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { nspSyncService } from "../src/modules/scholarships/NspSyncService";

async function main() {
  if (process.env.REAL_DATA_MODE === "false" || process.env.DEMO_MODE === "true") {
    console.log("Real-mode cleanup skipped (demo mode enabled).");
    return;
  }

  const demoApplicationIds = await prisma.application.findMany({
    where: { OR: [
      { applicationId: { startsWith: "app_demo_" } },
      { studentId: { startsWith: "stu_demo_" } },
      { studentId: "STU-2026-JH-88391" },
    ] },
    select: { applicationId: true },
  });
  const appIds = demoApplicationIds.map((x: { applicationId: string }) => x.applicationId);

  if (appIds.length) {
    await prisma.notification.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { applicationId: { in: appIds } } } });
    await prisma.payment.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.sanction.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.reviewHistory.deleteMany({ where: { review: { applicationId: { in: appIds } } } });
    await prisma.reviewCase.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.deficiencyHistory.deleteMany({ where: { deficiency: { applicationId: { in: appIds } } } });
    await prisma.deficiency.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.eligibilityRuleResult.deleteMany({ where: { evaluation: { applicationId: { in: appIds } } } });
    await prisma.eligibilityEvaluation.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.application.deleteMany({ where: { applicationId: { in: appIds } } });
  }

  await prisma.beneficiaryCandidate.deleteMany({ where: { OR: [{ candidateId: { startsWith: "cand_demo_" } }, { studentId: { startsWith: "stu_demo_" } }, { studentId: "STU-2026-JH-88391" }] } });
  await prisma.jagoAssistance.deleteMany({ where: { OR: [{ assistanceId: { startsWith: "assist_demo_" } }, { studentId: { startsWith: "stu_demo_" } }, { studentId: "STU-2026-JH-88391" }] } });
  await prisma.auditEvent.deleteMany({ where: { actorId: { contains: "SEED" } } });
  await prisma.scholarship.deleteMany({ where: { OR: [{ sourceSystem: "LOCAL" }, { scholarshipId: { startsWith: "sch_" } }] } });

  // Emergency offline baseline only. The runtime catalogue is populated from
  // official government sources; the snapshot remains available solely so the
  // student UI can render if every official source is temporarily unreachable.
  const snapshot = await nspSyncService.loadOfficialSnapshot();
  console.log(`Real-mode cleanup complete. Removed ${appIds.length} demo application records and local/seed scholarship records.`);
  console.log(`Emergency official NSP snapshot ready: ${snapshot.upserted} catalogue record(s).`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
