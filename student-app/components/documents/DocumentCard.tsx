"use client";

import React from "react";
import { DocumentItem } from "../../lib/contracts/types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  getDocumentStatusBadge,
  getVerificationMatchBadge,
  formatDate,
} from "../../lib/utils";
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Building,
  Calendar,
} from "lucide-react";

interface DocumentCardProps {
  document: DocumentItem;
  onReplace?: (doc: DocumentItem) => void;
}

export function DocumentCard({ document, onReplace }: DocumentCardProps) {
  const statusBadge = getDocumentStatusBadge(document.document_status);
  const matchBadge = getVerificationMatchBadge(document.verification_status);

  const getSourceDisplay = (source: DocumentItem["source"]) => {
    switch (source) {
      case "DIGILOCKER":
        return { label: "DigiLocker Source", color: "bg-blue-50 text-blue-800 border-blue-200" };
      case "STATE_EDISTRICT":
        return { label: "State e-District", color: "bg-purple-50 text-purple-800 border-purple-200" };
      case "INSTITUTION":
        return { label: "Institute Issued", color: "bg-teal-50 text-teal-800 border-teal-200" };
      case "STUDENT_UPLOAD":
        return { label: "Student Uploaded", color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const sourceDisplay = getSourceDisplay(document.source);
  const isMismatch = document.document_status === "MISMATCH" || document.verification_status === "MISMATCH";

  return (
    <Card className={`transition-all ${isMismatch ? "border-red-300 bg-red-50/20" : ""}`}>
      {/* Top badges: Source & Status */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${sourceDisplay.color}`}
        >
          {sourceDisplay.label}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Title & Icon */}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-mota-800" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {document.document_name}
          </h4>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            ID: {document.document_id}
          </p>
        </div>
      </div>

      {/* Details metadata */}
      <div className="mt-3 space-y-1 text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Issuer:</span>
          <span className="font-medium text-slate-800 truncate max-w-[190px]">
            {document.issuer}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Issue Date:</span>
          <span className="font-medium text-slate-800">{formatDate(document.issue_date)}</span>
        </div>
        {document.expiry_date && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Valid Until:</span>
            <span className="font-medium text-slate-800">{formatDate(document.expiry_date)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <span className="text-slate-500">Verification Match:</span>
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${matchBadge.color}`}>
            {matchBadge.label}
          </span>
        </div>
      </div>

      {/* Mismatch Warning Note */}
      {isMismatch && (
        <div className="mt-2.5 p-2 bg-red-100/70 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
          <span>
            Attribute mismatch detected with state records. You can upload a revised certificate or clarify details.
          </span>
        </div>
      )}

      {/* Action footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
        {onReplace && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReplace(document)}
            className="text-xs gap-1 h-8"
          >
            <RefreshCw className="w-3 h-3 text-slate-500" />
            <span>Replace / Re-upload</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
