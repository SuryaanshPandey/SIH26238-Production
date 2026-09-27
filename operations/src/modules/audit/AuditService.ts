import { prisma } from "@/lib/prisma";
import { ActorType, AuditEventContract } from "@contracts/v1/types";

export interface LogAuditParams {
  actorType: ActorType;
  actorId: string;
  action: string;
  entityType: "SCHOLARSHIP" | "APPLICATION" | "DEFICIENCY" | "REVIEW" | "SANCTION" | "PAYMENT" | "JAGO" | "CANDIDATE";
  entityId: string;
  reason?: string | null;
  correlationId?: string;
  payload?: Record<string, unknown> | null;
}

export class AuditService {
  async log(params: LogAuditParams): Promise<AuditEventContract> {
    const correlationId =
      params.correlationId || `corr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const auditEventId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const record = await prisma.auditEvent.create({
      data: {
        auditEventId,
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason || null,
        correlationId,
        payload: params.payload ? JSON.stringify(params.payload) : null,
      },
    });

    return {
      audit_event_id: record.auditEventId,
      actor_type: record.actorType as ActorType,
      actor_id: record.actorId,
      action: record.action,
      entity_type: record.entityType,
      entity_id: record.entityId,
      timestamp: record.createdAt.toISOString(),
      reason: record.reason,
      correlation_id: record.correlationId,
      payload: record.payload ? JSON.parse(record.payload) : null,
    };
  }

  async getTimelineByApplication(applicationId: string): Promise<AuditEventContract[]> {
    const events = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: "APPLICATION", entityId: applicationId },
          { payload: { contains: applicationId } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return events.map((e) => ({
      audit_event_id: e.auditEventId,
      actor_type: e.actorType as ActorType,
      actor_id: e.actorId,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId,
      timestamp: e.createdAt.toISOString(),
      reason: e.reason,
      correlation_id: e.correlationId,
      payload: e.payload ? JSON.parse(e.payload) : null,
    }));
  }

  async getEventsByEntity(entityType: string, entityId: string): Promise<AuditEventContract[]> {
    const events = await prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });

    return events.map((e) => ({
      audit_event_id: e.auditEventId,
      actor_type: e.actorType as ActorType,
      actor_id: e.actorId,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId,
      timestamp: e.createdAt.toISOString(),
      reason: e.reason,
      correlation_id: e.correlationId,
      payload: e.payload ? JSON.parse(e.payload) : null,
    }));
  }
}

export const auditService = new AuditService();
