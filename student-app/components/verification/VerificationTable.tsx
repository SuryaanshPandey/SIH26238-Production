"use client";

import React from "react";
import { VerificationAttributeCheck } from "../../lib/contracts/types";
import { Card } from "../ui/Card";
import { getVerificationMatchBadge, formatDateTime } from "../../lib/utils";
import { CheckCircle2, AlertTriangle, Info, Clock, ShieldOff } from "lucide-react";

interface VerificationTableProps {
  checks: VerificationAttributeCheck[];
}

function sourceLabel(source: VerificationAttributeCheck["source_name"]): string {
  const labels: Record<string, string> = {
    DIGILOCKER: "DigiLocker",
    APAAR: "APAAR",
    AISHE: "AISHE",
    UDISE_PLUS: "UDISE+",
    STATE_EDISTRICT: "State e-District",
    UIDAI_TEST: "UIDAI",
  };
  return labels[source] || "Official source";
}

function compactValue(value: string): string {
  const clean = String(value ?? "").trim();
  return clean || "Not available";
}

export function VerificationTable({ checks }: VerificationTableProps) {
  const unavailable = checks.filter((c) => c.match_state === "SOURCE_UNAVAILABLE").length;
  const review = checks.filter((c) => ["MISMATCH", "PENDING_REVIEW"].includes(c.match_state)).length;
  const matched = checks.filter((c) => c.match_state === "MATCH").length;

  if (!checks.length) {
    return (
      <Card className="p-5 text-center">
        <ShieldOff className="w-8 h-8 text-slate-300 mx-auto" />
        <h3 className="mt-2 text-sm font-bold text-slate-800">Verification details unavailable</h3>
        <p className="mt-1 text-xs text-slate-500">No verification records are available for this application yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3.5 bg-slate-50/80">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <p className="font-semibold text-slate-900">Verification is attribute-based</p>
            <p className="mt-0.5">A source mismatch is evidence for official review, not an automatic rejection. An unavailable source leaves the attribute pending.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-center">
          <p className="text-lg font-extrabold text-emerald-700">{matched}</p>
          <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">Matched</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-center">
          <p className="text-lg font-extrabold text-amber-700">{review}</p>
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">Needs review</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
          <p className="text-lg font-extrabold text-slate-700">{unavailable}</p>
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Unavailable</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {checks.map((check) => {
          const badge = getVerificationMatchBadge(check.match_state);
          const unavailableState = check.match_state === "SOURCE_UNAVAILABLE";
          const reviewState = ["MISMATCH", "PENDING_REVIEW"].includes(check.match_state);
          return (
            <Card
              key={check.verification_id}
              className={`p-3.5 ${reviewState ? "border-amber-200 bg-amber-50/30" : unavailableState ? "border-slate-200 bg-slate-50/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{check.attribute_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{unavailableState ? `Verification source: ${sourceLabel(check.source_name)} • unavailable` : `Compared with ${sourceLabel(check.source_name)}`}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              <div className="mt-2.5 rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="p-2.5 bg-white">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Applicant claim</span>
                    <p className="mt-1 text-xs font-semibold text-slate-800 break-words">{compactValue(check.claimed_value)}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Source value</span>
                    <p className={`mt-1 text-xs font-semibold break-words ${unavailableState ? "text-slate-500" : "text-slate-800"}`}>
                      {compactValue(check.source_value)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                {unavailableState ? <ShieldOff className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" /> : reviewState ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                <p>{check.notes}</p>
              </div>

              {check.action_required_detail && (
                <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] ${unavailableState ? "border-slate-200 bg-white text-slate-600" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {check.action_required_detail}
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Checked {formatDateTime(check.verified_at)}</span>
                <span className="font-semibold text-slate-500">{check.review_status.replaceAll("_", " ")}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
