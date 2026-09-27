"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { studentApi } from "../../lib/api/student";
import { applicationApi } from "../../lib/api/application";
import { documentsApi } from "../../lib/api/documents";
import { scholarshipApi } from "../../lib/api/scholarship";
import { paymentApi } from "../../lib/api/payment";
import {
  StudentProfile,
  Application,
  DocumentItem,
  Deficiency,
  Scholarship,
  PaymentRecord,
} from "../../lib/contracts/types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ApplicationCard } from "../../components/application/ApplicationCard";
import { SchemeCard } from "../../components/scholarship/SchemeCard";
import { formatCurrencyINR } from "../../lib/utils";
import {
  ShieldCheck,
  AlertTriangle,
  FolderLock,
  FileText,
  CreditCard,
  Compass,
  ArrowRight,
  Bot,
  Sparkles,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { useLanguage } from "../../lib/context/LanguageContext";
import { isAuthenticated } from "../../lib/auth/session";

export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(() => studentApi.getCachedProfile());
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [applications, setApplications] = useState<Application[]>(() => applicationApi.getCachedApplications());
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>(() => documentsApi.getCachedDocuments());
  const [scholarships, setScholarships] = useState<Scholarship[]>(() => scholarshipApi.getCachedScholarships());
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated()) { router.replace("/login"); return; }

    async function loadData() {
      const cachedProfile = studentApi.getCachedProfile();
      setProfile(cachedProfile);
      setProfileRefreshing(true);
      setLoadError(null);
      setLoadWarning(null);

      // Every student-scoped resource is independent. No remote service is allowed
      // to keep the whole dashboard in a loading state.
      const [prof, apps, defs, docs, schemes] = await Promise.allSettled([
        studentApi.getProfile(),
        applicationApi.getApplications(),
        applicationApi.getDeficiencies(),
        documentsApi.getDocuments(),
        scholarshipApi.getScholarships(),
      ]);
      if (cancelled) return;

      if (prof.status === "fulfilled") {
        setProfile(prof.value);
      } else if (!cachedProfile) {
        setLoadError(prof.reason instanceof Error ? prof.reason.message : "Your student profile is unavailable.");
      } else {
        setLoadWarning("Live profile refresh is temporarily unavailable. Showing your last cached profile.");
      }
      setProfileRefreshing(false);

      const failures: string[] = [];
      if (apps.status === "fulfilled") setApplications(apps.value); else failures.push("applications");
      if (defs.status === "fulfilled") setDeficiencies(defs.value); else failures.push("action status");
      if (docs.status === "fulfilled") setDocuments(docs.value); else failures.push("documents");
      if (schemes.status === "fulfilled") setScholarships(schemes.value); else failures.push("scholarships");
      if (failures.length) setLoadWarning((prev) => prev || `Some live data is temporarily unavailable: ${failures.join(", ")}.`);

      // The dashboard is ready once profile + primary cards are available.
      // Payment/PFMS enrichment is deliberately non-blocking.
      setIsLoading(false);

      const appList = apps.status === "fulfilled" ? apps.value : [];
      if (appList.length) {
        void Promise.allSettled(appList.map((app) => paymentApi.getPaymentByAppId(app.application_id)))
          .then((paymentResults) => {
            if (cancelled) return;
            const paymentMap: Record<string, PaymentRecord> = {};
            paymentResults.forEach((result, index) => {
              if (result.status === "fulfilled" && result.value) paymentMap[appList[index].application_id] = result.value;
            });
            setPayments(paymentMap);
          });
      }
    }

    void loadData().catch((err) => {
      if (!cancelled) {
        setLoadError(err instanceof Error ? err.message : "Dashboard data could not be loaded.");
        setIsLoading(false);
        setProfileRefreshing(false);
      }
    });
    return () => { cancelled = true; };
  }, [router]);

  const openDeficiencies = deficiencies.filter((d) => d.current_status === "OPEN");
  const verifiedDocsCount = documents.filter((d) => d.document_status === "VERIFIED").length;
  const sanctionedTotal = Object.values(payments).reduce((sum, p) => sum + p.sanction_amount, 0);

  if (isLoading && !profile) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3"><div className="h-20 bg-slate-200 rounded-2xl" /><div className="h-20 bg-slate-200 rounded-2xl" /></div>
        <div className="h-32 bg-slate-200 rounded-2xl" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="p-6 text-center">
        <div className="bg-white border border-red-200 rounded-2xl p-6">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-slate-900">Dashboard could not load</h2>
          <p className="text-xs text-slate-500 mt-1">{loadError || "Your student profile is unavailable."}</p>
          <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {loadWarning && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between gap-2">
          <span>{loadWarning}</span>
          {profileRefreshing && <span className="shrink-0">Refreshing…</span>}
        </div>
      )}
      {/* Student Profile Greeting Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-mota-900 to-mota-800 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {profile.category} ({profile.sub_tribe || "Tribal Beneficiary"})
              </span>
              <span className="text-[11px] text-slate-300 flex items-center gap-1 font-mono">
                {profile.profile_status === "VERIFIED" ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                {profile.profile_status}
              </span>
            </div>
            <h2 className="text-lg font-bold">{profile.full_name}</h2>
            <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
              <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate max-w-[240px]">
                {profile.education.institution_name}
              </span>
            </p>
          </div>

          <Link
            href="/profile"
            className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
          >
            <span className="font-bold text-base">
              {profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST"}
            </span>
          </Link>
        </div>
      </div>

      {/* Urgent Deficiency / Action Centre Banner */}
      {openDeficiencies.length > 0 && (
        <Card className="border-red-300 bg-red-50/80 p-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-900">
                  Action Required on Application
                </h4>
                <span className="text-[10px] bg-red-200 text-red-900 font-bold px-1.5 py-0.5 rounded-md">
                  {openDeficiencies.length} Action
                </span>
              </div>
              <p className="text-xs text-red-800 mt-0.5 leading-snug">
                {openDeficiencies[0].title}: {openDeficiencies[0].affected_field_or_doc}.
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[10px] text-red-600 font-medium">
                  Deadline: {openDeficiencies[0].deadline}
                </span>
                <Link href="/actions">
                  <Button size="sm" variant="danger" className="text-xs h-7 px-3">
                    Resolve Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/applications">
          <Card className="p-3 hover:shadow-md transition-shadow border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">Applications</span>
              <FileText className="w-4 h-4 text-mota-700" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900">
                {applications.length}
              </span>
              <span className="text-[11px] text-slate-400">active</span>
            </div>
          </Card>
        </Link>

        <Link href="/actions">
          <Card
            className={`p-3 hover:shadow-md transition-shadow ${
              openDeficiencies.length > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">Deficiencies</span>
              <AlertTriangle
                className={`w-4 h-4 ${
                  openDeficiencies.length > 0 ? "text-red-600" : "text-slate-400"
                }`}
              />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl font-extrabold ${
                  openDeficiencies.length > 0 ? "text-red-700" : "text-slate-900"
                }`}
              >
                {openDeficiencies.length}
              </span>
              <span className="text-[11px] text-slate-400">pending</span>
            </div>
          </Card>
        </Link>

        <Link href="/documents">
          <Card className="p-3 hover:shadow-md transition-shadow border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">Wallet Docs</span>
              <FolderLock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900">
                {verifiedDocsCount}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">verified</span>
            </div>
          </Card>
        </Link>

        <Link href={applications[0] ? `/applications/${encodeURIComponent(applications[0].application_id)}` : "/applications"}>
          <Card className="p-3 hover:shadow-md transition-shadow border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">DBT Sanction</span>
              <CreditCard className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-teal-700">
                {sanctionedTotal > 0 ? formatCurrencyINR(sanctionedTotal) : "No sanction"}
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick Services Navigation */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Quick Services
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/scholarships"
            className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col items-center text-center hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-1">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">{scholarships.length} Schemes</span>
            <span className="text-[10px] text-slate-400">Discover</span>
          </Link>

          <Link
            href="/eligibility"
            className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col items-center text-center hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Eligibility</span>
            <span className="text-[10px] text-slate-400">Check Fit</span>
          </Link>

          <Link
            href="/jago"
            className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col items-center text-center hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-1">
              <Bot className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Ask JAGO</span>
            <span className="text-[10px] text-slate-400">MoTA AI</span>
          </Link>
        </div>
      </div>

      {/* Active Application Section */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Applications
          </h3>
          <Link
            href="/applications"
            className="text-xs font-semibold text-mota-700 hover:underline flex items-center gap-0.5"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {applications.slice(0, 1).map((app) => (
          <ApplicationCard
            key={app.application_id}
            application={app}
            paymentRecord={payments[app.application_id]}
          />
        ))}
      </div>

      {/* Recommended Scholarship Schemes Section */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Explore Live Schemes
          </h3>
          <Link
            href="/scholarships"
            className="text-xs font-semibold text-mota-700 hover:underline"
          >
            View all schemes
          </Link>
        </div>

        {scholarships.slice(1, 3).map((scheme) => (
          <SchemeCard key={scheme.scheme_id} scholarship={scheme} />
        ))}
      </div>
    </div>
  );
}
