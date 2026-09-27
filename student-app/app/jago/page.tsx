"use client";

import React from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { ChatWindow } from "../../components/jago/ChatWindow";

export default function JagoPage() {
  return (
    <div className="p-3 space-y-2">
      <div className="px-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center"><Bot className="w-4 h-4" /></div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900">JAGO</h1>
            <p className="text-[10px] text-slate-500">Your in-app scholarship assistant</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Grounded</span>
      </div>
      <ChatWindow />
    </div>
  );
}
