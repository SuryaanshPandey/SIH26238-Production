"use client";

import React from "react";
import { useLanguage } from "../../lib/context/LanguageContext";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === "en" ? "hi" : "en")}
      aria-label="Toggle Language"
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
    >
      <Languages className="w-3.5 h-3.5 text-amber-600" />
      <span>{language === "en" ? "हिन्दी" : "English"}</span>
    </button>
  );
}
