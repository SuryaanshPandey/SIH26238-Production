import { Scholarship } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { apiFetch } from "./http";
import officialSnapshot from "../data/nsp-official-snapshot-2026-09.json";

const CACHE_KEY = "sih26238.scholarships.catalogue.v3";
const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 24 * 60 * 60_000;

export type ScholarshipSyncSourceStatus = "PENDING" | "RUNNING" | "SUCCESS" | "NO_RECORDS" | "FAILED";
export interface ScholarshipSyncSourceProgress {
  sourceId: string;
  sourceName: string;
  status: ScholarshipSyncSourceStatus;
  percent: number;
  recordsFound: number;
  recordsUpserted: number;
  durationMs: number;
  error?: string;
}
export interface ScholarshipSyncStatus {
  jobId: string | null;
  status: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
  phase: "DISCOVERING" | "ENRICHING" | "FINALIZING" | "COMPLETE";
  percent: number;
  currentSourceId: string | null;
  currentSourceName: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  uniqueRecords: number;
  upserted: number;
  sources: ScholarshipSyncSourceProgress[];
  error?: string;
}

let inFlight: Promise<Scholarship[]> | null = null;
let cache: { data: Scholarship[]; expiresAt: number; staleUntil: number; source: "LIVE" | "SNAPSHOT" } | null = null;
let storageHydrated = false;

function mapEducationLevel(type: string, name: string): Scholarship["education_level"] {
  if (["PRE_MATRIC", "POST_MATRIC", "HIGHER_EDUCATION", "FELLOWSHIP", "OVERSEAS"].includes(type)) return type as Scholarship["education_level"];
  const lower = name.toLowerCase();
  if (lower.includes("pre matric") || lower.includes("school")) return "PRE_MATRIC";
  if (lower.includes("post matric") || lower.includes("diploma")) return "POST_MATRIC";
  if (lower.includes("fellowship") || lower.includes("research")) return "FELLOWSHIP";
  return "HIGHER_EDUCATION";
}

function mapScholarship(s: any): Scholarship {
  const benefits = s.benefit_summary || {};
  const sourceSystem = s.source_system || "NSP";
  const evidence = Array.isArray(s.source_evidence) ? s.source_evidence : [];
  const primarySourceName = String(evidence[0]?.source_name || "");
  const sourcePortal = sourceSystem === "OFFICIAL_AGGREGATED"
    ? primarySourceName || "Official Government Sources"
    : sourceSystem === "NSP_SNAPSHOT"
      ? "National Scholarship Portal (official snapshot)"
      : "National Scholarship Portal";
  return {
    scheme_id: s.scholarship_id,
    scheme_name: s.scheme_name,
    scheme_code: s.scheme_code,
    scheme_type: ["CENTRALLY_SPONSORED", "CENTRAL_SECTOR"].includes(s.scheme_type) ? s.scheme_type : "CENTRAL_SECTOR",
    jurisdiction: String(s.jurisdiction || "").toLowerCase().includes("state") || String(s.jurisdiction || "").match(/\b[A-Z][a-z]+ Pradesh\b/i) ? "STATE_UT" : "CENTRAL",
    ministry: s.jurisdiction || primarySourceName || "Official Government Source",
    description: s.description || (sourceSystem === "NSP_SNAPSHOT"
      ? "Official NSP catalogue record from the bundled verified snapshot. Verify scheme details on the official specification before applying."
      : "Official scholarship information aggregated from government-published sources. Open the cited source before relying on eligibility, benefits or dates."),
    academic_year: s.academic_year,
    education_level: mapEducationLevel(s.education_level || s.scheme_type, s.scheme_name),
    target_group: s.target_group || "See the eligibility section on the cited official source.",
    income_ceiling: s.income_ceiling == null ? null : Number(s.income_ceiling),
    benefits: {
      maintenance_allowance_per_annum: Number(benefits.maintenance_allowance_annual ?? 0),
      tuition_fee_coverage: benefits.tuition_fee_annual != null ? String(benefits.tuition_fee_annual) : "See the official source.",
      books_and_stationery_allowance: benefits.book_grant_annual == null ? undefined : Number(benefits.book_grant_annual),
      contingency_allowance: benefits.contingency_annual == null ? undefined : Number(benefits.contingency_annual),
      additional_benefits: typeof benefits.benefit_text === "string" && benefits.benefit_text.length ? [benefits.benefit_text] : [],
    },
    required_documents: Array.isArray(s.required_document_types)
      ? s.required_document_types.map((d: string) => ({ document_type: d as any, document_name: d.replaceAll("_", " "), is_mandatory: false }))
      : [],
    application_channel: s.application_channel === "ONLINE_PORTAL" ? (sourceSystem === "NSP" || evidence.some((e: any) => String(e.source_id).toLowerCase() === "nsp") ? "NSP" : "DIRECT") : "DIRECT",
    portal_name: sourcePortal,
    status: s.status === "ACTIVE" ? "OPEN" : (s.status === "UPCOMING" ? "UPCOMING" : (s.status === "INFORMATION_ONLY" ? "INFORMATION_ONLY" : "CLOSED")),
    start_date: s.application_start_date || null,
    deadline: s.application_end_date || null,
    selection_criteria: s.eligibility_summary || (sourceSystem === "OFFICIAL_AGGREGATED" ? "See the cited official source(s) for current eligibility and selection criteria." : "See the official NSP scheme specification."),
    source_system: sourceSystem,
    source_url: s.source_url || evidence[0]?.source_url || "https://scholarships.gov.in/All-Scholarships",
    source_fetched_at: s.source_fetched_at || evidence[0]?.fetched_at || null,
    source_mode: s.source_mode || ((sourceSystem === "OFFICIAL_AGGREGATED" || sourceSystem === "NSP") ? "LIVE" : sourceSystem === "NSP_SNAPSHOT" ? "SNAPSHOT" : undefined),
    source_evidence: evidence,
    source_count: Number(s.source_count ?? evidence.length),
  };
}

function getLocalSnapshot(): Scholarship[] {
  return officialSnapshot.records.map((record) => mapScholarship({
    scholarship_id: record.scholarship_id,
    scheme_name: record.scheme_name,
    scheme_code: record.scheme_code,
    scheme_type: record.scheme_type,
    academic_year: record.academic_year,
    jurisdiction: record.jurisdiction,
    application_start_date: record.application_start_date,
    application_end_date: record.application_end_date,
    status: record.status,
    source_system: "NSP_SNAPSHOT",
    source_url: officialSnapshot.source,
    source_fetched_at: `${officialSnapshot.snapshot_date}T00:00:00.000Z`,
    source_mode: "SNAPSHOT",
    benefit_summary: { source_disclosure: officialSnapshot.disclosure },
    required_document_types: [],
    application_channel: "ONLINE_PORTAL",
  }));
}

const bundledSnapshot = getLocalSnapshot();

function getCachedScholarships(): Scholarship[] {
  hydrateCache();
  return cache?.data?.length ? cache.data : bundledSnapshot;
}

function persistCache(entry: NonNullable<typeof cache>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data: entry.data,
      expiresAt: entry.expiresAt,
      staleUntil: entry.staleUntil,
      source: entry.source,
    }));
  } catch {
    // Storage is optional; in-memory caching still works.
  }
}

function hydrateCache() {
  if (storageHydrated || typeof window === "undefined") return;
  storageHydrated = true;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as typeof cache;
    if (parsed?.data?.length && parsed.staleUntil > Date.now()) {
      cache = parsed;
    }
  } catch {
    // Ignore corrupted optional cache.
  }
}

function setCache(data: Scholarship[], source: "LIVE" | "SNAPSHOT") {
  const now = Date.now();
  cache = {
    data,
    expiresAt: now + FRESH_TTL_MS,
    staleUntil: now + STALE_TTL_MS,
    source,
  };
  persistCache(cache);
}

async function fetchRemote(): Promise<Scholarship[]> {
  const rows = await apiFetch<any[]>(`${RIJVAN_API_URL}/scholarships`);
  const data = rows.map(mapScholarship);
  if (!data.length) throw new Error("Scholarship catalogue returned no records.");
  return data;
}

function refreshInBackground(): Promise<Scholarship[]> | null {
  if (inFlight) return inFlight;
  inFlight = fetchRemote()
    .then((data) => {
      setCache(data, "LIVE");
      return data;
    })
    .catch((error) => {
      // A live outage must never erase usable official data already shown to the student.
      if (cache?.data.length) return cache.data;
      setCache(bundledSnapshot, "SNAPSHOT");
      return bundledSnapshot;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const scholarshipApi = {
  getCachedScholarships,

  async getSyncStatus(): Promise<ScholarshipSyncStatus> {
    return apiFetch<ScholarshipSyncStatus>(`${RIJVAN_API_URL}/scholarships/sync-status`);
  },

  async getScholarships(forceRefresh = false): Promise<Scholarship[]> {
    hydrateCache();

    const now = Date.now();
    if (!forceRefresh && cache?.data.length && cache.expiresAt > now) {
      return cache.data;
    }

    // The bundled official catalogue makes the first screen instant. Live NSP refreshes in the background.
    if (!forceRefresh && bundledSnapshot.length) {
      if (!cache?.data.length) setCache(bundledSnapshot, "SNAPSHOT");
      refreshInBackground();
      return cache!.data;
    }

    // Force-refresh is intentionally stale-while-revalidate: never replace a usable catalogue with a spinner/error.
    if (cache?.data.length && cache.staleUntil > now) {
      refreshInBackground();
      return cache.data;
    }

    if (inFlight) return inFlight;

    try {
      const data = await fetchRemote();
      setCache(data, "LIVE");
      return data;
    } catch (error) {
      if (bundledSnapshot.length) {
        setCache(bundledSnapshot, "SNAPSHOT");
        return bundledSnapshot;
      }
      throw error;
    }
  },

  async getScholarshipById(schemeId: string): Promise<Scholarship | null> {
    hydrateCache();
    const cached = cache?.data.find((scheme) => scheme.scheme_id === schemeId);
    if (cached) return cached;

    const bundled = bundledSnapshot.find((scheme) => scheme.scheme_id === schemeId);
    if (bundled) return bundled;

    try {
      return mapScholarship(await apiFetch<any>(`${RIJVAN_API_URL}/scholarships/${encodeURIComponent(schemeId)}`));
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  },
};
