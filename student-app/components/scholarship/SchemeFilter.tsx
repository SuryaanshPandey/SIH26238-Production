"use client";

import React from "react";
import { Search } from "lucide-react";
import { EducationLevel } from "../../lib/contracts/types";

interface SchemeFilterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedLevel: string;
  onLevelChange: (level: string) => void;
}

export function SchemeFilter({
  searchQuery,
  onSearchChange,
  selectedLevel,
  onLevelChange,
}: SchemeFilterProps) {
  const levels = [
    { label: "All Schemes", value: "ALL" },
    { label: "Pre-Matric (9-10)", value: "PRE_MATRIC" },
    { label: "Post-Matric (11-UG)", value: "POST_MATRIC" },
    { label: "Top Class (Premier)", value: "HIGHER_EDUCATION" },
    { label: "NFST Fellowship", value: "FELLOWSHIP" },
    { label: "Overseas (NOS)", value: "OVERSEAS" },
  ];

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by scheme name or keywords..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-mota-700 focus:border-mota-700 transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Horizontal Scroll Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {levels.map((lvl) => (
          <button
            key={lvl.value}
            onClick={() => onLevelChange(lvl.value)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedLevel === lvl.value
                ? "bg-mota-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {lvl.label}
          </button>
        ))}
      </div>
    </div>
  );
}
