"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, ShieldCheck, CheckCircle2, LoaderCircle } from "lucide-react";
import { registerSchema, RegisterFormData } from "../../lib/validation/schemas";
import { authApi } from "../../lib/api/auth";
import { clearSession } from "../../lib/auth/session";
import { referenceApi, ReferenceDistrict, ReferenceState, PincodeSuggestion, InstitutionSuggestion } from "../../lib/api/reference";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<RegisterFormData> & {
    stateCode?: string;
    districtCode?: string;
    institutionId?: string;
    institutionSourceSystem?: string;
    institutionSourceReference?: string;
    institutionSourceUrl?: string;
  }>({
    fullName: "",
    dob: "",
    gender: undefined,
    category: "ST",
    subTribe: "",
    mobileNumber: "",
    state: "",
    district: "",
    pincode: "",
    institutionName: "",
    course: "",
    stage: "POST_MATRIC",
    annualIncome: undefined,
    email: "",
    password: "",
    confirmPassword: "",
    consentDigilocker: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<ReferenceState[]>([]);
  const [districts, setDistricts] = useState<ReferenceDistrict[]>([]);
  const [pincodes, setPincodes] = useState<PincodeSuggestion[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [referenceRetrying, setReferenceRetrying] = useState(false);
  const [institutionResults, setInstitutionResults] = useState<InstitutionSuggestion[]>([]);
  const [institutionLoading, setInstitutionLoading] = useState(false);
  const [showInstitutionResults, setShowInstitutionResults] = useState(false);

  useEffect(() => {
    clearSession();
    let active = true;
    setReferenceLoading(true);
    referenceApi.states()
      .then((rows) => {
        if (active) {
          setStates(rows);
          setReferenceError("");
        }
      })
      .catch((error) => {
        if (active) setReferenceError(error instanceof Error ? error.message : "Official location directory is unavailable.");
      })
      .finally(() => { if (active) setReferenceLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!formData.stateCode) {
      setDistricts([]);
      setPincodes([]);
      setPincodeError("");
      setPincodeLoading(false);
      return;
    }
    let active = true;
    setReferenceLoading(true);
    referenceApi.districts(formData.stateCode)
      .then((rows) => {
        if (active) {
          setDistricts(rows);
          setReferenceError("");
        }
      })
      .catch((error) => {
        if (active) setReferenceError(error instanceof Error ? error.message : "Official district directory is unavailable.");
      })
      .finally(() => { if (active) setReferenceLoading(false); });
    return () => { active = false; };
  }, [formData.stateCode]);

  useEffect(() => {
    if (
      !formData.stateCode ||
      !formData.districtCode ||
      !formData.state ||
      !formData.district
    ) {
      setPincodes([]);
      setPincodeError("");
      setPincodeLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setPincodeLoading(true);
    setPincodeError("");
    setPincodes([]);

    referenceApi.pincodes(
      formData.state,
      formData.district,
      false,
      controller.signal
    )
      .then((rows) => {
        if (!active || controller.signal.aborted) return;
        setPincodes(rows);
        setPincodeError("");
        setFormData((current) => ({
          ...current,
          pincode: rows.length === 1 ? rows[0].pincode : "",
        }));
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setPincodes([]);
        setPincodeError(
          error instanceof Error
            ? error.message
            : "Postal pincode directory is unavailable."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPincodeLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    formData.stateCode,
    formData.districtCode,
    formData.state,
    formData.district,
  ]);

  const institutionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = formData.institutionName?.trim() || "";
    institutionAbortRef.current?.abort();

    if (q.length < 2 || !formData.stateCode || !formData.districtCode) {
      setInstitutionLoading(false);
      setInstitutionResults([]);
      setShowInstitutionResults(false);
      return;
    }

    // Show feedback immediately while the debounce window is running so the
    // user knows that entering a college name triggers an official lookup.
    setInstitutionLoading(true);
    setShowInstitutionResults(true);
    setReferenceError("");

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      institutionAbortRef.current = controller;

      referenceApi.institutions({ q, state: formData.state, district: formData.district, limit: 8 }, controller.signal)
        .then((rows) => {
          if (controller.signal.aborted) return;
          setInstitutionResults(rows);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setInstitutionResults([]);
          setReferenceError(error instanceof Error ? error.message : "Official institution directory is unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setInstitutionLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      institutionAbortRef.current?.abort();
    };
  }, [formData.institutionName, formData.state, formData.district, formData.stateCode, formData.districtCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await authApi.register(result.data);
      setIsSubmitting(false);
      router.replace("/dashboard");
      } catch (error) {
      setIsSubmitting(false);
      setErrors({ form: error instanceof Error ? error.message : "Registration failed" });
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Login</span>
      </Link>

      <Card className="border-slate-200 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-mota-900 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">ST Student Registration</CardTitle>
              <CardDescription>
                Unified single-profile registration for MoTA scholarships
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identity Details */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-1">
                1. Basic Details
              </span>

              <Input
                label="Full Name (as in your official identity / education record)"
                placeholder="e.g. Birsa Munda"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                error={errors.fullName}
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Date of Birth"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  error={errors.dob}
                  required
                />

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gender: e.target.value as "MALE" | "FEMALE" | "OTHER",
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700"
                  >
                    <option value="">Select gender</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Community Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as "ST" | "PVTG",
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700 font-semibold"
                  >
                    <option value="ST">Scheduled Tribe (ST)</option>
                    <option value="PVTG">PVTG (Particularly Vulnerable)</option>
                  </select>
                </div>

                <Input
                  label="Sub-Tribe / Community (Optional)"
                  placeholder="e.g. Santhal / Gond / Bhil"
                  value={formData.subTribe}
                  onChange={(e) => setFormData({ ...formData, subTribe: e.target.value })}
                />
              </div>

              <Input
                label="Mobile Number"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                error={errors.mobileNumber}
                required
              />

              <Input
                label="Email Address (Optional)"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={errors.email}
              />

              <div className="grid grid-cols-2 gap-2">
                <Input label="Password" type="password" placeholder="8+ characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} error={errors.password} required />
                <Input label="Confirm Password" type="password" placeholder="Repeat password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} error={errors.confirmPassword} required />
              </div>
            </div>

            {/* Academic Details */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-1">
                2. Education & Location
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                  <select
                    value={formData.stateCode ?? ""}
                    onChange={(e) => {
                      const selected = states.find((row) => row.code === e.target.value);
                      setFormData({
                        ...formData,
                        stateCode: e.target.value,
                        state: selected?.name || "",
                        districtCode: undefined,
                        district: "",
                        pincode: "",
                        institutionId: undefined,
                        institutionSourceSystem: undefined,
                        institutionSourceReference: undefined,
                        institutionSourceUrl: undefined,
                      });
                      setDistricts([]);
                      setInstitutionResults([]);
                      setShowInstitutionResults(false);
                      setReferenceError("");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700 disabled:bg-slate-50"
                    disabled={referenceLoading && states.length === 0}
                    required
                  >
                    <option value="">{referenceLoading && states.length === 0 ? "Loading states..." : "Select state"}</option>
                    {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
                  </select>
                  {errors.state && <p className="text-[11px] text-red-600 mt-1">{errors.state}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
                  <select
                    value={formData.districtCode ?? ""}
                    onChange={(e) => {
                      const selected = districts.find((row) => row.code === e.target.value);
                      setFormData({
                        ...formData,
                        districtCode: e.target.value,
                        district: selected?.name || "",
                        pincode: "",
                        institutionId: undefined,
                        institutionSourceSystem: undefined,
                        institutionSourceReference: undefined,
                        institutionSourceUrl: undefined,
                      });
                      setInstitutionResults([]);
                      setShowInstitutionResults(false);
                      setReferenceError("");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700 disabled:bg-slate-50"
                    disabled={!formData.stateCode || referenceLoading}
                    required
                  >
                    <option value="">{formData.stateCode ? (referenceLoading ? "Loading districts..." : "Select district") : "Select state first"}</option>
                    {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
                  </select>
                  {errors.district && <p className="text-[11px] text-red-600 mt-1">{errors.district}</p>}
                </div>
              </div>

              {referenceError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-center justify-between gap-3">
                  <span>{referenceError}</span>
                  <button
                    type="button"
                    disabled={referenceRetrying}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      if (referenceRetrying) return;
                      setReferenceError("");
                      setReferenceRetrying(true);
                      setReferenceLoading(true);
                      const request = formData.stateCode && districts.length === 0
                        ? referenceApi.districts(formData.stateCode, true).then((rows) => setDistricts(rows))
                        : referenceApi.states(true).then((rows) => setStates(rows));
                      request
                        .catch((error) => setReferenceError(error instanceof Error ? error.message : "Official government reference directory is unavailable."))
                        .finally(() => {
                          setReferenceLoading(false);
                          setReferenceRetrying(false);
                        });
                    }}
                  >
                    {referenceRetrying ? "Retrying..." : "Retry"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Education Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stage: e.target.value as RegisterFormData["stage"],
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700"
                  >
                    <option value="PRE_MATRIC">Pre-Matric (Class 9-10)</option>
                    <option value="POST_MATRIC">Post-Matric (11-12 / UG)</option>
                    <option value="HIGHER_EDUCATION">Top Class Professional</option>
                    <option value="FELLOWSHIP">NFST Fellowship (Ph.D.)</option>
                    <option value="OVERSEAS">Overseas Studies (NOS)</option>
                  </select>
                </div>

                <Input
                  label="Annual Family Income (₹)"
                  type="number"
                  placeholder="e.g. 180000"
                  value={formData.annualIncome?.toString() ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, annualIncome: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  error={errors.annualIncome}
                  required
                />
              </div>

              <div className="relative">
                <Input
                  label="College / Institution Name"
                  placeholder={formData.stateCode && formData.districtCode ? "Type at least 2 letters to search official institution sources" : "Select state and district first"}
                  value={formData.institutionName ?? ""}
                  onFocus={() => { if (institutionResults.length) setShowInstitutionResults(true); }}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      institutionName: e.target.value,
                      institutionId: undefined,
                      institutionSourceSystem: undefined,
                      institutionSourceReference: undefined,
                      institutionSourceUrl: undefined,
                    })
                  }
                  error={errors.institutionName}
                  helperText={
                    formData.stateCode && formData.districtCode
                      ? "Suggestions are resolved from supported official education/government directories (UGC, AISHE-derived data, and UBA where applicable). Select a result to attach its source provenance."
                      : "Select state and district first. Suggestions combine supported official education/government directory sources."
                  }
                  disabled={!formData.stateCode || !formData.districtCode}
                  required
                />
                {institutionLoading && (
                  <div
                    className="pointer-events-none absolute right-3 top-[29px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-50"
                    aria-label="Finding your college"
                  >
                    <LoaderCircle className="h-4 w-4 animate-spin text-mota-700" />
                  </div>
                )}
                {showInstitutionResults && (institutionLoading || institutionResults.length > 0 || (formData.institutionName?.trim().length ?? 0) >= 2) && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    {institutionLoading && (
                      <div className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-mota-700">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-800">Finding your college...</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">Checking official institution directories</div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2" aria-hidden="true">
                          <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
                          <div className="h-8 w-11/12 animate-pulse rounded-lg bg-slate-100" />
                        </div>
                      </div>
                    )}
                    {!institutionLoading && institutionResults.length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-slate-500">No matching institution found in the official directories for this location. Try the full institution name or AISHE/recognition code.</div>
                    )}
                    {institutionResults.map((institution) => (
                      <button
                        key={institution.institution_id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            institutionName: institution.name,
                            institutionId: institution.institution_id,
                            institutionSourceSystem: institution.source_system,
                            institutionSourceReference: institution.institution_id,
                            institutionSourceUrl: institution.source_url,
                          });
                          setShowInstitutionResults(false);
                        }}
                      >
                        <div className="text-xs font-semibold text-slate-800">{institution.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {[institution.district, institution.state, institution.status, `${institution.source_system}${institution.source_mode === "SNAPSHOT" ? " snapshot" : ""}`].filter(Boolean).join(" · ")}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formData.institutionId && formData.institutionSourceUrl && (
                <p className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Official source attached: {formData.institutionSourceSystem} directory · reference {formData.institutionSourceReference}
                </p>
              )}

              <Input
                label="Course / Stream"
                placeholder="e.g. B.Sc Agriculture / Diploma Mechanical"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                error={errors.course}
                required
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pincode
                </label>
                <select
                  value={formData.pincode ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, pincode: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700 disabled:bg-slate-50"
                  disabled={
                    !formData.stateCode ||
                    !formData.districtCode ||
                    pincodeLoading ||
                    pincodes.length === 0
                  }
                  required
                >
                  <option value="">
                    {!formData.districtCode
                      ? "Select district first"
                      : pincodeLoading
                        ? "Loading pincodes..."
                        : pincodes.length === 0
                          ? "No pincode available"
                          : "Select pincode"}
                  </option>
                  {pincodes.map((row) => (
                    <option key={row.pincode} value={row.pincode}>
                      {row.pincode}{row.officeCount > 1 ? ` Â· ${row.officeCount} postal offices` : ""}
                    </option>
                  ))}
                </select>

                {pincodes.length === 1 && !pincodeLoading && !pincodeError && (
                  <p className="text-[10px] text-emerald-700 mt-1">
                    Pincode auto-selected from the postal directory for {formData.district}.
                  </p>
                )}

                {pincodes.length > 1 && !pincodeLoading && !pincodeError && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Select one of the valid pincodes for {formData.district}.
                  </p>
                )}

                {pincodeError && (
                  <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800 flex items-center justify-between gap-2">
                    <span>{pincodeError}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100"
                      onClick={() => {
                        if (!formData.state || !formData.district) return;
                        setPincodeError("");
                        setPincodeLoading(true);
                        referenceApi
                          .pincodes(formData.state, formData.district, true)
                          .then((rows) => {
                            setPincodes(rows);
                            setPincodeError("");
                            setFormData((current) => ({
                              ...current,
                              pincode: rows.length === 1 ? rows[0].pincode : "",
                            }));
                          })
                          .catch((error) =>
                            setPincodeError(
                              error instanceof Error
                                ? error.message
                                : "Postal pincode directory is unavailable."
                            )
                          )
                          .finally(() => setPincodeLoading(false));
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {errors.pincode && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.pincode}</p>
                )}
              </div>
            </div>

            {/* Privacy & DigiLocker Consent */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consentDigilocker}
                  onChange={(e) =>
                    setFormData({ ...formData, consentDigilocker: e.target.checked })
                  }
                  className="mt-1 rounded text-mota-700 focus:ring-mota-700"
                />
                <span className="text-[11px] text-slate-600 leading-snug">
                  I understand that scholarship evaluation may use official source verification. Where a provider requires separate authorization (such as DigiLocker), I will complete that authorization before records are accessed. No government record is connected by this registration alone.
                </span>
              </label>
              {errors.consentDigilocker && (
                <p className="text-[11px] text-red-600 font-medium">
                  {errors.consentDigilocker}
                </p>
              )}
            </div>

            {errors.form && <p className="text-xs text-red-600 font-medium">{errors.form}</p>}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Create Student Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
