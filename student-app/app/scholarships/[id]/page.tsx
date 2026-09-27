"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { scholarshipApi } from "../../../lib/api/scholarship";
import { Scholarship } from "../../../lib/contracts/types";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyINR, formatDate } from "../../../lib/utils";
import { getScholarshipApplicationAvailability } from "../../../lib/scholarshipAvailability";
import {
  ArrowLeft,
  Calendar,
  Building,
  Award,
  FileText,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Info,
} from "lucide-react";

export default function ScholarshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [scheme, setScheme] = useState<Scholarship | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    scholarshipApi.getScholarshipById(params.id as string).then((data) => {
      if (!cancelled) setScheme(data);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Scholarship details could not be loaded.");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [params.id]);

  if (isLoading) {
    return <div className="p-4 text-center text-xs text-slate-400">Loading scheme guidelines...</div>;
  }

  if (!scheme) {
    return (
      <div className="p-4 text-center space-y-3">
        <p className="text-xs text-slate-600">{error || "Scheme not found."}</p>
        <Link href="/scholarships">
          <Button size="sm">Back to Schemes</Button>
        </Link>
      </div>
    );
  }

  const educationLabel: Record<string, string> = { PRE_MATRIC: "Pre-Matric", POST_MATRIC: "Post-Matric", HIGHER_EDUCATION: "Higher Education", FELLOWSHIP: "Fellowship", OVERSEAS: "Overseas" };
  const applicationAvailability = getScholarshipApplicationAvailability(scheme);
  const statusClass = scheme.status === "OPEN"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : scheme.status === "UPCOMING"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : scheme.status === "INFORMATION_ONLY"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <div className="p-4 space-y-4">
      {/* Back button */}
      <Link
        href="/scholarships"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Discovery</span>
      </Link>

      {scheme.source_mode === "SNAPSHOT" && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>Official NSP snapshot in use.</strong> Catalogue metadata is available, but eligibility, benefits, and documents must be confirmed in the official NSP specification.</span>
        </div>
      )}

      {/* Scheme Title & Badges */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={scheme.source_mode === "SNAPSHOT" ? "default" : "info"} className="text-[11px]">
            {scheme.source_mode === "SNAPSHOT" ? "Official NSP Snapshot" : "NSP Scheme"} • {educationLabel[scheme.education_level] || "Scheme"}
          </Badge>
          <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
            {scheme.scheme_code}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusClass}`}>
            ● Status: {scheme.status === "OPEN" ? "Applications Open" : scheme.status === "INFORMATION_ONLY" ? "Information Only" : scheme.status}
          </span>
        </div>

        <h1 className="text-lg font-bold text-slate-900 leading-snug">
          {scheme.scheme_name}
        </h1>

        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          <span>{scheme.ministry}</span>
        </p>
      </div>

      {/* Key Timeline Info */}
      <Card className="bg-slate-50/80 border-slate-200 p-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium">
              Academic Cycle
            </span>
            <span className="font-bold text-slate-800 block mt-0.5">
              {scheme.academic_year}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium">
              Application Deadline
            </span>
            <span className="font-bold text-red-700 block mt-0.5">
              {scheme.deadline ? formatDate(scheme.deadline) : "Not published"}
            </span>
          </div>
        </div>
      </Card>

      {/* Scheme Description */}
      <Card>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-1">
          Scheme Objective & Target Group
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {scheme.description}
        </p>
        <div className="mt-2.5 p-2 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200/70">
          <strong>Target Beneficiary:</strong> {scheme.target_group}
        </div>
      </Card>

      {/* Eligibility from official source */}
      <Card className="border-blue-200 bg-blue-50/30">
        <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider mb-2 border-b border-blue-100 pb-1">
          Eligibility Information
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          {scheme.selection_criteria}
        </p>
        <p className="mt-2 text-[10px] text-slate-500">
          This text is extracted from the cited official source when available. Final eligibility is determined by the competent authority.
        </p>
      </Card>

      {/* Financial Assistance & Benefits */}
      <Card className="border-teal-200 bg-teal-50/20">
        <h3 className="text-xs font-bold text-teal-950 uppercase tracking-wider mb-2 border-b border-teal-100 pb-1">
          Grant Breakdown & Allowances
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center bg-white/80 p-2 rounded-lg border border-teal-100">
            <span className="text-slate-600">Maintenance Allowance:</span>
            <span className="font-bold text-slate-900">
              {scheme.benefits.maintenance_allowance_per_annum > 0
                ? `${formatCurrencyINR(scheme.benefits.maintenance_allowance_per_annum)} / year`
                : "As per course grouping"}
            </span>
          </div>

          <div className="flex justify-between items-center bg-white/80 p-2 rounded-lg border border-teal-100">
            <span className="text-slate-600">Tuition Fee:</span>
            <span className="font-bold text-teal-800 text-right max-w-[190px]">
              {scheme.benefits.tuition_fee_coverage}
            </span>
          </div>

          {scheme.benefits.books_and_stationery_allowance && (
            <div className="flex justify-between items-center bg-white/80 p-2 rounded-lg border border-teal-100">
              <span className="text-slate-600">Books & Stationery:</span>
              <span className="font-bold text-slate-900">
                {formatCurrencyINR(scheme.benefits.books_and_stationery_allowance)} / yr
              </span>
            </div>
          )}

          <div className="pt-1 space-y-1">
            <span className="text-[11px] font-semibold text-teal-900 block">
              Additional Support:
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
              {scheme.benefits.additional_benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Mandatory Documents Checklist */}
      <Card>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
          Required Documents for Application
        </h3>

        <div className="space-y-2">
          {scheme.required_documents.map((doc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-mota-700 shrink-0" />
                <span className="font-medium text-slate-800">
                  {doc.document_name}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Check source availability
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Implementation Channel Note */}
      <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
        <span className="font-semibold text-slate-800 block">
          Application Channel: {scheme.application_channel} ({scheme.portal_name})
        </span>
        <p className="text-[11px] leading-relaxed">
          This application uses the live scheme record shown above. Government documents are only reused after an authorized source connection returns a matching record; otherwise you can upload supporting files.
        </p>
      </div>

      {/* Official source evidence */}
      {scheme.source_evidence && scheme.source_evidence.length > 0 && (
        <Card className="border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
            Official Sources
          </h3>
          <div className="space-y-2">
            {scheme.source_evidence.map((source) => (
              <a
                key={`${source.source_id}|${source.source_url}`}
                href={source.source_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-800 truncate">{source.source_name}</span>
                  <span className="block text-[10px] text-slate-400 truncate">{source.extraction_method}</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Sticky Bottom CTAs */}
      <div className="pt-2 pb-4 space-y-2">
        <Link
          href={`/eligibility?scheme=${scheme.scheme_id}`}
          className="w-full block"
        >
          <Button size="lg" className="w-full gap-2 shadow-md">
            <span>Check My Eligibility</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        {applicationAvailability.canApply ? (
          <Link
            href={`/applications/new?scheme=${scheme.scheme_id}`}
            className="w-full block"
          >
            <Button variant="outline" size="md" className="w-full">
              Proceed Directly to Application
            </Button>
          </Link>
        ) : (
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <p className="font-semibold">Application not available right now</p>
            <p className="mt-1 leading-relaxed">{applicationAvailability.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
