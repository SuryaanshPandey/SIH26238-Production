"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { applicationApi } from "../../lib/api/application";
import { Deficiency } from "../../lib/contracts/types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { getDeficiencyBadge, formatDate } from "../../lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  FileText,
  UploadCloud,
  Info,
} from "lucide-react";

export default function ActionCentrePage() {
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [selectedDeficiency, setSelectedDeficiency] = useState<Deficiency | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [clarificationText, setClarificationText] = useState(
    "The income figure of ₹1,80,000 corresponds to my latest Tehsil certificate issued in May 2026. Both ₹1.80L and ₹2.40L fall within the ₹2.50L scheme ceiling. Attaching the stamped CO certificate for DNO manual review."
  );
  const [fileName, setFileName] = useState("CO_Income_Cert_2026.pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDeficiencies = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await applicationApi.getDeficiencies();
      setDeficiencies(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Action Centre could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeficiencies();
  }, []);

  const handleOpenResolve = (def: Deficiency) => {
    setSelectedDeficiency(def);
    setIsResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeficiency) return;
    setIsSubmitting(true);

    try {
      await applicationApi.resolveDeficiency(selectedDeficiency.deficiency_id, {
        action: selectedDeficiency.required_action,
        clarificationText,
        replacementDocName: fileName,
      });

      await loadDeficiencies();
      setIsResolveModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openList = deficiencies.filter((d) => d.current_status === "OPEN");
  const resolvedList = deficiencies.filter((d) => d.current_status === "RESOLVED");

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Action Centre</h2>
        </div>
        <p className="text-xs text-slate-500">
          Review discrepancies, submit clarifications, and clear verification deficiencies.
        </p>
      </div>

      {/* Manual Review Clarification Banner */}
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">MoTA Exception Handling Policy:</span>
          <span>
            When a data mismatch or document inquiry occurs, <strong>your application is routed to the District Nodal Officer (DNO) for human review rather than being rejected.</strong> Providing clarification helps the officer complete verification promptly.
          </span>
        </div>
      </div>

      {/* Open Actions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Pending Student Actions ({openList.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
        ) : loadError ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-red-200 p-5"><p className="text-xs font-semibold text-slate-700">Action Centre could not be loaded</p><p className="text-[11px] text-slate-500 mt-1">{loadError}</p><Button size="sm" className="mt-3" onClick={loadDeficiencies}>Retry</Button></div>
        ) : openList.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-slate-200 p-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-800">
              No Pending Actions Required
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All your submitted applications and documents are in order.
            </p>
          </div>
        ) : (
          openList.map((def) => {
            const badge = getDeficiencyBadge(def.current_status);

            return (
              <Card
                key={def.deficiency_id}
                className="border-red-200 bg-white relative overflow-hidden shadow-sm"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-600" />

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    {def.deficiency_id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">
                  {def.title}
                </h4>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {def.description}
                </p>

                <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Scheme:</span>
                    <span className="font-medium text-slate-800">
                      {def.scheme_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Affected Item:</span>
                    <span className="font-semibold text-red-700">
                      {def.affected_field_or_doc}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution Deadline:</span>
                    <span className="font-medium text-slate-800">
                      {formatDate(def.deadline)}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Action: {def.required_action.replace(/_/g, " ")}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleOpenResolve(def)}
                    className="gap-1 text-xs"
                  >
                    <span>Submit Clarification</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Resolved Actions History */}
      {resolvedList.length > 0 && (
        <div className="space-y-3 pt-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Resolved Inquiries ({resolvedList.length})
          </h3>

          {resolvedList.map((def) => (
            <Card
              key={def.deficiency_id}
              className="bg-slate-50/70 border-slate-200 p-3 space-y-1.5 opacity-80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {def.title}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Resolved ✓
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clarification forwarded to District Nodal Officer. Status updated to Under Review.
              </p>
              <div className="text-[10px] text-slate-400 pt-1">
                Resolved: {formatDate(def.resolved_at)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedDeficiency && (
        <Modal
          isOpen={isResolveModalOpen}
          onClose={() => setIsResolveModalOpen(false)}
          title={`Resolve: ${selectedDeficiency.title}`}
          description={`Submit explanation or revised certificate for ${selectedDeficiency.scheme_name}.`}
        >
          <form onSubmit={handleResolveSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <span className="font-semibold block text-slate-900">
                Official Instruction:
              </span>
              <p>{selectedDeficiency.action_instructions}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Your Written Clarification (For Nodal Officer)
              </label>
              <textarea
                rows={4}
                value={clarificationText}
                onChange={(e) => setClarificationText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-mota-700"
                placeholder="Explain the difference or reference the attached certificate..."
                required
              />
            </div>

            {/* Document re-upload */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attach Supporting Document (Optional)
              </label>
              <label className="flex items-center gap-2 p-3 border border-slate-300 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <UploadCloud className="w-5 h-5 text-mota-700 shrink-0" />
                <span className="text-xs text-slate-700 truncate flex-1 font-medium">
                  {fileName}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFileName(e.target.files[0].name);
                  }}
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResolveModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Submit for Manual Review
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
