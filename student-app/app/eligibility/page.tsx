"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { scholarshipApi } from "../../lib/api/scholarship";
import { studentApi } from "../../lib/api/student";
import { eligibilityApi } from "../../lib/api/eligibility";
import {
  Scholarship,
  StudentProfile,
  EligibilityAnswers,
  EligibilityEvaluationResult,
  EducationLevel,
} from "../../lib/contracts/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  Building,
} from "lucide-react";
import { formatCurrencyINR } from "../../lib/utils";

function EligibilityForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedSchemeId = searchParams.get("scheme") || "";

  const [schemes, setSchemes] = useState<Scholarship[]>(() => scholarshipApi.getCachedScholarships());
  const [selectedSchemeId, setSelectedSchemeId] = useState(preselectedSchemeId);
  const [profile, setProfile] = useState<StudentProfile | null>(() => studentApi.getCachedProfile({ allowStale: true }));

  // Questionnaire answers prefilled from student's verified profile
  const [category, setCategory] = useState<"ST" | "PVTG" | "OTHER">("ST");
  const [annualIncome, setAnnualIncome] = useState<number>(0);
  const [educationStage, setEducationStage] = useState<EducationLevel>("POST_MATRIC");
  const [course, setCourse] = useState("B.Tech Computer Science");
  const [isRecognized, setIsRecognized] = useState(true);
  const [hasActiveOtherScholarship, setHasActiveOtherScholarship] = useState(false);
  const [isHosteller, setIsHosteller] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Results State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EligibilityEvaluationResult | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedSchemes = scholarshipApi.getCachedScholarships();
    const cachedProfile = studentApi.getCachedProfile({ allowStale: true });
    if (cachedSchemes.length) setSchemes(cachedSchemes);
    if (cachedProfile) {
      setProfile(cachedProfile);
      setCategory(cachedProfile.category);
      setAnnualIncome(cachedProfile.annual_family_income);
      setEducationStage(cachedProfile.education.stage);
      setCourse(cachedProfile.education.course);
      setIsHosteller(cachedProfile.education.is_hosteller);
      setHasActiveOtherScholarship(cachedProfile.has_active_scholarship);
    }
    if (cachedSchemes.length) setIsLoading(false);

    Promise.allSettled([scholarshipApi.getScholarships(), studentApi.getProfile()]).then(([schemesResult, profileResult]) => {
      if (cancelled) return;
      if (schemesResult.status === "fulfilled") setSchemes(schemesResult.value);
      if (profileResult.status === "fulfilled") {
        const prof = profileResult.value;
        setProfile(prof);
        setCategory(prof.category);
        setAnnualIncome(prof.annual_family_income);
        setEducationStage(prof.education.stage);
        setCourse(prof.education.course);
        setIsHosteller(prof.education.is_hosteller);
        setHasActiveOtherScholarship(prof.has_active_scholarship);
      } else if (!cachedProfile) {
        // The questionnaire remains usable without the remote profile; the user can review/enter facts manually.
      }
      if (schemesResult.status === "rejected" && !cachedSchemes.length) {
        setLoadError(schemesResult.reason instanceof Error ? schemesResult.reason.message : "Scholarship catalogue could not be loaded.");
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedSchemeId || !schemes.length) return;
    const preferred = profile?.category && schemes.find((s) => /scheduled tribe|schedule tribe|st students|tribe students/i.test(s.scheme_name));
    setSelectedSchemeId(preferred?.scheme_id || schemes[0].scheme_id);
  }, [profile, schemes, selectedSchemeId]);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEvaluating(true);
    setEvaluationError(null);

    try {
      const answers: EligibilityAnswers = {
        scheme_id: selectedSchemeId,
        category,
        annual_family_income: annualIncome,
        education_stage: educationStage,
        current_class_or_course: course,
        institution_recognized: isRecognized,
        institution_state: profile?.location.state || "",
        has_active_other_scholarship: hasActiveOtherScholarship,
        is_hosteller: isHosteller,
      };

      const activeSchemeForEvaluation = schemes.find((s) => s.scheme_id === answers.scheme_id);
      if (activeSchemeForEvaluation?.source_mode === "SNAPSHOT") {
        const now = new Date();
        const start = new Date(activeSchemeForEvaluation.start_date);
        const end = new Date(activeSchemeForEvaluation.deadline);
        const windowOpen = activeSchemeForEvaluation.status === "OPEN" || (now >= start && now <= end);
        const windowClosed = activeSchemeForEvaluation.status === "CLOSED" || now > end;
        const localChecks = [
          {
            criteria: "APPLICATION_WINDOW",
            passed: windowOpen,
            status: windowClosed ? "FAILED" : "NEEDS_VERIFICATION",
            claimed_value: "Current date",
            threshold_or_rule: `${activeSchemeForEvaluation.start_date} to ${activeSchemeForEvaluation.deadline}`,
            explanation: windowClosed ? "The catalogue metadata indicates that the current application window has closed." : windowOpen ? "The catalogue metadata indicates that the scheme is currently within its application window." : "The application window is not currently open."
          },
          {
            criteria: "OFFICIAL_ELIGIBILITY_RULESET",
            passed: false,
            status: "NEEDS_VERIFICATION",
            claimed_value: "Not imported",
            threshold_or_rule: "Official NSP scheme specification",
            explanation: "The catalogue record does not contain the complete machine-readable eligibility rules required for a final decision."
          }
        ] as const;
        setEvaluationResult({
          scheme_id: activeSchemeForEvaluation.scheme_id,
          scheme_name: activeSchemeForEvaluation.scheme_name,
          status: windowClosed ? "NOT_ELIGIBLE" : "FURTHER_REVIEW",
          overall_verdict: windowClosed
            ? "The official catalogue metadata shows that the application window has closed. Other eligibility criteria were not evaluated because the complete official rule set is not present in the catalogue record."
            : "The official catalogue metadata is available, but the complete machine-readable eligibility rules are not present. This pre-check can show the application window, but it cannot make a final eligibility decision.",
          confidence_score: 0,
          checks: localChecks.map((check) => ({ ...check })),
          recommended_actions: [
            "Open the official NSP scheme specification and verify the current eligibility rules.",
            ...(windowOpen ? ["Prepare the required documents and continue with the application flow."] : ["Check the next official application window before applying."])
          ],
          evaluated_at: new Date().toISOString(),
        });
        return;
      }

      const result = await eligibilityApi.evaluateEligibility(answers);
      setEvaluationResult(result);
    } catch (err) {
      setEvaluationError(err instanceof Error ? err.message : "Eligibility could not be evaluated right now.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    setEvaluationResult(null);
    setEvaluationError(null);
  };

  const activeScheme = schemes.find((s) => s.scheme_id === selectedSchemeId);

  if (isLoading) return <div className="p-4 text-center text-xs text-slate-400">Loading eligibility data...</div>;
  if (loadError || !schemes.length) return <div className="p-6 text-center"><div className="bg-white border border-red-200 rounded-2xl p-6"><p className="text-sm font-bold text-slate-900">Scholarship catalogue could not load</p><p className="text-xs text-slate-500 mt-1">{loadError || "No official scholarship schemes are currently available."}</p><Link href="/scholarships" className="inline-flex mt-3 text-xs font-semibold text-mota-800">Back to Scholarships</Link></div></div>;

  return (
    <div className="space-y-4">
      {activeScheme?.source_mode === "SNAPSHOT" && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
          <strong>Catalogue metadata only.</strong> This record contains the official scheme name and application window, but not the complete machine-readable eligibility rules. The result below is therefore a pre-check and cannot approve or reject an application.
        </div>
      )}
      {!profile && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
          <strong>Profile refresh unavailable.</strong> You can still review the questionnaire using the values already on screen. A final decision always requires verified student facts.
        </div>
      )}
      {evaluationError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800" role="alert">
          <strong>Evaluation failed.</strong> {evaluationError}
        </div>
      )}

      {/* Target Scheme Selector */}
      <Card className="bg-white border-slate-200">
        <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
          Target Scholarship Scheme
        </label>
        <select
          value={selectedSchemeId}
          onChange={(e) => {
            setSelectedSchemeId(e.target.value);
            setEvaluationResult(null);
          }}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700"
        >
          {schemes.map((s) => (
            <option key={s.scheme_id} value={s.scheme_id}>
              {s.scheme_name} ({s.scheme_code})
            </option>
          ))}
        </select>
        {activeScheme && (
          <p className="text-[11px] text-slate-500 mt-2">
            <strong>Target Group:</strong> {activeScheme.target_group}
          </p>
        )}
      </Card>

      {/* Questionnaire Form (if not yet evaluated) */}
      {!evaluationResult && (
        <Card className="border-slate-200">
          <form onSubmit={handleEvaluate} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Community / Social Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["ST", "PVTG", "OTHER"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                      category === cat
                        ? "bg-mota-800 text-white border-mota-800"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {cat === "PVTG" ? "PVTG (Tribal)" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Annual Income */}
            <Input
              label="Annual Family Income (in ₹)"
              type="number"
              value={annualIncome.toString()}
              onChange={(e) => setAnnualIncome(Number(e.target.value))}
              helperText={`Scheme Ceiling: ${
                activeScheme && activeScheme.income_ceiling > 0 && activeScheme.income_ceiling < 99999999
                  ? `≤ ${formatCurrencyINR(activeScheme.income_ceiling)}`
                  : "Not available in catalogue"
              }`}
              required
            />

            {/* Education Stage */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Education Stage
              </label>
              <select
                value={educationStage}
                onChange={(e) =>
                  setEducationStage(e.target.value as EducationLevel)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700"
              >
                <option value="PRE_MATRIC">Pre-MatRIC (Class IX - X)</option>
                <option value="POST_MATRIC">Post-Matric (Class XI - XII / Diploma / UG)</option>
                <option value="HIGHER_EDUCATION">Top Class Professional (IIT / NIT / IIM)</option>
                <option value="FELLOWSHIP">Research Fellowship (M.Phil / Ph.D.)</option>
                <option value="OVERSEAS">Overseas University Studies (Masters / Ph.D.)</option>
              </select>
            </div>

            {/* Course / Program */}
            <Input
              label="Course / Class Name"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
            />

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-[11px] text-slate-600">
              <span className="text-xs font-semibold text-slate-800 block">Additional verification factors</span>
              <p>Concurrent scholarship, institution recognition, and hosteller status can be scheme-specific. They are shown from profile data where available and are not treated as universal eligibility rules.</p>
              <div className="grid grid-cols-1 gap-1">
                <span>Concurrent scholarship on profile: <strong>{hasActiveOtherScholarship ? "Yes" : "No"}</strong></span>
                <span>Institution recognition on profile: <strong>{isRecognized ? "Available" : "Not confirmed"}</strong></span>
                <span>Hosteller status on profile: <strong>{isHosteller ? "Hosteller" : "Day scholar"}</strong></span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gap-2 shadow-md"
              isLoading={isEvaluating}
            >
              <span>Run Eligibility Pre-check</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* Evaluation Results Card */}
      {evaluationResult && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card
            className={`border-2 ${
              evaluationResult.status === "ELIGIBLE"
                ? "border-emerald-500 bg-emerald-50/20"
                : evaluationResult.status === "FURTHER_REVIEW"
                  ? "border-amber-400 bg-amber-50/20"
                  : "border-red-400 bg-red-50/20"
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              {evaluationResult.status === "ELIGIBLE" ? (
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : evaluationResult.status === "FURTHER_REVIEW" ? (
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <AlertCircle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <XCircle className="w-6 h-6" />
                </div>
              )}

              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    evaluationResult.status === "ELIGIBLE"
                      ? "bg-emerald-100 text-emerald-800"
                      : evaluationResult.status === "FURTHER_REVIEW"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {evaluationResult.status === "ELIGIBLE"
                    ? "Pre-check passed"
                    : evaluationResult.status === "FURTHER_REVIEW"
                      ? "Further verification required"
                      : "Pre-check failed"}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {evaluationResult.scheme_name}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-200/80">
              {evaluationResult.overall_verdict}
            </p>

            {evaluationResult.status === "FURTHER_REVIEW" && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                This is not a rejection. The available catalogue data is insufficient for a final eligibility decision; required official rules or facts still need verification.
              </div>
            )}

            {/* Criteria Breakdown */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Rule Evaluation Breakdown:
              </span>

              {evaluationResult.checks.map((chk, i) => (
                <div
                  key={`${chk.criteria}-${i}`}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    chk.passed
                      ? "bg-white border-slate-200"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : chk.status === "NEEDS_VERIFICATION" || chk.status === "MISSING_INFORMATION" ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {chk.criteria}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          chk.passed ? "text-emerald-700" : chk.status === "NEEDS_VERIFICATION" || chk.status === "MISSING_INFORMATION" ? "text-amber-700" : "text-red-700"
                        }`}
                      >
                        {chk.passed ? "PASSED" : chk.status === "NEEDS_VERIFICATION" ? "REVIEW" : chk.status === "MISSING_INFORMATION" ? "MISSING" : "FAILED"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {chk.explanation}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Steps / Actions */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
              <span className="text-xs font-semibold text-slate-800 block">
                Recommended Actions:
              </span>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {evaluationResult.recommended_actions.map((act, i) => (
                  <li key={i}>{act}</li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="mt-5 space-y-2">
              {evaluationResult.status === "ELIGIBLE" && (
                <Link
                  href={`/applications/new?scheme=${evaluationResult.scheme_id}`}
                  className="w-full block"
                >
                  <Button size="lg" className="w-full gap-2 shadow-md">
                    <span>Proceed to Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                size="md"
                onClick={handleReset}
                className="w-full gap-1.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-check / Change Answers</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function EligibilityPage() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Eligibility Pre-check
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Check your profile against the scheme metadata currently available. Final eligibility follows the official scheme rules.
        </p>
      </div>

      <Suspense fallback={<div className="p-4 text-center text-xs text-slate-400">Loading questionnaire...</div>}>
        <EligibilityForm />
      </Suspense>
    </div>
  );
}
