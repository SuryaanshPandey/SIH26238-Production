"use client";

import React from "react";
import { SanctionDetails, PaymentRecord } from "../../lib/contracts/types";
import { Card } from "../ui/Card";
import {
  formatCurrencyINR,
  formatDate,
  formatDateTime,
  getDbtPaymentBadge,
} from "../../lib/utils";
import {
  CreditCard,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
} from "lucide-react";

interface PaymentTrackerProps {
  sanction?: SanctionDetails | null;
  payment?: PaymentRecord | null;
}

export function PaymentTracker({ sanction, payment }: PaymentTrackerProps) {
  if (!sanction && !payment) {
    return (
      <Card className="text-center py-8">
        <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No Sanction Issued Yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Sanction orders are issued by the Ministry upon successful institutional and nodal officer verification.
        </p>
      </Card>
    );
  }

  const dbtBadge = payment ? getDbtPaymentBadge(payment.dbt_state) : null;

  return (
    <div className="space-y-4">
      {/* Sanction Details Card */}
      {sanction && (
        <Card className="border-teal-200 bg-teal-50/20">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-teal-700" />
              <div>
                <span className="text-xs font-bold text-teal-900 block leading-tight">
                  Sanction Order
                </span>
                <span className="font-mono text-[11px] text-teal-700">
                  {sanction.sanction_order_no}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-teal-700 font-medium bg-teal-100 px-2 py-0.5 rounded-full">
              Sanctioned: {formatDate(sanction.sanction_date)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white/80 rounded-xl border border-teal-100">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">
                Tuition Fee
              </span>
              <span className="text-xs font-bold text-slate-800">
                {formatCurrencyINR(sanction.approved_tuition_fee)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">
                Maintenance
              </span>
              <span className="text-xs font-bold text-slate-800">
                {formatCurrencyINR(sanction.approved_maintenance_allowance)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase">
                Total Grant
              </span>
              <span className="text-sm font-extrabold text-teal-700">
                {formatCurrencyINR(sanction.total_sanctioned_amount)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-2 text-center">
            Sanctioning Authority: {sanction.sanctioning_authority}
          </p>
        </Card>
      )}

      {/* Direct Benefit Transfer (DBT) via PFMS Card */}
      {payment && (
        <Card className="border-blue-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  PFMS Direct Benefit Transfer (DBT)
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  Txn Ref: {payment.pfms_transaction_ref || "Generating..."}
                </p>
              </div>
            </div>
            {dbtBadge && (
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${dbtBadge.color}`}
              >
                {dbtBadge.label}
              </span>
            )}
          </div>

          {/* Account Credited Info (Strictly Masked) */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiary Name:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {payment.beneficiary_name_masked}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bank & Account:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {payment.bank_name} ({payment.bank_account_masked})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Aadhaar Payment Bridge:</span>
              <span className="font-medium text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Provider status not supplied</span>
              </span>
            </div>
          </div>

          {/* Step progression */}
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-slate-800 block">
              DBT Pipeline Steps:
            </span>
            <div className="space-y-1.5">
              {payment.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/70"
                >
                  <div className="flex items-center gap-2">
                    {st.state === "COMPLETED" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : st.state === "CURRENT" ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={`${
                        st.state === "COMPLETED"
                          ? "text-slate-800 font-medium"
                          : st.state === "CURRENT"
                          ? "text-blue-700 font-bold"
                          : "text-slate-400"
                      }`}
                    >
                      {st.name}
                    </span>
                  </div>
                  {st.timestamp && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(st.timestamp)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pending or Processing Note */}
          {payment.failure_or_pending_reason && (
            <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{payment.failure_or_pending_reason}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
