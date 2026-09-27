"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { applicationApi } from "../../../lib/api/application";
import { verificationApi } from "../../../lib/api/verification";
import { paymentApi } from "../../../lib/api/payment";
import { Application, VerificationAttributeCheck, SanctionDetails, PaymentRecord } from "../../../lib/contracts/types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TimelineTracker } from "../../../components/application/TimelineTracker";
import { VerificationTable } from "../../../components/verification/VerificationTable";
import { PaymentTracker } from "../../../components/payment/PaymentTracker";
import { getApplicationStageBadge, getDbtPaymentBadge, formatDate } from "../../../lib/utils";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  AlertTriangle,
  CreditCard,
  FileCheck2,
  History,
  ShieldCheck,
  ChevronRight,
  Info,
  UploadCloud,
} from "lucide-react";

function humanizeSchemeName(value: string): string {
  const cleaned = String(value || "")
    .replace(/^nsp_(?:snapshot|live)_/i, "")
    .replace(/^snapshot_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Scholarship application";
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeStage(value: string): string {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function countStates(checks: VerificationAttributeCheck[]) {
  return {
    matched: checks.filter((c) => c.match_state === "MATCH").length,
    review: checks.filter((c) => ["MISMATCH", "PENDING_REVIEW"].includes(c.match_state)).length,
    unavailable: checks.filter((c) => c.match_state === "SOURCE_UNAVAILABLE").length,
    total: checks.length,
  };
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [application, setApplication] = useState<Application | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationAttributeCheck[]>([]);
  const [sanction, setSanction] = useState<SanctionDetails | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "VERIFICATION" | "PAYMENT">("OVERVIEW");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.allSettled([
      applicationApi.getApplicationById(id),
      applicationApi.getApplicationDocuments(id),
      verificationApi.getVerificationChecks(id),
      paymentApi.getSanctionByAppId(id),
      paymentApi.getPaymentByAppId(id),
    ]).then(([appResult, docsResult, checksResult, sanctionResult, paymentResult]) => {
      if (cancelled) return;

      if (appResult.status === "fulfilled") {
        const app = appResult.value;
        if (app && docsResult.status === "fulfilled") {
          app.submitted_documents = docsResult.value.map((doc) => ({
            document_id: doc.document_id,
            document_type: doc.document_type,
            document_name: doc.document_name,
            source: doc.source,
          }));
        }
        setApplication(app);
        if (!app) setLoadError("Application not found.");
      } else {
        setLoadError(appResult.reason instanceof Error ? appResult.reason.message : "Application details could not be loaded.");
      }

      if (checksResult.status === "fulfilled") {
        setVerificationChecks(checksResult.value);
      } else {
        setVerificationError(checksResult.reason instanceof Error ? checksResult.reason.message : "Verification details could not be loaded.");
      }
      if (sanctionResult.status === "fulfilled") setSanction(sanctionResult.value);
      if (paymentResult.status === "fulfilled") setPayment(paymentResult.value);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  const verificationSummary = useMemo(() => countStates(verificationChecks), [verificationChecks]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
        <Card className="p-4 space-y-3">
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-5/6 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-slate-200 rounded animate-pulse" />
        </Card>
        <div className="grid grid-cols-3 gap-2"><div className="h-16 bg-slate-100 rounded-xl"/><div className="h-16 bg-slate-100 rounded-xl"/><div className="h-16 bg-slate-100 rounded-xl"/></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-4 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-xs text-slate-600">{loadError || "Application not found."}</p>
        <Link href="/applications"><Button size="sm">Back to Applications</Button></Link>
      </div>
    );
  }

  const badge = getApplicationStageBadge(application.current_stage as any);
  const isActionRequired = application.current_stage === "ACTION_REQUIRED";
  const schemeTitle = humanizeSchemeName(application.scheme_name);
  const stageTitle = humanizeStage(application.current_stage);
  const displayStageBadge = badge.label === application.current_stage ? stageTitle : badge.label;

  return (
    <div className="p-3.5 pb-6 space-y-3.5">
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" />
        My Applications
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-mota-900 to-mota-800 p-4 text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">Application</p>
              <h1 className="mt-1 text-lg font-extrabold leading-tight">{schemeTitle}</h1>
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold border bg-white ${badge.color}`}>
              {displayStageBadge}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/85">
            <div className="flex items-center gap-1.5 min-w-0"><Building2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{application.institution_name}</span></div>
            <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" /><span>{application.academic_year}</span></div>
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-2 text-[10px] border-t border-slate-100">
          <span className="font-mono font-semibold text-slate-500 break-all">{application.application_id}</span>
          <span className="text-slate-400">Submitted {formatDate(application.submitted_at)}</span>
        </div>
      </Card>

      {isActionRequired && (
        <Card className="p-3.5 bg-red-50 border-red-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-900">Action required</p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-800">A discrepancy needs official review. Your application is not automatically rejected.</p>
              <Link href="/actions" className="inline-flex mt-2 text-[11px] font-bold text-red-700">Open Action Centre <ChevronRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><p className="text-xl font-extrabold text-slate-900">{verificationSummary.total}</p><p className="text-[10px] text-slate-500">Checks</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-extrabold text-emerald-700">{verificationSummary.matched}</p><p className="text-[10px] text-slate-500">Matched</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-extrabold text-amber-700">{verificationSummary.review + verificationSummary.unavailable}</p><p className="text-[10px] text-slate-500">Pending</p></Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-3">
          {([
            ["OVERVIEW", "Overview", History],
            ["VERIFICATION", "Verification", ShieldCheck],
            ["PAYMENT", "Payment / DBT", CreditCard],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 ${activeTab === tab ? "border-mota-700 text-mota-700 bg-mota-50/40" : "border-transparent text-slate-500"}`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "OVERVIEW" && (
        <div className="space-y-3">
          <Card className="p-3.5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current stage</p>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900">{stageTitle}</h2>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${badge.color}`}>{displayStageBadge}</span>
            </div>
            <TimelineTracker events={application.timeline} />
          </Card>

          <Card className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Application documents</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Documents linked to this application are shown here.</p>
              </div>
              <FileCheck2 className="w-5 h-5 text-mota-700" />
            </div>
            <div className="mt-3 space-y-2">
              {application.submitted_documents.length ? application.submitted_documents.map((doc) => (
                <div key={doc.document_id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-800 truncate">{doc.document_name}</p><p className="text-[10px] text-slate-400 mt-0.5">{doc.document_type.replaceAll("_", " ")}</p></div>
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0">{doc.source === "STUDENT_UPLOAD" ? "Student upload" : doc.source}</span>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <FileCheck2 className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="mt-1.5 text-xs font-semibold text-slate-700">No documents linked yet</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Your wallet may contain documents that have not been attached to this application.</p>
                  <Link href="/documents" className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-mota-700"><UploadCloud className="w-3.5 h-3.5" /> Open Document Wallet</Link>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-3.5 bg-blue-50/60 border-blue-100">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-blue-900">Verification and payment are independent stages. A payment-provider delay does not change your application decision.</p>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "VERIFICATION" && (
        <div className="space-y-3">
          {verificationError && (
            <Card className="p-3 bg-amber-50 border-amber-200"><p className="text-xs text-amber-900">{verificationError}</p></Card>
          )}
          <VerificationTable checks={verificationChecks} />
        </div>
      )}

      {activeTab === "PAYMENT" && (
        <div className="space-y-3">
          {payment && (
            <Card className="p-3.5 flex items-center justify-between gap-2">
              <div><p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">DBT / PFMS</p><p className="text-sm font-bold text-slate-900 mt-0.5">Payment status</p></div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getDbtPaymentBadge(payment.dbt_state).color}`}>{getDbtPaymentBadge(payment.dbt_state).label}</span>
            </Card>
          )}
          <PaymentTracker sanction={sanction} payment={payment} />
        </div>
      )}
    </div>
  );
}
