"use client";

import React from "react";
import Link from "next/link";
import { Scholarship } from "../../lib/contracts/types";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatCurrencyINR, formatDate } from "../../lib/utils";
import { Calendar, Award, Building, ArrowRight, CheckCircle2 } from "lucide-react";

interface SchemeCardProps {
  scholarship: Scholarship;
}

export function SchemeCard({ scholarship }: SchemeCardProps) {
  const educationLabel: Record<string, string> = {
    PRE_MATRIC: "Pre-Matric",
    POST_MATRIC: "Post-Matric",
    HIGHER_EDUCATION: "Higher Education",
    FELLOWSHIP: "Fellowship",
    OVERSEAS: "Overseas",
  };
  const sourceLabel = scholarship.source_mode === "SNAPSHOT" ? "Official NSP Snapshot" : scholarship.source_system === "OFFICIAL_AGGREGATED" ? `Official • ${Math.max(1, scholarship.source_count || 1)} source${(scholarship.source_count || 1) > 1 ? "s" : ""}` : "NSP Scheme";
  const statusLabel = scholarship.status === "OPEN"
    ? "Applications Open"
    : scholarship.status === "UPCOMING"
      ? "Applications Upcoming"
      : scholarship.status === "INFORMATION_ONLY"
        ? "Window Not Published"
        : "Applications Closed";
  const statusClass = scholarship.status === "OPEN"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : scholarship.status === "UPCOMING"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : scholarship.status === "INFORMATION_ONLY"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <Card className="hover:shadow-md transition-shadow border-slate-200/80">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge
          variant={scholarship.source_mode === "SNAPSHOT" ? "default" : scholarship.status === "INFORMATION_ONLY" ? "warning" : "info"}
          className="text-[11px] font-semibold tracking-wide uppercase"
        >
          {sourceLabel} • {educationLabel[scholarship.education_level] || "Scheme"}
        </Badge>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
          ● {statusLabel}
        </span>
      </div>

      <h3 className="text-base font-bold text-slate-900 leading-snug">
        {scholarship.scheme_name}
      </h3>

      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
        {scholarship.description}
      </p>

      {/* Key Metrics / Highlights */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
            Allowance
          </span>
          <span className="font-bold text-slate-800">
            {scholarship.benefits.maintenance_allowance_per_annum > 0
              ? `${formatCurrencyINR(scholarship.benefits.maintenance_allowance_per_annum)} / yr`
              : "As per rules"}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
            Income Ceiling
          </span>
          <span className="font-bold text-slate-800">
            {scholarship.income_ceiling != null && scholarship.income_ceiling >= 99999999
              ? "No Ceiling"
              : scholarship.income_ceiling != null && scholarship.income_ceiling > 0 ? `≤ ${formatCurrencyINR(scholarship.income_ceiling)}` : "See official scheme rules"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-1">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Deadline: {scholarship.deadline ? formatDate(scholarship.deadline) : "Not published"}</span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate max-w-[120px]">{scholarship.portal_name}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>{scholarship.source_count ? `${scholarship.source_count} official source${scholarship.source_count > 1 ? "s" : ""}` : "Official source"}</span>
        <span>{scholarship.source_fetched_at ? `Checked ${new Date(scholarship.source_fetched_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : "Source date unavailable"}</span>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
        <Link href={`/scholarships/${scholarship.scheme_id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            Details
          </Button>
        </Link>
        <Link
          href={`/eligibility?scheme=${scholarship.scheme_id}`}
          className="flex-1"
        >
          <Button size="sm" className="w-full gap-1">
            <span>Check Eligibility</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
