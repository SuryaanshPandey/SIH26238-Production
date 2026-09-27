"use client";

import React from "react";
import Link from "next/link";
import { Application, PaymentRecord } from "../../lib/contracts/types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  getApplicationStageBadge,
  getDbtPaymentBadge,
  formatDate,
} from "../../lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Building,
  CreditCard,
  FileCheck,
} from "lucide-react";

interface ApplicationCardProps {
  application: Application;
  paymentRecord?: PaymentRecord | null;
}

export function ApplicationCard({
  application,
  paymentRecord,
}: ApplicationCardProps) {
  const stageBadge = getApplicationStageBadge(application.current_stage);
  const isActionRequired = application.current_stage === "ACTION_REQUIRED";

  return (
    <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Red accent strip on left if action is required */}
      {isActionRequired && (
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-600" />
      )}

      {/* Header Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-mono text-xs font-semibold text-slate-500">
          {application.application_id}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${stageBadge.color}`}
          >
            {stageBadge.label}
          </span>
        </div>
      </div>

      <h3 className="text-base font-bold text-slate-900 leading-snug">
        {application.scheme_name}
      </h3>

      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{application.institution_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Last Updated: {formatDate(application.last_updated_at)}</span>
        </div>
      </div>

      {/* Separate Payment Status Display (Contract Rule: Separate from Application Status!) */}
      {paymentRecord && (
        <div className="mt-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-blue-900 font-medium">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>DBT / PFMS Status:</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              getDbtPaymentBadge(paymentRecord.dbt_state).color
            }`}
          >
            {getDbtPaymentBadge(paymentRecord.dbt_state).label}
          </span>
        </div>
      )}

      {/* Urgent Action Alert if Action Required */}
      {isActionRequired && (
        <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Attention Required</span>
            <span>
              A discrepancy requires your clarification. Your application is routed for official review.
            </span>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Year: <span className="font-medium text-slate-700">{application.academic_year}</span>
        </span>
        <div className="flex items-center gap-2">
          {isActionRequired ? (
            <Link href="/actions">
              <Button size="sm" variant="danger" className="gap-1 text-xs">
                <span>Resolve Now</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          ) : (
            <Link href={`/applications/${application.application_id}`}>
              <Button size="sm" variant="outline" className="gap-1 text-xs">
                <span>Track Timeline</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
