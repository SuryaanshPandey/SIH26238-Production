import { NotificationItem } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";
import { warmOperationsBackend } from "./auth";

let operationsWarmPromise: Promise<void> | null = null;
let operationsReadyUntil = 0;

const OPERATIONS_READY_TTL_MS = 45_000;

async function ensureOperationsReady(): Promise<void> {
  if (Date.now() < operationsReadyUntil) {
    return;
  }

  if (!operationsWarmPromise) {
    operationsWarmPromise = warmOperationsBackend()
      .then(() => {
        operationsReadyUntil =
          Date.now() + OPERATIONS_READY_TTL_MS;
      })
      .finally(() => {
        operationsWarmPromise = null;
      });
  }

  await operationsWarmPromise;
}

function mapNotification(n: any): NotificationItem {
  return {
    notification_id: n.notification_id,
    student_id: n.student_id,
    application_id:
      n.application_id ?? undefined,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    channel: n.channel,
    read: Boolean(n.read),
    created_at: n.created_at,
    action_url:
      n.action_url ||
      (
        n.application_id
          ? `/applications/${encodeURIComponent(
              n.application_id,
            )}`
          : undefined
      ),
  } as NotificationItem;
}

export const notificationApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const studentId =
      getCurrentStudentId();

    if (!studentId) {
      return [];
    }

    /*
     * Wake the Operations service before the authenticated
     * cross-origin request.
     *
     * This is especially important with Render Free services:
     * the health request is simple and can wake the service
     * before the Authorization-bearing request causes a CORS
     * preflight.
     */
    await ensureOperationsReady();

    try {
      const data =
        await apiFetch<any[]>(
          `${RIJVAN_API_URL}/notifications/student/${encodeURIComponent(
            studentId,
          )}`,
          undefined,
          {
            timeoutMs: 15_000,
          },
        );

      return data.map(
        mapNotification,
      );
    } catch (error) {
      /*
       * One recovery attempt:
       *
       * The service may have transitioned through a cold-start
       * state between the health probe and the authenticated
       * request. Warm it again, then retry once.
       */
      if (
        error instanceof Error
      ) {
        await ensureOperationsReady();

        const data =
          await apiFetch<any[]>(
            `${RIJVAN_API_URL}/notifications/student/${encodeURIComponent(
              studentId,
            )}`,
            undefined,
            {
              timeoutMs: 15_000,
            },
          );

        return data.map(
          mapNotification,
        );
      }

      throw error;
    }
  },

  async markAsRead(
    notificationId: string,
  ): Promise<void> {
    await ensureOperationsReady();

    await apiFetch(
      `${RIJVAN_API_URL}/notifications/${encodeURIComponent(
        notificationId,
      )}/read`,
      {
        method: "POST",
        body: "{}",
      },
      {
        timeoutMs: 15_000,
      },
    );
  },

  async markAllAsRead(): Promise<void> {
    const list =
      await this.getNotifications();

    const unread =
      list.filter(
        (notification) =>
          !notification.read,
      );

    await Promise.all(
      unread.map(
        (notification) =>
          this.markAsRead(
            notification.notification_id,
          ),
      ),
    );
  },
};
