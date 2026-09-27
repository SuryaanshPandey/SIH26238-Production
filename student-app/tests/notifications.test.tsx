import { describe, it, expect } from "vitest";
import { notificationApi } from "../lib/api/notification";

describe("Notifications API & Read States", () => {
  it("retrieves notifications including action required and payment alerts", async () => {
    const notifs = await notificationApi.getNotifications();
    expect(notifs.length).toBeGreaterThanOrEqual(4);

    const types = notifs.map((n) => n.type);
    expect(types).toContain("ACTION_REQUIRED");
    expect(types).toContain("PAYMENT_UPDATE");
  });

  it("marks a notification as read", async () => {
    const notifs = await notificationApi.getNotifications();
    const unread = notifs.find((n) => !n.read);
    expect(unread).toBeDefined();

    if (unread) {
      await notificationApi.markAsRead(unread.notification_id);
      const updated = await notificationApi.getNotifications();
      const readNotif = updated.find((n) => n.notification_id === unread.notification_id);
      expect(readNotif?.read).toBe(true);
    }
  });

  it("marks all notifications as read", async () => {
    await notificationApi.markAllAsRead();
    const updated = await notificationApi.getNotifications();
    expect(updated.every((n) => n.read)).toBe(true);
  });
});
