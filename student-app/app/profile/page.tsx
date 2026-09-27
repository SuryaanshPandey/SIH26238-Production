"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { studentApi } from "../../lib/api/student";
import { authApi } from "../../lib/api/auth";
import { StudentProfile } from "../../lib/contracts/types";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { formatDate, formatCurrencyINR } from "../../lib/utils";
import { documentsApi } from "../../lib/api/documents";
import { governmentApi, DigiLockerStatus } from "../../lib/api/government";
import {
  User,
  ShieldCheck,
  Lock,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Building,
  CheckCircle2,
  FileCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(() => studentApi.getCachedProfile({ allowStale: true }));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [digiLockerStatus, setDigiLockerStatus] = useState<DigiLockerStatus | null>(null);
  const [digiLockerLoading, setDigiLockerLoading] = useState(false);
  const [digiLockerError, setDigiLockerError] = useState("");
  const [digiLockerMessage, setDigiLockerMessage] = useState("");

  const initials = profile?.full_name
    ? profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    : "ST";

  useEffect(() => {
    let cancelled = false;
    const cached = studentApi.getCachedProfile({ allowStale: true });
    if (cached) {
      setPhone(cached.contact.phone_masked);
      setEmail(cached.contact.email_masked);
      setAddress(cached.location.address_masked);
    }
    void studentApi.getProfile().then((p) => {
      if (cancelled) return;
      setProfile(p);
      setPhone(p.contact.phone_masked);
      setEmail(p.contact.email_masked);
      setAddress(p.location.address_masked);
    }).catch((error) => {
      if (!cancelled && !cached) setDigiLockerError(error instanceof Error ? error.message : "Unable to load student profile.");
    });
    // DigiLocker is optional; never hold the profile page on its status endpoint.
    void governmentApi.getDigiLockerStatus().then((status) => {
      if (!cancelled) setDigiLockerStatus(status);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!profile) {
    return <div className="p-6 text-center"><div className="bg-white border border-red-200 rounded-2xl p-6"><p className="text-sm font-bold text-slate-900">Student profile could not load</p><p className="text-xs text-slate-500 mt-1">{digiLockerError || "Please retry after signing in again."}</p><Button size="sm" className="mt-3" onClick={() => window.location.reload()}>Retry</Button></div></div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await studentApi.updateProfile({
        contact: {
          phone_masked: phone,
          email_masked: email,
        },
        location: {
          ...profile.location,
          address_masked: address,
        },
      });
      setProfile(updated);
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Profile Header */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-mota-900 to-mota-700 text-amber-400 flex items-center justify-center font-bold text-xl shadow-md border-2 border-amber-400/40">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="success" className="text-[10px]">
              ● {profile.profile_status}
            </Badge>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
              {profile.category} ({profile.sub_tribe || "Tribal"})
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 truncate">
            {profile.full_name}
          </h2>
          <p className="text-[11px] text-slate-500 font-mono">
            Student ID: {profile.student_id}
          </p>
        </div>
      </div>

      {/* Government Identity Connections (Masked & Tokenized) */}
      <Card className="border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3 border-b border-emerald-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Government Identity Connections</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded-full">
            Connected sources only
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block uppercase">
                APAAR ID (One Nation One Student ID)
              </span>
              <span className="font-mono font-bold text-slate-800">
                {profile.identifier_refs.apaar_token === "NOT_CONNECTED" ? "Not connected" : profile.identifier_refs.apaar_token}
              </span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block uppercase">
                DigiLocker Reference
              </span>
              <span className="font-mono font-bold text-slate-800">
                {profile.identifier_refs.digilocker_id_masked === "NOT_CONNECTED" ? "Not connected" : profile.identifier_refs.digilocker_id_masked}
              </span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block uppercase">
                Aadhaar (Last 4 Digits)
              </span>
              <span className="font-mono font-bold text-slate-800">
                {profile.identifier_refs.masked_aadhaar_last4 === "NOT_AVAILABLE" ? "Not available" : profile.identifier_refs.masked_aadhaar_last4}
              </span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-800">DigiLocker authorization</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Connect through the official DigiLocker authorization page. This registration does not create a government connection by itself.</p>
            </div>
            {digiLockerStatus?.connected ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-mota-700 hover:underline"
                  onClick={async () => {
                    setDigiLockerLoading(true);
                    setDigiLockerError("");
                    setDigiLockerMessage("");
                    try {
                      const result = await documentsApi.syncDigiLocker();
                      setDigiLockerMessage(result.message);
                    } catch (error) {
                      setDigiLockerError(error instanceof Error ? error.message : "Unable to fetch DigiLocker documents.");
                    } finally { setDigiLockerLoading(false); }
                  }}
                  disabled={digiLockerLoading}
                >
                  {digiLockerLoading ? "Fetching..." : "Fetch documents"}
                </button>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-red-700 hover:underline"
                  onClick={async () => {
                    setDigiLockerLoading(true);
                    setDigiLockerError("");
                    setDigiLockerMessage("");
                    try {
                      await governmentApi.disconnectDigiLocker();
                      setDigiLockerStatus((prev) => prev ? { ...prev, connected: false, digilocker_id_masked: null, connected_at: null } : prev);
                      const refreshed = await studentApi.getProfile();
                      setProfile(refreshed);
                    } catch (error) {
                      setDigiLockerError(error instanceof Error ? error.message : "Unable to disconnect DigiLocker.");
                    } finally { setDigiLockerLoading(false); }
                  }}
                  disabled={digiLockerLoading}
                >
                  {digiLockerLoading ? "Working..." : "Disconnect"}
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={digiLockerLoading || !digiLockerStatus?.configured}
                onClick={async () => {
                  setDigiLockerLoading(true);
                  setDigiLockerError("");
                  try {
                    const result = await governmentApi.startDigiLocker();
                    window.location.href = result.authorization_url;
                  } catch (error) {
                    setDigiLockerError(error instanceof Error ? error.message : "DigiLocker authorization could not be started.");
                    setDigiLockerLoading(false);
                  }
                }}
              >
                {digiLockerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Connect DigiLocker
              </Button>
            )}
          </div>
          {!digiLockerStatus?.configured && (
            <div className="space-y-1">
              <p className="text-[10px] text-amber-700">Official DigiLocker partner credentials are not configured for this deployment yet.</p>
              {digiLockerStatus?.missing_configuration?.length ? (
                <p className="text-[10px] text-slate-500">Missing: {digiLockerStatus.missing_configuration.join(", ")}</p>
              ) : null}
              <a
                href="https://partners.apisetu.gov.in/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-mota-700 hover:underline"
              >
                Open API Setu Partner Portal <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {digiLockerMessage && <p className="text-[10px] text-emerald-700">{digiLockerMessage}</p>}
          {digiLockerError && <p className="text-[10px] text-red-600">{digiLockerError}</p>}
        </div>

        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Government identifiers are shown only when an authorized source has actually connected them. Raw Aadhaar is never displayed here.
        </p>
      </Card>

      {/* Academic Information */}
      <Card>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
          <GraduationCap className="w-4 h-4 text-mota-700" />
          <span>Academic & Institution Profile</span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] block font-medium uppercase">
              Current Institution
            </span>
            <span className="font-bold text-slate-800 text-sm">
              {profile.education.institution_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-slate-400 text-[10px] block font-medium uppercase">
                AISHE Code
              </span>
              <span className="font-mono font-semibold text-slate-700">
                {profile.education.aishe_code || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block font-medium uppercase">
                Academic Year
              </span>
              <span className="font-semibold text-slate-700">
                {profile.education.academic_year}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-slate-400 text-[10px] block font-medium uppercase">
                Course & Stage
              </span>
              <span className="font-semibold text-slate-700">
                {profile.education.course}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block font-medium uppercase">
                Hosteller Status
              </span>
              <span className="font-semibold text-slate-700">
                {profile.education.is_hosteller ? "Hosteller" : "Day Scholar"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Contact & Residential Details */}
      <Card>
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <MapPin className="w-4 h-4 text-mota-700" />
            <span>Contact & Residential Details</span>
          </div>
          <button
            onClick={() => setIsEditOpen(true)}
            className="text-xs text-mota-700 font-semibold hover:underline flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Mobile:</span>
            <span className="font-mono font-semibold text-slate-800">
              {profile.contact.phone_masked}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Email:</span>
            <span className="font-mono font-semibold text-slate-800">
              {profile.contact.email_masked}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Location:</span>
            <span className="font-semibold text-slate-800">
              {profile.location.district}, {profile.location.state} ({profile.location.pincode})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Self-Declared Income:</span>
            <span className="font-bold text-slate-900">
              {formatCurrencyINR(profile.annual_family_income)} / year
            </span>
          </div>
        </div>
      </Card>

      <Card className="border-red-200 bg-red-50/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">Account session</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Sign out from this device.</p>
          </div>
          <Button variant="outline" onClick={() => authApi.logout()}>Sign out</Button>
        </div>
      </Card>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Update Contact Details"
        description="Update contact number and address for notifications."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Mobile Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Masked Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
