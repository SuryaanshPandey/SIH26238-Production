import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const totalScholarships = await prisma.scholarship.count();
    const activeScholarships = await prisma.scholarship.count({ where: { status: "ACTIVE" } });

    const totalApplications = await prisma.application.count();
    const underVerification = await prisma.application.count({ where: { status: "UNDER_VERIFICATION" } });
    const actionRequired = await prisma.application.count({ where: { status: "ACTION_REQUIRED" } });
    const underReview = await prisma.application.count({ where: { status: "UNDER_REVIEW" } });
    const verified = await prisma.application.count({ where: { status: "VERIFIED" } });
    const sanctioned = await prisma.application.count({ where: { status: "SANCTIONED" } });
    const paymentProcessing = await prisma.application.count({ where: { status: "PAYMENT_PROCESSING" } });
    const paid = await prisma.application.count({ where: { status: "PAID" } });
    const rejected = await prisma.application.count({ where: { status: "REJECTED" } });

    const openDeficiencies = await prisma.deficiency.count({ where: { status: { in: ["OPEN", "ACTION_REQUIRED"] } } });
    const pendingReviews = await prisma.reviewCase.count({ where: { status: { in: ["PENDING", "ASSIGNED", "IN_REVIEW"] } } });
    const beneficiaryCandidates = await prisma.beneficiaryCandidate.count({ where: { status: "PENDING_REVIEW" } });

    const paymentStats = {
      processing: await prisma.payment.count({ where: { status: "PROCESSING" } }),
      success: await prisma.payment.count({ where: { status: "SUCCESS" } }),
      failed: await prisma.payment.count({ where: { status: "FAILED" } }),
      returned: await prisma.payment.count({ where: { status: "RETURNED" } }),
    };

    const recentAudit = await prisma.auditEvent.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
    });

    const kpis = {
      scholarships: { total: totalScholarships, active: activeScholarships },
      applications: {
        total: totalApplications,
        underVerification,
        actionRequired,
        underReview,
        verified,
        sanctioned,
        paymentProcessing,
        paid,
        rejected,
      },
      operations: {
        openDeficiencies,
        pendingReviews,
        beneficiaryCandidates,
      },
      payments: paymentStats,
      recentAudit: recentAudit.map((a) => ({
        audit_event_id: a.auditEventId,
        actor_type: a.actorType,
        actor_id: a.actorId,
        action: a.action,
        entity_type: a.entityType,
        entity_id: a.entityId,
        reason: a.reason,
        timestamp: a.createdAt.toISOString(),
      })),
    };

    return handleApiSuccess(kpis, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
