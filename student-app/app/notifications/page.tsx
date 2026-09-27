"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { notificationApi } from "../../lib/api/notification";
import { NotificationItem } from "../../lib/contracts/types";
import { NotificationCard } from "../../components/notifications/NotificationCard";
import { Button } from "../../components/ui/Button";
import { Bell, CheckCheck, ArrowLeft, Inbox } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Notifications could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationApi.markAsRead(id);
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllAsRead();
    await loadNotifications();
  };

  const filtered = notifications.filter((n) => (filter === "UNREAD" ? !n.read : true));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-4 space-y-4">
      {/* Top back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Notifications</h2>
          </div>
          <p className="text-xs text-slate-500">
            Real-time status updates, deficiency alerts, and payment receipts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-mota-700 font-semibold hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filter === "ALL"
              ? "bg-mota-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setFilter("UNREAD")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filter === "UNREAD"
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Feed List */}
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-slate-200 rounded-2xl" />
            <div className="h-20 bg-slate-200 rounded-2xl" />
          </div>
        ) : loadError ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-red-200 p-6"><p className="text-xs font-semibold text-slate-700">Notifications could not be loaded</p><p className="text-[11px] text-slate-500 mt-1">{loadError}</p><Button size="sm" className="mt-3" onClick={loadNotifications}>Retry</Button></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
            <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No notifications</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              You are all caught up!
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <NotificationCard
              key={item.notification_id}
              notification={item}
              onMarkRead={handleMarkRead}
            />
          ))
        )}
      </div>
    </div>
  );
}
