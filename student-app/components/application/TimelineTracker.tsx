"use client";

import React from "react";
import { TimelineEvent } from "../../lib/contracts/types";
import { formatDateTime } from "../../lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

interface TimelineTrackerProps {
  events: TimelineEvent[];
}

export function TimelineTracker({ events }: TimelineTrackerProps) {
  const getActorBadge = (actor: TimelineEvent["actor"]) => {
    switch (actor) {
      case "STUDENT":
        return { label: "Student Action", bg: "bg-slate-100 text-slate-700" };
      case "INSTITUTE":
        return { label: "College Verification", bg: "bg-blue-100 text-blue-800" };
      case "STATE_DNO":
        return { label: "State Nodal Officer", bg: "bg-purple-100 text-purple-800" };
      case "MINISTRY":
        return { label: "Ministry of Tribal Affairs", bg: "bg-amber-100 text-amber-900" };
      case "PFMS_SYSTEM":
        return { label: "Payment Provider", bg: "bg-teal-100 text-teal-800" };
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
      {events.map((evt, idx) => {
        const actorInfo = getActorBadge(evt.actor);
        const isCompleted = evt.status === "COMPLETED";
        const isCurrent = evt.status === "CURRENT";
        const isAlert = evt.status === "ALERT";
        const isPending = evt.status === "PENDING";

        return (
          <div key={evt.event_id || idx} className="relative group">
            {/* Status Indicator Icon */}
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white transition-colors ${
                isCompleted
                  ? "border-emerald-600 text-emerald-600"
                  : isAlert
                  ? "border-red-600 bg-red-50 text-red-600 animate-bounce"
                  : isCurrent
                  ? "border-mota-700 bg-mota-50 text-mota-700"
                  : "border-slate-300 text-slate-300"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isAlert ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              ) : isCurrent ? (
                <div className="w-2 h-2 rounded-full bg-mota-700 animate-ping" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Event Content Card */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                isAlert
                  ? "bg-red-50/70 border-red-200 shadow-sm"
                  : isCurrent
                  ? "bg-white border-mota-600/40 shadow-sm ring-1 ring-mota-500/20"
                  : isCompleted
                  ? "bg-white border-slate-200"
                  : "bg-slate-50/50 border-slate-200/60 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${actorInfo.bg}`}
                >
                  {actorInfo.label}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {formatDateTime(evt.timestamp)}
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {evt.title}
              </h4>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {evt.description}
              </p>

              {/* Action Needed Callout */}
              {evt.action_needed && (
                <div className="mt-3 p-2.5 bg-red-100/70 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-red-900 font-medium">
                    <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
                    <span>{evt.action_needed}</span>
                  </div>
                  <Link
                    href="/actions"
                    className="text-xs font-bold text-red-700 underline shrink-0 hover:text-red-900"
                  >
                    Act Now →
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
