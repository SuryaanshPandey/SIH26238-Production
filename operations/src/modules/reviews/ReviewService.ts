import { prisma } from "@/lib/prisma";
import { ReviewContract, ReviewDecision, ReviewStatus, DeficiencySeverity } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { auditService } from "@/modules/audit/AuditService";

export interface CreateReviewCaseParams {
  applicationId: string;
  reason: string;
  severity?: DeficiencySeverity;
}

export class ReviewService {
  async createReviewCase(params: CreateReviewCaseParams): Promise<ReviewContract> {
    const existing = await prisma.reviewCase.findFirst({
      where: {
        applicationId: params.applicationId,
        status: { in: ["PENDING", "ASSIGNED", "IN_REVIEW"] },
      },
    });

    if (existing) {
      return this.mapToContract(existing);
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const record = await prisma.reviewCase.create({
      data: {
        reviewId,
        applicationId: params.applicationId,
        reason: params.reason,
        severity: params.severity || "MEDIUM",
        status: "PENDING",
        history: {
          create: {
            action: "CREATED",
            actorId: "SYSTEM_ROUTING",
            note: "Application routed to manual desk review queue.",
          },
        },
      },
    });

    await auditService.log({
      actorType: "SYSTEM",
      actorId: "SYSTEM_ROUTING",
      action: "REVIEW_CASE_CREATED",
      entityType: "REVIEW",
      entityId: reviewId,
      reason: params.reason,
      payload: { applicationId: params.applicationId },
    });

    return this.mapToContract(record);
  }

  async assignReviewer(reviewId: string, reviewerId: string): Promise<ReviewContract> {
    const existing = await prisma.reviewCase.findUnique({
      where: { reviewId },
    });
    if (!existing) {
      throw AppError.notFound("ReviewCase", reviewId);
    }

    const updated = await prisma.reviewCase.update({
      where: { reviewId },
      data: {
        assignedReviewer: reviewerId,
        status: "ASSIGNED",
        history: {
          create: {
            action: "ASSIGNED",
            actorId: reviewerId,
            note: `Assigned case to desk officer ${reviewerId}.`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId: reviewerId,
      action: "REVIEW_CASE_ASSIGNED",
      entityType: "REVIEW",
      entityId: reviewId,
      payload: { reviewerId },
    });

    return this.mapToContract(updated);
  }

  async startReview(reviewId: string, reviewerId?: string): Promise<ReviewContract> {
    const existing = await prisma.reviewCase.findUnique({
      where: { reviewId },
    });
    if (!existing) {
      throw AppError.notFound("ReviewCase", reviewId);
    }

    const updated = await prisma.reviewCase.update({
      where: { reviewId },
      data: {
        status: "IN_REVIEW",
        history: {
          create: {
            action: "STARTED",
            actorId: reviewerId || existing.assignedReviewer || "OFFICER",
            note: "Review examination commenced.",
          },
        },
      },
    });

    return this.mapToContract(updated);
  }

  async makeDecision(
    reviewId: string,
    decision: ReviewDecision,
    decisionReason: string,
    reviewerId: string
  ): Promise<ReviewContract> {
    if (!decisionReason || decisionReason.trim().length === 0) {
      throw AppError.invalidRequest("A documented justification reason is required for all review decisions.");
    }

    const existing = await prisma.reviewCase.findUnique({
      where: { reviewId },
      include: { application: true },
    });
    if (!existing) {
      throw AppError.notFound("ReviewCase", reviewId);
    }

    const nextStatus = decision === "ESCALATE" ? "ESCALATED" : "DECIDED";

    const updated = await prisma.reviewCase.update({
      where: { reviewId },
      data: {
        status: nextStatus,
        decision,
        decisionReason,
        resolvedAt: decision !== "ESCALATE" ? new Date() : null,
        history: {
          create: {
            action: "DECIDED",
            actorId: reviewerId,
            note: `Decision [${decision}]: ${decisionReason}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId: reviewerId,
      action: `REVIEW_DECISION_${decision}`,
      entityType: "REVIEW",
      entityId: reviewId,
      reason: decisionReason,
      payload: { applicationId: existing.applicationId, decision },
    });

    return this.mapToContract(updated);
  }

  async listReviews(filters?: { status?: string; severity?: string; reviewer?: string }): Promise<ReviewContract[]> {
    const list = await prisma.reviewCase.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.severity ? { severity: filters.severity } : {}),
        ...(filters?.reviewer ? { assignedReviewer: filters.reviewer } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return list.map((r) => this.mapToContract(r));
  }

  async getReview(reviewId: string): Promise<ReviewContract | null> {
    const record = await prisma.reviewCase.findUnique({
      where: { reviewId },
    });
    return record ? this.mapToContract(record) : null;
  }

  private mapToContract(record: {
    reviewId: string;
    applicationId: string;
    reason: string;
    severity: string;
    status: string;
    assignedReviewer: string | null;
    createdAt: Date;
    updatedAt: Date;
    decision: string | null;
    decisionReason: string | null;
    resolvedAt: Date | null;
  }): ReviewContract {
    return {
      review_id: record.reviewId,
      application_id: record.applicationId,
      reason: record.reason,
      severity: record.severity as DeficiencySeverity,
      status: record.status as ReviewStatus,
      assigned_reviewer: record.assignedReviewer,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      decision: record.decision as ReviewDecision | null,
      decision_reason: record.decisionReason,
      resolved_at: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    };
  }
}

export const reviewService = new ReviewService();
