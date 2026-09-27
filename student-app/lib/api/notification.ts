import { NotificationItem } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";

function mapNotification(n: any): NotificationItem {
  return {
    notification_id: n.notification_id,
    student_id: n.student_id,
    application_id: n.application_id ?? undefined,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    channel: n.channel,
    read: Boolean(n.read),
    created_at: n.created_at,
    action_url: n.action_url || (n.application_id ? `/applications/${encodeURIComponent(n.application_id)}` : undefined),
  } as NotificationItem;
}

export const notificationApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const studentId = getCurrentStudentId();
    if (!studentId) return [];
    const data = await apiFetch<any[]>(`${RIJVAN_API_URL}/notifications/student/${encodeURIComponent(studentId)}`);
    return data.map(mapNotification);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await apiFetch(`${RIJVAN_API_URL}/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST", body: "{}" });
  },

  async markAllAsRead(): Promise<void> {
    const list = await this.getNotifications();
    await Promise.all(list.filter((n) => !n.read).map((n) => this.markAsRead(n.notification_id)));
  },
};
