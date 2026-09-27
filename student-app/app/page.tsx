"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Sparkles, CheckCircle2, Lock } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-80px)] p-6 text-center">
      {/* Top Emblem & Branding */}
      <div className="pt-6 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-mota-900 flex items-center justify-center shadow-lg border-2 border-amber-400 mb-4">
          <ShieldCheck className="w-9 h-9 text-amber-400" />
        </div>
        <span className="text-xs font-bold tracking-widest text-amber-700 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          SIH26238 Student Platform
        </span>
        <h1 className="text-xl font-extrabold text-slate-900 mt-2">
          Unified Scholarship Application
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Unified Scholarship Mobile Application for Scheduled Tribe (ST) Students
        </p>
      </div>

      {/* Highlights / Features Banner */}
      <div className="w-full my-6 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-left space-y-2.5">
        <div className="flex items-center gap-2.5 text-xs text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Live scholarship discovery from the National Scholarship Portal</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Consent-based document wallet with official-source connectors</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Application, sanction and payment status tracking</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Multilingual assistance grounded in application data</span>
        </div>
      </div>

      {/* Call to Actions */}
      <div className="w-full space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/login">
            <Button variant="outline" size="md" className="w-full text-xs">
              Student Login
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="md" className="w-full text-xs">
              New Registration
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 pt-1">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>New accounts use authenticated sessions; protected government sources require separate official authorization.</span>
        </p>
      </div>
    </div>
  );
}
