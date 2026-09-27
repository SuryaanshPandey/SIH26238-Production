import { prisma } from "@/lib/prisma";
import { DeficiencyContract, DeficiencySeverity, DeficiencyStatus, DeficiencyType, RequiredAction } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { auditService } from "@/modules/audit/AuditService";
import { notificationService } from "@/modules/notifications/NotificationService";

export interface CreateDeficiencyParams {
  applicationId: string;
  type: DeficiencyType;
  title: string;
  description: string;
  severity: DeficiencySeverity;
  requiredAction: RequiredAction;
  dueDays?: number;
  actorId?: string;
}

export class DeficiencyService {
  async createDeficiency(params: CreateDeficiencyParams): Promise<DeficiencyContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId: params.applicationId },
    });
    if (!app) {
      throw AppError.notFound("Application", params.applicationId);
    }

    const deficiencyId = `def_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + (params.dueDays || 15));

    const record = await prisma.deficiency.create({
      data: {
        deficiencyId,
        applicationId: params.applicationId,
        type: params.type,
        title: params.title,
        description: params.description,
        severity: params.severity,
        status: "OPEN",
        requiredAction: params.requiredAction,
        dueAt,
        history: {
          create: {
            action: "CREATED",
            actorType: "SYSTEM",
            actorId: params.actorId || "SYSTEM_PIPELINE",
            note: "Deficiency automatically or manually identified.",
          },
        },
      },
    });

    // Audit log
    await auditService.log({
      actorType: "SYSTEM",
      actorId: params.actorId || "SYSTEM_PIPELINE",
      action: "DEFICIENCY_CREATED",
      entityType: "DEFICIENCY",
      entityId: deficiencyId,
      reason: params.title,
      payload: { applicationId: params.applicationId, type: params.type, severity: params.severity },
    });

    // Notify student
    await notificationService.dispatch({
      studentId: app.studentId,
      applicationId: app.applicationId,
      type: "DOCUMENT_DEFICIENCY",
      title: `Action Required: ${params.title}`,
      message: params.description,
      priority: params.severity === "CRITICAL" || params.severity === "HIGH" ? "HIGH" : "NORMAL",
      channel: "IN_APP",
    });

    return this.mapToContract(record);
  }

  async resolveDeficiency(
    deficiencyId: string,
    resolutionNote: string,
    actorId = "STUDENT",
    studentId?: string
  ): Promise<DeficiencyContract> {
    const existing = await prisma.deficiency.findUnique({
      where: { deficiencyId },
      include: { application: true },
    });
    if (!existing) {
      throw AppError.notFound("Deficiency", deficiencyId);
    }
    if (studentId && existing.application.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "A student account may only resolve deficiencies on its own applications.", 403);
    }

    const updated = await prisma.deficiency.update({
      where: { deficiencyId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        history: {
          create: {
            action: "RESOLVED",
            actorType: "STUDENT",
            actorId,
            note: resolutionNote,
          },
        },
      },
    });

    await auditService.log({
      actorType: "STUDENT",
      actorId,
      action: "DEFICIENCY_RESOLVED",
      entityType: "DEFICIENCY",
      entityId: deficiencyId,
      reason: resolutionNote,
      payload: { applicationId: existing.applicationId },
    });

    return this.mapToContract(updated);
  }

  async waiveDeficiency(
    deficiencyId: string,
    waiverReason: string,
    reviewerId: string
  ): Promise<DeficiencyContract> {
    const existing = await prisma.deficiency.findUnique({
      where: { deficiencyId },
    });
    if (!existing) {
      throw AppError.notFound("Deficiency", deficiencyId);
    }

    const updated = await prisma.deficiency.update({
      where: { deficiencyId },
      data: {
        status: "WAIVED",
        resolvedAt: new Date(),
        history: {
          create: {
            action: "WAIVED",
            actorType: "REVIEWER",
            actorId: reviewerId,
            note: waiverReason,
          },
        },
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId: reviewerId,
      action: "DEFICIENCY_WAIVED",
      entityType: "DEFICIENCY",
      entityId: deficiencyId,
      reason: waiverReason,
      payload: { applicationId: existing.applicationId },
    });

    return this.mapToContract(updated);
  }

  async listDeficiencies(applicationId?: string): Promise<DeficiencyContract[]> {
    const list = await prisma.deficiency.findMany({
      where: applicationId ? { applicationId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return list.map((d) => this.mapToContract(d));
  }

  async getDeficiency(deficiencyId: string): Promise<DeficiencyContract | null> {
    const record = await prisma.deficiency.findUnique({
      where: { deficiencyId },
    });
    return record ? this.mapToContract(record) : null;
  }

  private mapToContract(record: {
    deficiencyId: string;
    applicationId: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    requiredAction: string;
    createdAt: Date;
    dueAt: Date;
    resolvedAt: Date | null;
  }): DeficiencyContract {
    return {
      deficiency_id: record.deficiencyId,
      application_id: record.applicationId,
      type: record.type as DeficiencyType,
      title: record.title,
      description: record.description,
      severity: record.severity as DeficiencySeverity,
      status: record.status as DeficiencyStatus,
      required_action: record.requiredAction as RequiredAction,
      created_at: record.createdAt.toISOString(),
      due_at: record.dueAt.toISOString(),
      resolved_at: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    };
  }
}

export const deficiencyService = new DeficiencyService();
