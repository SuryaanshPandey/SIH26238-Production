"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { scholarshipApi } from "../../../lib/api/scholarship";
import { studentApi } from "../../../lib/api/student";
import { documentsApi } from "../../../lib/api/documents";
import { applicationApi } from "../../../lib/api/application";
import { getScholarshipApplicationAvailability } from "../../../lib/scholarshipAvailability";
import {
  Scholarship,
  StudentProfile,
  DocumentItem,
  Application,
} from "../../../lib/contracts/types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  FolderLock,
  Lock,
} from "lucide-react";

function NewApplicationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSchemeId = searchParams.get("scheme") || "";

  const [scheme, setScheme] = useState<Scholarship | null>(null);
  const [availableSchemes, setAvailableSchemes] = useState<Scholarship[]>(() => scholarshipApi.getCachedScholarships());
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [walletDocs, setWalletDocs] = useState<DocumentItem[]>(() => documentsApi.getCachedDocuments());
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  // Wizard state: 1: Profile Confirmation, 2: Course & Details, 3: Documents, 4: Review & Consent, 5: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [course, setCourse] = useState("B.Tech in Computer Science");
  const [isHosteller, setIsHosteller] = useState(true);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [consentGranted, setConsentGranted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdApp, setCreatedApp] = useState<Application | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    const cachedSchemes = scholarshipApi.getCachedScholarships();
    const cachedProfile = studentApi.getCachedProfile();
    if (cachedSchemes.length) {
      setAvailableSchemes(cachedSchemes);
      if (requestedSchemeId) setScheme(cachedSchemes.find((item) => item.scheme_id === requestedSchemeId) || null);
    }
    if (cachedProfile) {
      setProfile(cachedProfile);
      setCourse(cachedProfile.education.course);
      setIsHosteller(cachedProfile.education.is_hosteller);
    }

    void scholarshipApi.getScholarships().then((items) => {
      if (cancelled) return;
      setAvailableSchemes(items);
      if (requestedSchemeId) {
        const selected = items.find((item) => item.scheme_id === requestedSchemeId) || null;
        setScheme(selected);
        if (!selected) setLoadError("The selected scholarship scheme is no longer available.");
      }
    }).catch((error) => {
      if (!cancelled && !cachedSchemes.length) setLoadError(error instanceof Error ? error.message : "Scholarship catalogue could not be loaded.");
    });

    void studentApi.getProfile().then((prof) => {
      if (cancelled) return;
      setProfile(prof);
      setCourse(prof.education.course);
      setIsHosteller(prof.education.is_hosteller);
    }).catch((error) => {
      if (!cancelled && !cachedProfile) setLoadError(error instanceof Error ? error.message : "Your student profile could not be loaded.");
    });

    const cachedDocs = documentsApi.getCachedDocuments();
    if (cachedDocs.length) {
      setWalletDocs(cachedDocs);
      setSelectedDocIds(cachedDocs.filter((d) => d.document_status === "VERIFIED").map((d) => d.document_id));
    }
    setIsDocumentsLoading(true);
    setDocumentsError(null);
    void documentsApi.getDocuments().then((docs) => {
      if (cancelled) return;
      setWalletDocs(docs);
      setSelectedDocIds((current) => current.length ? current.filter((id) => docs.some((d) => d.document_id === id)) : docs.filter((d) => d.document_status === "VERIFIED").map((d) => d.document_id));
    }).catch((error) => {
      if (!cancelled) setDocumentsError(error instanceof Error ? error.message : "Document wallet could not be loaded.");
    }).finally(() => {
      if (!cancelled) setIsDocumentsLoading(false);
    });
    return () => { cancelled = true; };
  }, [requestedSchemeId]);

  if (!scheme && !requestedSchemeId) {
    return (
      <div className="space-y-4">
        <Link href="/applications" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="w-3.5 h-3.5" />Cancel</Link>
        <Card className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-mota-700">New Application</p>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">Choose a scholarship scheme</h2>
            <p className="text-xs text-slate-500 mt-1">Select the scheme you want to apply for. Your student profile will be reused in the next steps.</p>
          </div>
          {loadError && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800">{loadError}</div>}
          <label className="block text-xs font-medium text-slate-700">Scholarship Scheme
            <select id="new-application-scheme" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900" defaultValue="" onChange={(e) => { const picked = availableSchemes.find((item) => item.scheme_id === e.target.value) || null; setScheme(picked); }}>
              <option value="" disabled>{availableSchemes.length ? "Select a scheme" : "No schemes available"}</option>
              {availableSchemes.map((item) => <option key={item.scheme_id} value={item.scheme_id}>{item.scheme_name}</option>)}
            </select>
          </label>
          <Link href="/scholarships" className="text-xs font-semibold text-mota-800 inline-flex items-center gap-1">Need to compare schemes first <ArrowRight className="w-3 h-3" /></Link>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return <div className="p-6 text-center"><div className="bg-white border border-slate-200 rounded-2xl p-6"><p className="text-sm font-bold text-slate-900">Preparing your application</p><p className="text-xs text-slate-500 mt-1">{loadError || "Loading your student profile..."}</p>{loadError && <Link href="/dashboard" className="inline-flex mt-3 text-xs font-semibold text-mota-800">Back to Dashboard</Link>}</div></div>;
  }

  const applicationAvailability = getScholarshipApplicationAvailability(scheme);
  if (!applicationAvailability.canApply) {
    return (
      <div className="space-y-4">
        <Link
          href={`/scholarships/${scheme.scheme_id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Scheme</span>
        </Link>

        <Card className="space-y-4 border-amber-200 bg-amber-50/60">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Application unavailable</p>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">{scheme.scheme_name}</h2>
            <p className="text-xs text-slate-700 mt-2 leading-relaxed">{applicationAvailability.message}</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-white/80 p-3 text-xs text-slate-700 space-y-1.5">
            <div className="flex justify-between gap-4"><span>Catalogue status</span><strong>{scheme.status}</strong></div>
            <div className="flex justify-between gap-4"><span>Application start</span><strong>{scheme.start_date ? new Date(scheme.start_date).toLocaleDateString("en-IN") : "Not published"}</strong></div>
            <div className="flex justify-between gap-4"><span>Application deadline</span><strong>{scheme.deadline ? new Date(scheme.deadline).toLocaleDateString("en-IN") : "Not published"}</strong></div>
          </div>

          <div className="flex gap-2">
            <Link href={`/scholarships/${scheme.scheme_id}`} className="flex-1">
              <Button size="md" className="w-full">View Scheme</Button>
            </Link>
            <Link href="/scholarships" className="flex-1">
              <Button variant="outline" size="md" className="w-full">Find Open Schemes</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleDocToggle = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleFinalSubmit = async () => {
    if (!consentGranted) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const app = await applicationApi.submitApplication({
        scheme_id: scheme.scheme_id,
        student_id: profile.student_id,
        course,
        is_hosteller: isHosteller,
        submitted_document_ids: selectedDocIds,
        academic_year: profile.education.academic_year,
        consent_granted: consentGranted,
      });
      setCreatedApp(app);
      setStep(5);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Your application could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {submitError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800" role="alert">
          <strong>Submission failed.</strong> {submitError}
        </div>
      )}
      {/* Top back button */}
      <Link
        href={`/scholarships/${scheme.scheme_id}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Cancel Application</span>
      </Link>

      {/* Wizard Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
          <span>Step {step} of 4: {
            step === 1 ? "Student Identity" :
            step === 2 ? "Course Details" :
            step === 3 ? "Document Wallet" :
            step === 4 ? "Declaration & Submit" : "Confirmed"
          }</span>
          <span className="text-[11px] text-mota-700 font-bold">{step * 25}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-mota-700 transition-all duration-300"
            style={{ width: `${Math.min(step * 25, 100)}%` }}
          />
        </div>
      </div>

      {/* Target Scheme Ribbon */}
      <div className="p-2.5 bg-mota-50 border border-mota-200 rounded-xl text-xs text-mota-900 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-mota-700 block">
            Applying For
          </span>
          <span className="font-bold">{scheme.scheme_name}</span>
        </div>
        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-mota-200">
          {scheme.academic_year}
        </span>
      </div>

      {/* Step 1: Student Identity & Verified Attributes */}
      {step === 1 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Student Identity
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Details come from your student account. Government-source attributes appear here only after an authorized source has returned them.
          </p>

          <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex justify-between">
              <span className="text-slate-400">Full Name:</span>
              <span className="font-bold text-slate-900">{profile.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date of Birth:</span>
              <span className="font-medium text-slate-800">{profile.dob}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Category:</span>
              <span className="font-bold text-amber-800">
                {profile.category} ({profile.sub_tribe || "Tribal"})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">APAAR ID:</span>
              <span className="font-mono font-medium text-slate-800">
                {profile.identifier_refs.apaar_token}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Aadhaar (Last 4):</span>
              <span className="font-mono font-medium text-slate-800">
                {profile.identifier_refs.masked_aadhaar_last4}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button size="md" onClick={() => setStep(2)} className="gap-1 text-xs">
              <span>Confirm & Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Course & Scheme Specific Details */}
      {step === 2 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-mota-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Course & Enrollment
            </h3>
          </div>

          <Input
            label="College / Institution"
            value={profile.education.institution_name}
            disabled
          />

          <Input
            label="Current Course / Degree"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Hostel / Day Scholar Accommodation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsHosteller(true)}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                  isHosteller
                    ? "bg-mota-800 text-white border-mota-800"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                Hosteller (Higher Allowance)
              </button>
              <button
                type="button"
                onClick={() => setIsHosteller(false)}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                  !isHosteller
                    ? "bg-mota-800 text-white border-mota-800"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                Day Scholar
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="md" onClick={() => setStep(3)} className="gap-1 text-xs">
              <span>Next: Documents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Document Wallet Selection */}
      {step === 3 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FolderLock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Select Reusable Documents
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Select documents from your unified Document Wallet to attach with this application. Verified documents are marked clearly; student uploads remain student-provided until verification.
          </p>

          {documentsError && <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">{documentsError}</div>}
          {isDocumentsLoading && !walletDocs.length ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-[11px] text-slate-500">Loading your document wallet…</div>
          ) : walletDocs.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
              <p className="text-xs font-semibold text-slate-700">No documents uploaded yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Upload the certificates required for this scheme and return here to attach them.</p>
              <Link href="/documents" className="inline-flex mt-2 text-[11px] font-bold text-mota-800">Open Document Wallet →</Link>
            </div>
          ) : null}

          <div className="space-y-2">
            {walletDocs.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.document_id);
              const isVerified = doc.document_status === "VERIFIED";

              return (
                <div
                  key={doc.document_id}
                  onClick={() => handleDocToggle(doc.document_id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "border-mota-700 bg-mota-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-mota-700"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 block truncate">
                        {doc.document_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Source: {doc.source}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      isVerified
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isVerified ? "Verified ✓" : doc.document_status}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button size="md" onClick={() => setStep(4)} className="gap-1 text-xs">
              <span>Next: Declaration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Review & Consent Declaration */}
      {step === 4 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Lock className="w-4 h-4 text-mota-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              4. Review & Consent Declaration
            </h3>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
            <div className="flex justify-between font-medium">
              <span>Scheme:</span>
              <span className="font-bold">{scheme.scheme_name}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Institution:</span>
              <span>{profile.education.institution_name}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Attached Documents:</span>
              <span className="font-bold">{selectedDocIds.length} Files</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-950">
              <input
                type="checkbox"
                checked={consentGranted}
                onChange={(e) => setConsentGranted(e.target.checked)}
                className="mt-0.5 rounded text-mota-700"
              />
              <span className="leading-snug">
                I declare that the information supplied is truthful. I understand that scholarship evaluation may use authorized official-source verification, and I consent to that verification for this application. Separate provider authorization (for example, DigiLocker) may still be required before protected records are accessed.
              </span>
            </label>
          </div>

          <div className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              size="lg"
              disabled={!consentGranted}
              isLoading={isSubmitting}
              onClick={handleFinalSubmit}
              className="gap-1.5 shadow-md"
            >
              <span>Submit Scholarship Application</span>
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 5: Submission Confirmation Screen */}
      {step === 5 && createdApp && (
        <div className="text-center py-6 space-y-4 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Application Submitted Successfully!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your application has been submitted to the scholarship workflow. Subsequent verification and review status will appear here as backend events are recorded.
            </p>
          </div>

          <Card className="bg-slate-50 border-slate-200 text-left p-3.5 space-y-1.5 text-xs max-w-sm mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-400">Application Number:</span>
              <span className="font-mono font-bold text-slate-900">
                {createdApp.application_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Scheme Name:</span>
              <span className="font-semibold text-slate-800">
                {createdApp.scheme_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Status:</span>
              <span className="font-bold text-blue-700">{createdApp.current_stage}</span>
            </div>
          </Card>

          <div className="space-y-2 pt-2">
            <Link
              href={`/applications/${createdApp.application_id}`}
              className="w-full block"
            >
              <Button size="lg" className="w-full gap-2">
                <span>Track Application Timeline</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/dashboard" className="w-full block">
              <Button variant="outline" size="md" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <div className="p-4">
      <Suspense fallback={<div className="p-4 text-center text-xs text-slate-400">Loading application wizard...</div>}>
        <NewApplicationForm />
      </Suspense>
    </div>
  );
}
