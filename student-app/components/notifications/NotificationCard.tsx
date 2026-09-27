"use client";

import React from "react";
import Link from "next/link";
import { NotificationItem } from "../../lib/contracts/types";
import { Card } from "../ui/Card";
import { formatDateTime } from "../../lib/utils";
import {
  Bell,
  AlertTriangle,
  CreditCard,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Check,
} from "lucide-react";

interface NotificationCardProps {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}

export function NotificationCard({
  notification,
  onMarkRead,
}: NotificationCardProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "ACTION_REQUIRED":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "PAYMENT_UPDATE":
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case "SANCTION_UPDATE":
        return <FileCheck className="w-4 h-4 text-teal-600" />;
      case "VERIFICATION_UPDATE":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <Card
      className={`transition-all ${
        notification.read
          ? "bg-white/80 border-slate-200"
          : "bg-blue-50/30 border-blue-200 shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon box */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            notification.read ? "bg-slate-100" : "bg-white border border-blue-200 shadow-xs"
          }`}
        >
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {notification.type.replace("_", " ")}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {formatDateTime(notification.created_at)}
            </span>
          </div>

          <h4
            className={`text-xs font-bold leading-tight ${
              notification.read ? "text-slate-800" : "text-blue-950 font-extrabold"
            }`}
          >
            {notification.title}
          </h4>

          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {notification.message}
          </p>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            {notification.action_url ? (
              <Link
                href={notification.action_url}
                className="inline-flex items-center gap-1 text-xs font-bold text-mota-700 hover:text-mota-900"
              >
                <span>View Action</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <span />
            )}

            {!notification.read && (
              <button
                onClick={() => onMarkRead(notification.notification_id)}
                className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark Read</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
