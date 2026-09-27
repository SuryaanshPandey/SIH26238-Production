"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { applicationApi } from "../../lib/api/application";
import { paymentApi } from "../../lib/api/payment";
import { Application, PaymentRecord } from "../../lib/contracts/types";
import { ApplicationCard } from "../../components/application/ApplicationCard";
import { Button } from "../../components/ui/Button";
import { FileText, Plus, AlertTriangle } from "lucide-react";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>(() => applicationApi.getCachedApplications());
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [filter, setFilter] = useState<"ALL" | "ACTION_REQUIRED" | "COMPLETED">("ALL");
  const [isLoading, setIsLoading] = useState(() => applicationApi.getCachedApplications().length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setIsRetrying(true);
    else setIsLoading(true);
    setError(null);

    try {
      const apps = await applicationApi.getApplications({ force });
      setApplications(apps);
      setIsLoading(false);

      // Payment is secondary. Render the application list first and populate
      // payment badges independently so a PFMS outage never blocks the page.
      if (apps.length === 0) {
        setPayments({});
        return;
      }

      const results = await Promise.allSettled(
        apps.map((app) => paymentApi.getPaymentByAppId(app.application_id))
      );
      const paymentMap: Record<string, PaymentRecord> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          paymentMap[apps[index].application_id] = result.value;
        }
      });
      setPayments(paymentMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Applications could not be loaded.");
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const filtered = applications.filter((app) => {
    if (filter === "ACTION_REQUIRED") return app.current_stage === "ACTION_REQUIRED";
    if (filter === "COMPLETED") return ["SANCTIONED", "PAID"].includes(app.current_stage);
    return true;
  });

  const actionRequiredCount = applications.filter(
    (a) => a.current_stage === "ACTION_REQUIRED"
  ).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">My Applications</h2>
          </div>
          <p className="text-xs text-slate-500">
            Track multi-scheme applications, verification progress, and DBT payments.
          </p>
        </div>

        <Link href="/applications/new">
          <Button size="sm" className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === "ALL"
              ? "bg-mota-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({applications.length})
        </button>

        <button
          onClick={() => setFilter("ACTION_REQUIRED")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
            filter === "ACTION_REQUIRED"
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Action Required ({actionRequiredCount})</span>
        </button>

        <button
          onClick={() => setFilter("COMPLETED")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === "COMPLETED"
              ? "bg-teal-700 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Sanctioned / Paid
        </button>
      </div>

      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-36 bg-slate-200 rounded-2xl" />
            <div className="h-36 bg-slate-200 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-red-200 p-6">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Applications could not be loaded</p>
            <p className="text-[11px] text-slate-500 mt-1">{error}</p>
            <Button size="sm" className="mt-3" onClick={() => void load(true)} disabled={isRetrying}>
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No applications found</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Select another filter or discover new schemes to apply.
            </p>
            <Link href="/scholarships">
              <Button size="sm" className="mt-3">Discover schemes</Button>
            </Link>
          </div>
        ) : (
          filtered.map((app) => (
            <ApplicationCard
              key={app.application_id}
              application={app}
              paymentRecord={payments[app.application_id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
