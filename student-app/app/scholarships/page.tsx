"use client";

import React, { useState, useEffect } from "react";
import { scholarshipApi, ScholarshipSyncStatus } from "../../lib/api/scholarship";
import { Scholarship } from "../../lib/contracts/types";
import { SchemeCard } from "../../components/scholarship/SchemeCard";
import { SchemeFilter } from "../../components/scholarship/SchemeFilter";
import { Compass, Info, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";

export default function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState<Scholarship[]>(() => scholarshipApi.getCachedScholarships());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [isLoading, setIsLoading] = useState(() => scholarshipApi.getCachedScholarships().length === 0);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [syncStatus, setSyncStatus] = useState<ScholarshipSyncStatus | null>(null);
  const [refreshingCatalogue, setRefreshingCatalogue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(scholarships.length === 0);
    setError(null);
    scholarshipApi.getScholarships().then((data) => {
      if (!cancelled) setScholarships(data);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Scholarship catalogue could not be loaded.");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [retry]);


  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const status = await scholarshipApi.getSyncStatus();
        if (cancelled) return;
        setSyncStatus(status);
        if (status.status === "RUNNING") {
          timer = window.setTimeout(poll, 2200);
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 5000);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [retry]);

  const handleCatalogueRefresh = async () => {
    setRefreshingCatalogue(true);
    try {
      await scholarshipApi.getScholarships(true);
      const status = await scholarshipApi.getSyncStatus();
      setSyncStatus(status);
      if (status.status === "RUNNING") {
        setRetry((value) => value + 1);
      }
    } finally {
      setRefreshingCatalogue(false);
    }
  };
  const filtered = scholarships.filter((scheme) => {
    const matchesSearch = scheme.scheme_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.scheme_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.target_group.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === "ALL" || scheme.education_level === selectedLevel;
    return matchesSearch && matchesLevel;
  });
  const usingSnapshot = scholarships.length > 0 && scholarships.every((s) => s.source_mode === "SNAPSHOT");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center"><Compass className="w-4 h-4" /></div>
            <h2 className="text-base font-bold text-slate-900">Scholarship Discovery</h2>
          </div>
          <p className="text-xs text-slate-500">Live scholarship records aggregated from official government sources for academic year 2026-27.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleCatalogueRefresh} disabled={refreshingCatalogue} className="gap-1 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshingCatalogue ? "animate-spin" : ""}`} />
          {refreshingCatalogue ? "Refreshing..." : "Refresh sources"}
        </Button>
      </div>

      <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <span><strong>Source policy:</strong> official government portals are used as the source of record. Records are normalized and deduplicated; open the cited source before relying on eligibility, benefits, or document requirements.</span>
      </div>

      {usingSnapshot && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span><strong>Official NSP snapshot in use.</strong> The live catalogue could not be reached, so the app is showing verified official catalogue metadata rather than invented records.</span></div>
          <a className="shrink-0 underline font-semibold" href="https://scholarships.gov.in/All-Scholarships" target="_blank" rel="noreferrer">Verify on NSP</a>
        </div>
      )}

      {!usingSnapshot && scholarships.length > 0 && (
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
          <span className="mt-0.5">●</span>
          <span><strong>{scholarships.length} live record(s)</strong> currently loaded. {new Set(scholarships.flatMap((s) => (s.source_evidence || []).map((e) => e.source_id))).size || 1} official source(s) contributed to the catalogue; duplicate schemes are merged into one record.</span>
        </div>
      )}


      {syncStatus?.status === "RUNNING" && (
        <div className="rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <p className="text-xs font-bold text-slate-900">Updating official scholarship catalogue</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {syncStatus.phase === "DISCOVERING"
                  ? "Discovering official catalogue records..."
                  : syncStatus.phase === "ENRICHING"
                    ? `Fetching scheme details from ${syncStatus.currentSourceName || "official sources"}...`
                    : "Finalizing the normalized catalogue..."}
              </p>
            </div>
            <span className="text-xs font-bold text-blue-800">{syncStatus.percent}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-700 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, syncStatus.percent))}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px]">
            <div className="rounded-lg bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Sources</span><div className="font-bold text-slate-800">{syncStatus.sources.filter((source) => source.status === "SUCCESS" || source.status === "NO_RECORDS").length}/{syncStatus.sources.length}</div></div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Records found</span><div className="font-bold text-slate-800">{syncStatus.sources.reduce((sum, source) => sum + source.recordsFound, 0)}</div></div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Unique</span><div className="font-bold text-slate-800">{syncStatus.uniqueRecords}</div></div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5"><span className="text-slate-500">Saved</span><div className="font-bold text-slate-800">{syncStatus.upserted}</div></div>
          </div>

          <div className="mt-3 space-y-2">
            {syncStatus.sources.map((source) => (
              <div key={source.sourceId}>
                <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                  <span className="truncate text-slate-700">{source.sourceName}</span>
                  <span className="shrink-0 font-semibold text-slate-500">
                    {source.status === "PENDING" ? "Waiting" : source.status === "RUNNING" ? `${source.percent}%` : source.status === "FAILED" ? "Failed" : "Done"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${source.status === "FAILED" ? "bg-red-500" : source.status === "PENDING" ? "bg-slate-200" : "bg-blue-600"}`}
                    style={{ width: `${source.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 mt-3">
            The current catalogue remains available while the refresh runs. Slow or unavailable government sources are isolated from the student experience.
          </p>
        </div>
      )}

      {syncStatus?.status === "SUCCESS" && syncStatus.completedAt && Date.now() - new Date(syncStatus.completedAt).getTime() < 120000 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[10px] text-emerald-900 flex items-center gap-2">
          <span className="font-bold">OK</span>
          <span><strong>Official catalogue refresh complete.</strong> {syncStatus.uniqueRecords} unique scheme record(s) are now available.</span>
        </div>
      )}
      <SchemeFilter searchQuery={searchQuery} onSearchChange={setSearchQuery} selectedLevel={selectedLevel} onLevelChange={setSelectedLevel} />

      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="space-y-3 animate-pulse"><div className="h-44 bg-slate-200 rounded-2xl" /><div className="h-44 bg-slate-200 rounded-2xl" /></div>
        ) : error ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-red-200 p-6">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">Scholarship catalogue unavailable</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">{error}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => setRetry((n) => n + 1)} className="gap-1"><RefreshCw className="w-3.5 h-3.5" />Retry</Button>
              <a href="https://scholarships.gov.in/All-Scholarships" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-mota-800"><ExternalLink className="w-3.5 h-3.5" />Open NSP</a>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6"><Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-xs font-semibold text-slate-700">No schemes found</p><p className="text-[11px] text-slate-400 mt-1">Try adjusting your search query or level filter.</p></div>
        ) : (
          filtered.map((scheme) => <SchemeCard key={scheme.scheme_id} scholarship={scheme} />)
        )}
      </div>
    </div>
  );
}
