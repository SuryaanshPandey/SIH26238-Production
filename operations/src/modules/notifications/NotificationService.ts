import { prisma } from "@/lib/prisma";
import { NotificationContract } from "@contracts/v1/types";

export interface CreateNotificationParams {
  studentId: string;
  applicationId?: string | null;
  type: string;
  title: string;
  message: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  channel?: "IN_APP" | "PUSH" | "SMS" | "EMAIL";
}

export class NotificationService {
  async dispatch(params: CreateNotificationParams): Promise<NotificationContract> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const record = await prisma.notification.create({
      data: {
        notificationId,
        studentId: params.studentId,
        applicationId: params.applicationId || null,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority || "NORMAL",
        channel: params.channel || "IN_APP",
        isRead: false,
      },
    });

    return {
      notification_id: record.notificationId,
      student_id: record.studentId,
      application_id: record.applicationId,
      type: record.type,
      title: record.title,
      message: record.message,
      priority: record.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      channel: record.channel as "IN_APP" | "PUSH" | "SMS" | "EMAIL",
      read: record.isRead,
      created_at: record.createdAt.toISOString(),
      action_url: record.applicationId ? `/applications/${encodeURIComponent(record.applicationId)}` : undefined,
    };
  }

  async getNotificationsByStudent(studentId: string): Promise<NotificationContract[]> {
    const list = await prisma.notification.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });

    return list.map((n) => ({
      notification_id: n.notificationId,
      student_id: n.studentId,
      application_id: n.applicationId,
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      channel: n.channel as "IN_APP" | "PUSH" | "SMS" | "EMAIL",
      read: n.isRead,
      created_at: n.createdAt.toISOString(),
      action_url: n.applicationId ? `/applications/${encodeURIComponent(n.applicationId)}` : undefined,
    }));
  }

  async markAsRead(notificationId: string, studentId?: string): Promise<boolean> {
    const notification = await prisma.notification.findUnique({ where: { notificationId } });
    if (!notification) throw new Error(`Notification '${notificationId}' was not found.`);
    if (studentId && notification.studentId !== studentId) throw new Error("Students may only update their own notifications.");
    await prisma.notification.update({ where: { notificationId }, data: { isRead: true } });
    return true;
  }
}

export const notificationService = new NotificationService();
