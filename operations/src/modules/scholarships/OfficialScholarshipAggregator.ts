import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_TIMEOUT_MS = Number(process.env.SCHOLARSHIP_SOURCE_TIMEOUT_MS || 9000);
const DETAIL_TIMEOUT_MS = Number(process.env.SCHOLARSHIP_DETAIL_TIMEOUT_MS || 6500);
const ACADEMIC_YEAR = process.env.SCHOLARSHIP_ACADEMIC_YEAR || "2026-2027";
const USER_AGENT = "SIH26238-Official-Scholarship-Aggregator/3.0";
const MAX_DETAIL_PAGES = Number(process.env.SCHOLARSHIP_MAX_DETAIL_PAGES || 80);
const MAX_GENERIC_DETAIL_PAGES = Number(process.env.SCHOLARSHIP_MAX_GENERIC_DETAIL_PAGES || 20);
const DETAIL_PAGE_CAP = Math.max(1, Number(process.env.SCHOLARSHIP_DETAIL_PAGE_CAP || "12"));

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type RunStatus = "SUCCESS" | "NO_RECORDS" | "FAILED";

export interface SourceEvidence {
  source_id: string;
  source_name: string;
  source_url: string;
  fetched_at: string;
  extraction_method: string;
  confidence: Confidence;
}

interface NormalizedRecord {
  canonicalKey: string;
  schemeName: string;
  schemeCode: string;
  schemeType: string;
  educationLevel: "PRE_MATRIC" | "POST_MATRIC" | "HIGHER_EDUCATION" | "FELLOWSHIP" | "OVERSEAS";
  academicYear: string;
  jurisdiction: string;
  applicationStartDate: Date | null;
  applicationEndDate: Date | null;
  status: string;
  benefitSummary: Record<string, unknown>;
  requiredDocumentTypes: string[];
  applicationChannel: "ONLINE_PORTAL" | "DIRECT_BENEFIT";
  incomeCeiling: number | null;
  targetGroup: string;
  description: string;
  eligibilitySummary: string;
  source: SourceEvidence;
  sourcePriority: number;
}

interface SourceDefinition {
  id: string;
  name: string;
  url: string;
  kind: "NSP" | "MYSCHEME" | "UGC" | "MOTA" | "SOCIAL_JUSTICE" | "MOMA" | "DEPWD" | "EDUCATION" | "LABOUR" | "GENERIC";
  priority: number;
  enabled: boolean;
  detailCrawl?: boolean;
  maxDetailPages?: number;
  sitemapUrl?: string;
}

export interface SourceRunSummary {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  status: RunStatus;
  fetchedAt: string;
  recordsFound: number;
  recordsUpserted: number;
  durationMs: number;
  error?: string;
}

export interface AggregationSummary {
  sources: SourceRunSummary[];
  uniqueRecords: number;
  upserted: number;
  fetchedAt: string;
}
export type ScholarshipSyncStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
export type ScholarshipSyncPhase = "DISCOVERING" | "ENRICHING" | "FINALIZING" | "COMPLETE";
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

export interface ScholarshipSyncProgress {
  jobId: string | null;
  status: ScholarshipSyncStatus;
  phase: ScholarshipSyncPhase;
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

let scholarshipSyncProgress: ScholarshipSyncProgress = {
  jobId: null,
  status: "IDLE",
  phase: "COMPLETE",
  percent: 0,
  currentSourceId: null,
  currentSourceName: null,
  startedAt: null,
  updatedAt: null,
  completedAt: null,
  uniqueRecords: 0,
  upserted: 0,
  sources: [],
};

function recalculateSyncPercent() {
  if (!scholarshipSyncProgress.sources.length) return;
  scholarshipSyncProgress.percent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        scholarshipSyncProgress.sources.reduce((sum, source) => sum + source.percent, 0) /
          scholarshipSyncProgress.sources.length,
      ),
    ),
  );
}

function initializeScholarshipSyncProgress(defs: SourceDefinition[], jobId: string) {
  const startedAt = new Date().toISOString();
  scholarshipSyncProgress = {
    jobId,
    status: "RUNNING",
    phase: "DISCOVERING",
    percent: 0,
    currentSourceId: null,
    currentSourceName: null,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    uniqueRecords: 0,
    upserted: 0,
    sources: defs.map((def) => ({
      sourceId: def.id,
      sourceName: def.name,
      status: "PENDING",
      percent: 0,
      recordsFound: 0,
      recordsUpserted: 0,
      durationMs: 0,
    })),
  };
}

function updateScholarshipSyncSource(
  sourceId: string,
  patch: Partial<ScholarshipSyncSourceProgress>,
  phase?: ScholarshipSyncPhase,
) {
  const source = scholarshipSyncProgress.sources.find((item) => item.sourceId === sourceId);
  if (!source) return;
  Object.assign(source, patch);
  if (phase) scholarshipSyncProgress.phase = phase;
  const active = scholarshipSyncProgress.sources.find((item) => item.status === "RUNNING");
  scholarshipSyncProgress.currentSourceId = active?.sourceId || sourceId || null;
  scholarshipSyncProgress.currentSourceName = active?.sourceName || source.sourceName || null;
  scholarshipSyncProgress.updatedAt = new Date().toISOString();
  recalculateSyncPercent();
}

function completeScholarshipSyncProgress(
  status: "SUCCESS" | "FAILED",
  summary?: AggregationSummary,
  error?: string,
) {
  scholarshipSyncProgress.status = status;
  scholarshipSyncProgress.phase = status === "SUCCESS" ? "COMPLETE" : "FINALIZING";
  scholarshipSyncProgress.percent = status === "SUCCESS" ? 100 : scholarshipSyncProgress.percent;
  scholarshipSyncProgress.uniqueRecords = summary?.uniqueRecords || scholarshipSyncProgress.uniqueRecords;
  scholarshipSyncProgress.upserted = summary?.upserted || scholarshipSyncProgress.upserted;
  scholarshipSyncProgress.error = error;
  scholarshipSyncProgress.completedAt = new Date().toISOString();
  scholarshipSyncProgress.updatedAt = scholarshipSyncProgress.completedAt;
  scholarshipSyncProgress.currentSourceId = null;
  scholarshipSyncProgress.currentSourceName = null;
  if (status === "SUCCESS") {
    for (const source of scholarshipSyncProgress.sources) {
      if (source.status === "RUNNING" || source.status === "PENDING") {
        source.status = "SUCCESS";
        source.percent = 100;
      }
    }
  }
}

function scholarshipSyncSnapshot(): ScholarshipSyncProgress {
  return JSON.parse(JSON.stringify(scholarshipSyncProgress)) as ScholarshipSyncProgress;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return decodeEntities(value)
    .replace(/\([^)]*(?:Merit Based|Welfare Based|Central Sector|Centrally Sponsored)[^)]*\)/gi, " ")
    .replace(/\b(formally|scheme|scholarship scheme|central sector scheme|centrally sponsored scheme)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);
}

const NON_SCHOLARSHIP_PAGE_PATTERNS = [
  /^history\b/i,
  /^about(?: us)?\b/i,
  /^contact(?: us)?\b/i,
  /^home\b/i,
  /^career(?:s)?\b/i,
  /^tender(?:s)?\b/i,
  /^notice(?:s)?\b/i,
  /^circular(?:s)?\b/i,
  /^news\b/i,
  /^event(?:s)?\b/i,
  /^annual report\b/i,
  /^organization\b/i,
  /^grievance\b/i,
  /^login\b/i,
  /^search\b/i,
];

function isLikelyScholarshipCandidateTitle(value: string): boolean {
  const title = cleanHtml(value).replace(/\s+/g, " ").trim();
  if (!title || title.length < 8) return false;
  if (NON_SCHOLARSHIP_PAGE_PATTERNS.some((pattern) => pattern.test(title))) return false;
  return /(scholarship|fellowship|financial assistance|fee reimbursement|studentship|stipend|education incentive|top class education)/i.test(title);
}

function inferType(name: string): string {
  const lower = name.toLowerCase();
  if (/pre[ -]?matric|class\s*9|class\s*10/.test(lower)) return "PRE_MATRIC";
  if (/post[ -]?matric|diploma|class\s*11|class\s*12/.test(lower)) return "POST_MATRIC";
  if (/overseas|abroad/.test(lower)) return "OVERSEAS";
  if (/fellowship|research|doctoral|ph\.d|postdoctoral/.test(lower)) return "FELLOWSHIP";
  return "HIGHER_EDUCATION";
}

function parseDate(value: string): Date | null {
  const cleaned = decodeEntities(value).trim();
  const numeric = cleaned.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (numeric) {
    const [, dd, mm, yyyy] = numeric;
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const named = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  const namedAlt = cleaned.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };
  const parts = named ? [Number(named[1]), named[2].toLowerCase(), Number(named[3])]
    : namedAlt ? [Number(namedAlt[2]), namedAlt[1].toLowerCase(), Number(namedAlt[3])] : null;
  if (parts && months[parts[1]] !== undefined) {
    const date = new Date(Date.UTC(Number(parts[2]), Number(months[parts[1]]), Number(parts[0])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function status(start: Date | null, end: Date | null): string {
  if (!start && !end) return "INFORMATION_ONLY";
  const now = new Date();
  if (start && now < start) return "UPCOMING";
  if (end && now > end) return "CLOSED";
  return "ACTIVE";
}

function parseAmount(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(crore|crores|lakh|lakhs|lac|lacs|thousand|k)?/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  const multiplier = ({
    crore: 10000000, crores: 10000000,
    lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000,
    thousand: 1000, k: 1000,
  } as Record<string, number | undefined>)[(match[2] || "").toLowerCase()] || 1;
  const amount = numeric * multiplier;
  return Number.isFinite(amount) ? amount : null;
}

function extractLargestAmount(text: string): number | null {
  const matches = [...text.matchAll(/(?:â‚¹|rs\.?|inr)\s*([\d,.]+(?:\s*(?:crores?|lakhs?|lacs?|thousand|k))?)/gi)]
    .map((m) => parseAmount(m[1]))
    .filter((v): v is number => v !== null && v >= 100);
  if (!matches.length) return null;
  return Math.max(...matches);
}

function extractIncomeCeiling(text: string): number | null {
  const patterns = [
    /(?:annual|yearly)?\s*(?:family|parent(?:s)?|guardian(?:'s)?|household)?\s*income[^.]{0,220}?(?:does not exceed|not exceed|less than|up to|below)[^.]{0,100}?(?:â‚¹|rs\.?|inr)\s*([\d,.]+(?:\s*(?:crores?|lakhs?|lacs?|thousand|k))?)/i,
    /(?:income)[^.]{0,220}?(?:â‚¹|rs\.?|inr)\s*([\d,.]+(?:\s*(?:crores?|lakhs?|lacs?|thousand|k))?)\s*(?:per year|per annum|annually|a year)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = match ? parseAmount(match[1]) : null;
    if (amount !== null) return amount;
  }
  return null;
}

function sectionWindow(text: string, heading: RegExp, endHeadings: RegExp[], maxLength = 2800): string {
  const match = heading.exec(text);
  if (!match) return "";
  const headerEnd = match.index + match[0].length;
  let end = Math.min(text.length, headerEnd + maxLength);
  const tail = text.slice(headerEnd);
  for (const endHeading of endHeadings) {
    const endMatch = endHeading.exec(tail);
    if (endMatch && endMatch.index >= 0) {
      end = Math.min(end, headerEnd + endMatch.index);
    }
  }
  return text.slice(match.index, end).trim();
}

function extractApplicationWindow(text: string): { start: Date | null; end: Date | null } {
  const date = String.raw`(?:\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})`;
  const open = text.match(new RegExp(`(?:scheme|application|registration|student application)[^.;]{0,220}?(?:open(?:ed)?(?: from)?|start(?:s|ed)? on|begin(?:s|ning)?)[\\s:,-]*(${date})`, "i"));
  const till = text.match(new RegExp(`(?:student\\s+application|application|registration)[^.;]{0,240}?(?:open till|closes?|last date|deadline|due date|ends?(?: on| by)?)[\\s:,-]*(${date})`, "i"));
  return { start: open ? parseDate(open[1]) : null, end: till ? parseDate(till[1]) : null };
}

function extractDocuments(text: string): string[] {
  const window = sectionWindow(text, /documents? required/i, [/frequently asked/i, /application process/i, /benefits/i, /eligibility/i], 1800);
  if (!window) return [];
  const candidates = [
    ["aadhaar", "AADHAAR"],
    ["income certificate", "INCOME_CERTIFICATE"],
    ["caste certificate|scheduled tribe|scheduled caste", "CASTE_CERTIFICATE"],
    ["domicile|residence certificate", "DOMICILE_CERTIFICATE"],
    ["marksheet|mark sheet", "MARKSHEET"],
    ["bonafide|bonafide certificate|admission certificate", "BONAFIDE_CERTIFICATE"],
    ["bank account|passbook", "BANK_ACCOUNT"],
    ["disability certificate|udid", "DISABILITY_CERTIFICATE"],
    ["fee receipt", "FEE_RECEIPT"],
  ] as const;
  const found = new Set<string>();
  for (const [pattern, name] of candidates) if (new RegExp(pattern, "i").test(window)) found.add(name);
  return [...found];
}

function extractTargetGroup(text: string): string {
  const matches = [
    "Scheduled Tribe", "Scheduled Caste", "OBC", "EBC", "DNT", "minority communities", "girl students", "students with disabilities",
    "orphans", "students", "undergraduate", "postgraduate", "research scholars", "technical students",
  ].filter((term) => new RegExp(term, "i").test(text));
  return matches.slice(0, 5).join(", ") || "See official eligibility criteria.";
}

function extractBenefits(text: string): Record<string, unknown> {
  const window = sectionWindow(text, /benefits?/i, [/eligibility/i, /application process/i, /documents? required/i, /frequently asked/i], 3000);
  const amount = extractLargestAmount(window || text);
  return {
    maximum_amount: amount ?? 0,
    benefit_text: (window || "See the official source for benefits.").slice(0, 1800),
    source_disclosure: "Benefit details extracted from an official source page; verify current scheme rules before applying.",
  };
}

function extractDescription(text: string, schemeName: string): string {
  const details = sectionWindow(text, /details/i, [/benefits?/i, /eligibility/i, /application process/i, /documents? required/i], 1400);
  if (details && details.length > schemeName.length + 40) return details.replace(/^details?\s*/i, "").slice(0, 1200);
  return `Official scholarship information for ${schemeName}. Open the cited source for the current eligibility, benefits, documents and application route.`;
}

function sourceEvidence(def: SourceDefinition, fetchedAt: string, method: string, confidence: Confidence, url = def.url): SourceEvidence {
  return { source_id: def.id, source_name: def.name, source_url: url, fetched_at: fetchedAt, extraction_method: method, confidence };
}

const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Puducherry", "Chandigarh", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep", "Goa",
];

function detectJurisdiction(text: string, def: SourceDefinition): string {
  if (def.kind !== "MYSCHEME") return def.name;
  const preview = cleanHtml(text).slice(0, 900);
  for (const state of INDIAN_STATES_AND_UTS) {
    if (new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(preview)) {
      return `${state} â€” Government Scheme`;
    }
  }
  return def.name;
}

function canonicalKeyFor(name: string, jurisdiction: string): string {
  const base = normalizeName(name);
  const stateLike = INDIAN_STATES_AND_UTS.find((state) => jurisdiction.toLowerCase().includes(state.toLowerCase()));
  return stateLike ? `${base}|${stateLike.toLowerCase()}` : base;
}

function extractEligibility(text: string): string {
  const window = sectionWindow(text, /eligibility|who can apply|eligible/i, [/benefits?/i, /application process/i, /documents? required/i, /frequently asked/i], 3600);
  return window.replace(/^eligibility(?:\s+information|\s+criteria)?\s*:?[\s]*/i, "").slice(0, 2800).trim();
}

function toRecord(def: SourceDefinition, fetchedAt: string, name: string, options: Partial<NormalizedRecord> = {}): NormalizedRecord {
  const cleanName = cleanHtml(name).replace(/\s+/g, " ").trim();
  const start = options.applicationStartDate ?? null;
  const end = options.applicationEndDate ?? null;
  return {
    canonicalKey: options.canonicalKey || canonicalKeyFor(cleanName, options.jurisdiction || def.name),
    schemeName: cleanName,
    schemeCode: options.schemeCode || `${def.id.toUpperCase()}-${slug(cleanName).slice(0, 45)}`,
    schemeType: options.schemeType || inferType(cleanName),
    educationLevel: options.educationLevel || inferType(cleanName) as NormalizedRecord["educationLevel"],
    academicYear: options.academicYear || ACADEMIC_YEAR,
    jurisdiction: options.jurisdiction || def.name,
    applicationStartDate: start,
    applicationEndDate: end,
    status: options.status || status(start, end),
    benefitSummary: options.benefitSummary || { maximum_amount: 0, source_disclosure: "Verify benefits on the official source." },
    requiredDocumentTypes: options.requiredDocumentTypes || [],
    applicationChannel: options.applicationChannel || "ONLINE_PORTAL",
    incomeCeiling: options.incomeCeiling ?? null,
    targetGroup: options.targetGroup || "See official eligibility criteria.",
    description: options.description || `Official scholarship information discovered from ${def.name}. Verify scheme-specific eligibility, benefits and application dates on the cited source.`,
    eligibilitySummary: options.eligibilitySummary || "See official eligibility criteria.",
    source: options.source || sourceEvidence(def, fetchedAt, "OFFICIAL_HTML", def.kind === "NSP" ? "HIGH" : "MEDIUM"),
    sourcePriority: options.sourcePriority ?? def.priority,
  };
}

function safeOfficialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    return host === "scholarships.gov.in" || host.endsWith(".gov.in") || host.endsWith(".nic.in") || host === "aicte-india.org" || host.endsWith(".aicte-india.org");
  } catch {
    return false;
  }
}

function extractAnchors(html: string, baseUrl: string): Array<{ href: string; title: string }> {
  const result: Array<{ href: string; title: string }> = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const title = cleanHtml(match[2]);
    let href: string;
    try {
      href = new URL(decodeEntities(match[1]), baseUrl).toString();
    } catch {
      continue;
    }
    if (!safeOfficialUrl(href)) continue;
    result.push({ href, title });
  }
  return result;
}

function extractSchemeLinks(html: string, baseUrl: string): string[] {
  const normalized = html
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&quot;/gi, '"');
  const candidates = new Set<string>();
  const re = /(?:https?:\/\/www\.myscheme\.gov\.in)?(\/schemes\/[a-z0-9][a-z0-9_-]{1,80})/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    try {
      candidates.add(new URL(match[1], baseUrl).toString());
    } catch {
      // Ignore malformed embedded routes.
    }
  }
  return [...candidates];
}

async function fetchUrl(url: string, timeoutMs: number): Promise<string> {
  let lastError: unknown = null;
  const attempts = Math.max(1, Number(process.env.SCHOLARSHIP_SOURCE_RETRIES || 2));
  const accept = "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.7,*/*;q=0.5";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "en-IN,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!safeOfficialUrl(res.url)) throw new Error(`Redirected to a non-official host: ${res.url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      if (!body.trim()) throw new Error("Empty response body");
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "Source fetch failed"));
}

async function fetchOptional(url: string, timeoutMs: number): Promise<string | null> {
  try {
    return await fetchUrl(url, timeoutMs);
  } catch {
    return null;
  }
}

function parseNsp(def: SourceDefinition, html: string, fetchedAt: string): { records: NormalizedRecord[]; links: string[] } {
  const normalized = html.replace(/\r?\n/g, " ");
  const records: NormalizedRecord[] = [];
  const links = new Set<string>();
  const headingRe = /<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>\s*([\s\S]{0,12000}?Scheme Open from\s*:?\s*(\d{2}-\d{2}-\d{4})[\s\S]{0,2200}?Student Application Open till\s*:?\s*(\d{2}-\d{2}-\d{4}))/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(normalized))) {
    const name = cleanHtml(match[1]);
    if (!name || /Specifications|FAQ|Schemes On NSP/i.test(name)) continue;
    const start = parseDate(match[3]);
    const end = parseDate(match[4]);
    const nextHeading = normalized.indexOf("<h", match.index + match[0].length);
    const block = normalized.slice(match.index, nextHeading >= 0 ? nextHeading : match.index + 16000);
    const specAnchor = extractAnchors(block, def.url).find((a) => /\bspecifications?\b/i.test(a.title) || /specification/i.test(a.href));
    if (specAnchor?.href) links.add(specAnchor.href);
    records.push(toRecord(def, fetchedAt, name, {
      applicationStartDate: start,
      applicationEndDate: end,
      status: status(start, end),
      source: sourceEvidence(def, fetchedAt, "NSP_CATALOGUE_CARD", "HIGH", specAnchor?.href || def.url),
      sourcePriority: 100,
      description: `Official 2026-27 catalogue record from the National Scholarship Portal. The cited specification page is the authoritative source for full eligibility, benefits, documents and scheme rules.`,
    }));
  }
  return { records, links: [...links] };
}

function parseDetailPage(def: SourceDefinition, url: string, html: string, fetchedAt: string, fallbackName = ""): NormalizedRecord | null {
  const text = cleanHtml(html);
  if (text.length < 40) return null;
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanHtml(titleMatch?.[1] || fallbackName);
  if (!isLikelyScholarshipCandidateTitle(title)) return null;

  const window = extractApplicationWindow(text);
  const detailBenefit = extractBenefits(text);
  const eligibilityText = sectionWindow(text, /eligibility|who can apply|eligible/i, [/application process/i, /documents? required/i, /benefits?/i, /frequently asked/i], 4200);
  const incomeCeiling = extractIncomeCeiling(eligibilityText);
  const channel = /application process|apply online|online/i.test(text) ? "ONLINE_PORTAL" : "DIRECT_BENEFIT";
  const hrefEvidence = sourceEvidence(def, fetchedAt, `${def.kind}_DETAIL_PAGE`, def.kind === "MYSCHEME" || def.kind === "NSP" ? "HIGH" : "MEDIUM", url);
  return toRecord(def, fetchedAt, title, {
    applicationStartDate: window.start,
    applicationEndDate: window.end,
    status: status(window.start, window.end),
    benefitSummary: detailBenefit,
    requiredDocumentTypes: extractDocuments(text),
    applicationChannel: channel,
    incomeCeiling,
    targetGroup: extractTargetGroup(text),
    description: extractDescription(text, title),
    eligibilitySummary: extractEligibility(text),
    jurisdiction: detectJurisdiction(text, def),
    source: hrefEvidence,
    sourcePriority: def.priority + 5,
  });
}

function parseMySchemeIndex(def: SourceDefinition, html: string, fetchedAt: string): { records: NormalizedRecord[]; links: string[] } {
  const anchors = extractAnchors(html, def.url);
  const links = new Set<string>(extractSchemeLinks(html, def.url));
  const records: NormalizedRecord[] = [];
  for (const anchor of anchors) {
    if (!/\/schemes\//i.test(anchor.href)) continue;
    if (!isLikelyScholarshipCandidateTitle(anchor.title)) continue;
    links.add(anchor.href);
    records.push(toRecord(def, fetchedAt, anchor.title, {
      source: sourceEvidence(def, fetchedAt, "MYSCHEME_INDEX", "MEDIUM", anchor.href),
      sourcePriority: 80,
    }));
  }
  return { records, links: [...links] };
}

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html))) {
    const cells: string[] = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(row[1]))) cells.push(cleanHtml(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseUgc(def: SourceDefinition, html: string, fetchedAt: string): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  const seen = new Set<string>();

  // UGC currently exposes scheme names in table rows with a generic "View"
  // action link. Reading the row structure avoids treating the action text as
  // the scheme name.
  for (const row of extractTableRows(html)) {
    if (!/^\d+$/.test(row[0] || "")) continue;
    const title = row[1] || "";
    if (!/(scholarship|fellowship|ishan|post graduate studies|single girl child|research)/i.test(title)) continue;
    const key = normalizeName(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const rowStart = html.indexOf(title);
    const rowHtml = rowStart >= 0 ? html.slice(Math.max(0, rowStart - 200), Math.min(html.length, rowStart + 1200)) : "";
    const rowAnchor = extractAnchors(rowHtml, def.url).find((a) => /\bview\b/i.test(a.title) || /(?:Scholarships|Fellowship)\//i.test(a.href));
    records.push(toRecord(def, fetchedAt, title, {
      source: sourceEvidence(def, fetchedAt, "UGC_STUDENT_CORNER_TABLE", "HIGH", rowAnchor?.href || def.url),
      sourcePriority: 90,
    }));
  }

  // Fallback for page revisions that do not use a table.
  for (const anchor of extractAnchors(html, def.url)) {
    if (!/(scholarship|fellowship|ishan|post graduate studies|single girl child)/i.test(anchor.title)) continue;
    const key = normalizeName(anchor.title);
    if (!key || seen.has(key) || /^(view|details?)$/i.test(anchor.title)) continue;
    seen.add(key);
    records.push(toRecord(def, fetchedAt, anchor.title, {
      source: sourceEvidence(def, fetchedAt, "UGC_STUDENT_CORNER", "HIGH", anchor.href),
      sourcePriority: 90,
    }));
  }
  return records;
}

function parseMota(def: SourceDefinition, html: string, fetchedAt: string): NormalizedRecord[] {
  const text = cleanHtml(html);
  const candidates = [
    "Pre-Matric Scholarship Scheme",
    "Post Matric Scholarship",
    "National Scholarship Scheme (Top Class) For Higher Education of ST Students",
    "National Fellowship",
    "National Overseas Scholarship",
  ];
  const records: NormalizedRecord[] = [];
  for (const candidate of candidates) {
    if (!text.toLowerCase().includes(candidate.toLowerCase())) continue;
    records.push(toRecord(def, fetchedAt, candidate, {
      targetGroup: "Scheduled Tribe students",
      source: sourceEvidence(def, fetchedAt, "MOTA_SCHOLARSHIP_PAGE", "HIGH"),
      sourcePriority: 95,
      jurisdiction: "Ministry of Tribal Affairs, Government of India",
    }));
  }
  return records;
}

function parseSocialJustice(def: SourceDefinition, html: string, fetchedAt: string): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  for (const anchor of extractAnchors(html, def.url)) {
    if (!/(scholarship|fellowship|top class|education)/i.test(anchor.title)) continue;
    records.push(toRecord(def, fetchedAt, anchor.title, {
      source: sourceEvidence(def, fetchedAt, "SOCIAL_JUSTICE_SCHEME_LINK", "HIGH", anchor.href),
      sourcePriority: 90,
      jurisdiction: "Department of Social Justice & Empowerment, Government of India",
    }));
  }
  return records;
}

function parseMoma(def: SourceDefinition, html: string, fetchedAt: string): NormalizedRecord[] {
  const text = cleanHtml(html);
  const candidates = [
    "Pre-Matric Scholarship Scheme",
    "Post Matric Scholarship Scheme",
    "Merit-cum-Means based Scholarship Scheme",
  ];
  const records: NormalizedRecord[] = [];
  for (const candidate of candidates) {
    if (!text.toLowerCase().includes(candidate.toLowerCase())) continue;
    records.push(toRecord(def, fetchedAt, candidate, {
      targetGroup: "Students belonging to notified minority communities",
      source: sourceEvidence(def, fetchedAt, "MOMA_OFFICIAL_PAGE", "MEDIUM"),
      sourcePriority: 85,
      jurisdiction: "Ministry of Minority Affairs, Government of India",
      applicationChannel: "ONLINE_PORTAL",
    }));
  }
  return records;
}

function parseGeneric(def: SourceDefinition, html: string, fetchedAt: string): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  const seen = new Set<string>();
  for (const anchor of extractAnchors(html, def.url)) {
    if (!isLikelyScholarshipCandidateTitle(anchor.title)) continue;
    if (/^(view|download|click here|read more|details?)$/i.test(anchor.title)) continue;
    const key = normalizeName(anchor.title);
    if (!key || key.length < 8 || seen.has(key)) continue;
    seen.add(key);
    records.push(toRecord(def, fetchedAt, anchor.title, {
      source: sourceEvidence(def, fetchedAt, "OFFICIAL_GENERIC_LINK", "LOW", anchor.href),
      sourcePriority: def.priority,
    }));
  }
  return records;
}

function sourceDefinitions(): SourceDefinition[] {
  const defs: SourceDefinition[] = [
    { id: "nsp", name: "National Scholarship Portal (NSP)", url: process.env.NSP_SOURCE_URL || "https://scholarships.gov.in/All-Scholarships", kind: "NSP", priority: 100, enabled: process.env.NSP_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(Number(process.env.NSP_MAX_DETAIL_PAGES || 100), DETAIL_PAGE_CAP) },
    { id: "myscheme", name: "myScheme â€” Government of India", url: process.env.MYSCHEME_SOURCE_URL || "https://www.myscheme.gov.in/search", kind: "MYSCHEME", priority: 80, enabled: process.env.MYSCHEME_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(Number(process.env.MYSCHEME_MAX_DETAIL_PAGES || MAX_DETAIL_PAGES), DETAIL_PAGE_CAP), sitemapUrl: process.env.MYSCHEME_SITEMAP_URL || "https://www.myscheme.gov.in/sitemap.xml" },
    { id: "ugc", name: "University Grants Commission (UGC)", url: process.env.UGC_SOURCE_URL || "https://www.ugc.gov.in/Home/student_Corner", kind: "UGC", priority: 90, enabled: process.env.UGC_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(20, DETAIL_PAGE_CAP) },
    { id: "mota", name: "Ministry of Tribal Affairs", url: process.env.MOTA_SOURCE_URL || "https://tribal.nic.in/ScholarshiP.aspx", kind: "MOTA", priority: 95, enabled: process.env.MOTA_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(15, DETAIL_PAGE_CAP) },
    { id: "socialjustice", name: "Department of Social Justice & Empowerment", url: process.env.SOCIAL_JUSTICE_SOURCE_URL || "https://socialjustice.gov.in/schemes", kind: "SOCIAL_JUSTICE", priority: 90, enabled: process.env.SOCIAL_JUSTICE_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(20, DETAIL_PAGE_CAP) },
    { id: "moma", name: "Ministry of Minority Affairs", url: process.env.MOMA_SOURCE_URL || "https://www.minorityaffairs.gov.in/", kind: "MOMA", priority: 85, enabled: process.env.MOMA_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(10, DETAIL_PAGE_CAP) },
    { id: "depwd", name: "Department of Empowerment of Persons with Disabilities", url: process.env.DEPWD_SOURCE_URL || "https://depwd.gov.in/en/scholarship/", kind: "DEPWD", priority: 85, enabled: process.env.DEPWD_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(15, DETAIL_PAGE_CAP) },
    { id: "education", name: "Ministry of Education", url: process.env.EDUCATION_SOURCE_URL || "https://www.education.gov.in/national-scholarships-students", kind: "EDUCATION", priority: 85, enabled: process.env.EDUCATION_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(15, DETAIL_PAGE_CAP) },
    { id: "aicte", name: "All India Council for Technical Education (AICTE)", url: process.env.AICTE_SOURCE_URL || "https://www.aicte-india.org/schemes", kind: "GENERIC", priority: 88, enabled: process.env.AICTE_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(20, DETAIL_PAGE_CAP) },
    { id: "labour", name: "Ministry of Labour & Employment", url: process.env.LABOUR_SOURCE_URL || "https://labour.gov.in/", kind: "LABOUR", priority: 60, enabled: process.env.LABOUR_SOURCE_ENABLED !== "false", detailCrawl: true, maxDetailPages: Math.min(10, DETAIL_PAGE_CAP) },
  ];

  try {
    const extra = JSON.parse(process.env.ADDITIONAL_OFFICIAL_SCHOLARSHIP_SOURCES_JSON || "[]") as Array<{ id: string; name: string; url: string; enabled?: boolean; maxDetailPages?: number }>;
    for (const item of extra) {
      if (!item?.id || !item?.name || !item?.url || !safeOfficialUrl(item.url)) continue;
      defs.push({ id: item.id, name: item.name, url: item.url, kind: "GENERIC", priority: 50, enabled: item.enabled !== false, detailCrawl: true, maxDetailPages: Math.min(item.maxDetailPages ?? MAX_GENERIC_DETAIL_PAGES, DETAIL_PAGE_CAP) });
    }
  } catch {
    console.warn("[Scholarship Sources] Invalid ADDITIONAL_OFFICIAL_SCHOLARSHIP_SOURCES_JSON; ignoring custom sources.");
  }
  return defs.filter((x) => x.enabled && safeOfficialUrl(x.url));
}

function parseIndex(def: SourceDefinition, html: string, fetchedAt: string): { records: NormalizedRecord[]; links: string[] } {
  switch (def.kind) {
    case "NSP": return parseNsp(def, html, fetchedAt);
    case "MYSCHEME": return parseMySchemeIndex(def, html, fetchedAt);
    case "UGC": return { records: parseUgc(def, html, fetchedAt), links: extractAnchors(html, def.url).filter((a) => (/scholarship|fellowship/i.test(a.title) || /\/(?:Scholarships|Fellowship)\//i.test(a.href)) && !/\.pdf(?:$|\?)/i.test(a.href)).map((a) => a.href) };
    case "MOTA": return { records: parseMota(def, html, fetchedAt), links: extractAnchors(html, def.url).filter((a) => /(scholarship|fellowship|overseas|education)/i.test(`${a.title} ${a.href}`) && !/\.pdf(?:$|\?)/i.test(a.href)).map((a) => a.href) };
    case "SOCIAL_JUSTICE": return { records: parseSocialJustice(def, html, fetchedAt), links: extractAnchors(html, def.url).filter((a) => /scholarship|fellowship|top class|education/i.test(a.title) && !/\.pdf(?:$|\?)/i.test(a.href)).map((a) => a.href) };
    case "MOMA": return { records: parseMoma(def, html, fetchedAt), links: extractAnchors(html, def.url).filter((a) => /(scholarship|fellowship|education|minority)/i.test(`${a.title} ${a.href}`) && !/\.pdf(?:$|\?)/i.test(a.href)).map((a) => a.href) };
    default: return { records: parseGeneric(def, html, fetchedAt), links: extractAnchors(html, def.url).filter((a) => /scholarship|fellowship|student|education|financial assistance/i.test(a.title) && !/\.pdf(?:$|\?)/i.test(a.href)).map((a) => a.href) };
  }
}

function dedupeRecords(records: NormalizedRecord[]): NormalizedRecord[] {
  // Prefer the detail-page record over an index seed for the same URL, then
  // deduplicate semantically by canonical scheme key. This prevents myScheme
  // index + detail crawling from creating two copies of the same scheme when
  // the detail page reveals state/jurisdiction context.
  const byUrl = new Map<string, NormalizedRecord>();
  for (const record of records) {
    const url = record.source.source_url;
    const existing = byUrl.get(url);
    if (!existing || record.sourcePriority > existing.sourcePriority) byUrl.set(url, record);
  }
  const byKey = new Map<string, NormalizedRecord>();
  for (const record of byUrl.values()) {
    const existing = byKey.get(record.canonicalKey);
    if (!existing || record.sourcePriority > existing.sourcePriority || record.source.source_id !== existing.source.source_id) {
      byKey.set(record.canonicalKey, existing && existing.sourcePriority >= record.sourcePriority ? existing : record);
    }
  }
  return [...byKey.values()];
}

async function enrichRecords(
  def: SourceDefinition,
  seedRecords: NormalizedRecord[],
  links: string[],
  fetchedAt: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<NormalizedRecord[]> {
  if (!def.detailCrawl || !links.length) {
    onProgress?.(0, 0);
    return seedRecords;
  }
  const uniqueLinks = [...new Set(links)]
    .filter((url) => safeOfficialUrl(url) && !/\.pdf(?:$|\?)/i.test(url));
  if (!uniqueLinks.length) return seedRecords;

  const limit = Math.max(1, def.maxDetailPages ?? MAX_GENERIC_DETAIL_PAGES);
  let cursor = 0;
  try {
    const state = await prisma.scholarshipSourceState.findUnique({ where: { sourceId: def.id } });
    cursor = state ? Math.max(0, Math.min(state.cursor, uniqueLinks.length - 1)) : 0;
  } catch {
    // State is an optimization. If unavailable, start from the first page.
  }

  const targets = uniqueLinks.length <= limit
    ? uniqueLinks
    : Array.from({ length: Math.min(limit, uniqueLinks.length) }, (_, i) => uniqueLinks[(cursor + i) % uniqueLinks.length]);

  onProgress?.(0, targets.length);

  const enriched: NormalizedRecord[] = [];
  const concurrency = 6;
  for (let offset = 0; offset < targets.length; offset += concurrency) {
    const batch = targets.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map(async (url) => {
      const html = await fetchOptional(url, DETAIL_TIMEOUT_MS);
      if (!html) return null;
      const fallbackName = seedRecords.find((r) => r.source.source_url === url)?.schemeName || "";
      return parseDetailPage(def, url, html, fetchedAt, fallbackName);
    }));
    for (const record of results) if (record) enriched.push(record);
    onProgress?.(Math.min(offset + batch.length, targets.length), targets.length);
  }

  try {
    const nextCursor = uniqueLinks.length <= limit ? 0 : (cursor + targets.length) % uniqueLinks.length;
    await prisma.scholarshipSourceState.upsert({
      where: { sourceId: def.id },
      create: { sourceId: def.id, cursor: nextCursor, candidateCount: uniqueLinks.length },
      update: { cursor: nextCursor, candidateCount: uniqueLinks.length },
    });
  } catch {
    // Crawling still succeeds when the optional cursor state cannot be persisted.
  }

  return dedupeRecords([...enriched, ...seedRecords]);
}

function mergeRecord(existing: NormalizedRecord, incoming: NormalizedRecord): NormalizedRecord {
  const preferIncoming = incoming.sourcePriority > existing.sourcePriority;
  const start = existing.applicationStartDate || incoming.applicationStartDate;
  const end = existing.applicationEndDate || incoming.applicationEndDate;
  return {
    ...existing,
    schemeName: preferIncoming ? incoming.schemeName : existing.schemeName,
    schemeCode: preferIncoming ? incoming.schemeCode : existing.schemeCode,
    schemeType: preferIncoming ? incoming.schemeType : existing.schemeType,
    educationLevel: preferIncoming ? incoming.educationLevel : existing.educationLevel,
    academicYear: preferIncoming ? incoming.academicYear : existing.academicYear,
    jurisdiction: preferIncoming && incoming.jurisdiction ? incoming.jurisdiction : existing.jurisdiction,
    applicationStartDate: start,
    applicationEndDate: end,
    status: status(start, end),
    benefitSummary: Object.keys(incoming.benefitSummary || {}).length > Object.keys(existing.benefitSummary || {}).length ? incoming.benefitSummary : existing.benefitSummary,
    requiredDocumentTypes: existing.requiredDocumentTypes.length >= incoming.requiredDocumentTypes.length ? existing.requiredDocumentTypes : incoming.requiredDocumentTypes,
    applicationChannel: preferIncoming ? incoming.applicationChannel : existing.applicationChannel,
    incomeCeiling: existing.incomeCeiling ?? incoming.incomeCeiling,
    targetGroup: existing.targetGroup !== "See official eligibility criteria." ? existing.targetGroup : incoming.targetGroup,
    sourcePriority: Math.max(existing.sourcePriority, incoming.sourcePriority),
    description: preferIncoming ? incoming.description : (existing.description.length > 200 ? existing.description : incoming.description),
    eligibilitySummary: incoming.eligibilitySummary.length > existing.eligibilitySummary.length ? incoming.eligibilitySummary : existing.eligibilitySummary,
    source: preferIncoming ? incoming.source : existing.source,
  };
}

function buildEvidence(primary: NormalizedRecord, all: NormalizedRecord[]): SourceEvidence[] {
  const seen = new Set<string>();
  return all
    .filter((record) => record.canonicalKey === primary.canonicalKey)
    .sort((a, b) => b.sourcePriority - a.sourcePriority)
    .map((record) => record.source)
    .filter((source) => {
      const key = `${source.source_id}|${source.source_url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isCredibleRecord(record: NormalizedRecord): boolean {
  if (!record.schemeName || record.schemeName.length < 8) return false;
  if (!isLikelyScholarshipCandidateTitle(record.schemeName)) return false;
  if (!record.source.source_url || !safeOfficialUrl(record.source.source_url)) return false;
  return record.academicYear === ACADEMIC_YEAR || /20\d{2}\s*[-/]\s*20\d{2}/.test(record.academicYear);
}

export class OfficialScholarshipAggregator {
  private lastRecords = new Map<string, NormalizedRecord[]>();
  private syncInFlight: Promise<AggregationSummary> | null = null;
  async sourceDefinitionsForHealth() {
    const definitions = sourceDefinitions();
    const latestRuns = await this.latestSourceRuns();

    const latestBySource = new Map(
      latestRuns.map((run) => [run.sourceId, run]),
    );

    return definitions.map((definition) => ({
      source_id: definition.id,
      source_name: definition.name,
      source_url: definition.url,
      kind: definition.kind,
      priority: definition.priority,
      enabled: definition.enabled,
      detail_crawl: definition.detailCrawl ?? false,
      max_detail_pages: definition.maxDetailPages ?? null,
      sitemap_url: definition.sitemapUrl ?? null,
      latest_run: latestBySource.get(definition.id) ?? null,
    }));
  }

  private async persistRecords(
    records: NormalizedRecord[],
    evidenceRecords: NormalizedRecord[],
  ): Promise<{ upserted: number; primaryCounts: Map<string, number> }> {
    let upserted = 0;
    const primaryCounts = new Map<string, number>();
    const credibleRecords = records.filter(isCredibleRecord);
    const concurrency = 8;

    for (let offset = 0; offset < credibleRecords.length; offset += concurrency) {
      const batch = credibleRecords.slice(offset, offset + concurrency);
      await Promise.all(batch.map(async (record) => {
        const scholarshipId = `official_${crypto.createHash("sha1").update(`${record.canonicalKey}|${record.academicYear}`).digest("hex").slice(0, 24)}`;
        const evidence = buildEvidence(record, evidenceRecords);
        const externalReference = crypto.createHash("sha256").update(`${record.source.source_url}|${record.canonicalKey}|${record.academicYear}`).digest("hex");
        const data = {
          scholarshipId,
          schemeName: record.schemeName,
          schemeCode: `OFF-${crypto.createHash("sha1").update(`${record.canonicalKey}|${record.academicYear}`).digest("hex").slice(0, 52)}`,
          schemeType: record.schemeType,
          educationLevel: record.educationLevel,
          academicYear: record.academicYear,
          status: record.status,
          jurisdiction: record.jurisdiction,
          eligibilityRuleVersion: "OFFICIAL_SOURCE_PENDING_RULESET",
          applicationStartDate: record.applicationStartDate,
          applicationEndDate: record.applicationEndDate,
          requiredDocumentTypes: JSON.stringify(record.requiredDocumentTypes),
          benefitSummary: JSON.stringify(record.benefitSummary),
          applicationChannel: record.applicationChannel,
          incomeCeiling: record.incomeCeiling,
          targetGroup: record.targetGroup,
          description: record.description,
          eligibilitySummary: record.eligibilitySummary,
          sourceSystem: "OFFICIAL_AGGREGATED",
          sourceUrl: record.source.source_url,
          sourceFetchedAt: new Date(record.source.fetched_at),
          externalReference,
          sourceEvidence: JSON.stringify(evidence),
        } as const;

        try {
          await prisma.scholarship.upsert({
            where: { scholarshipId },
            update: data,
            create: data,
          });
        } catch {
          const fallbackCode = `${record.source.source_id.toUpperCase()}-${slug(record.schemeName).slice(0, 42)}-${record.academicYear.replace(/\D/g, "")}`.slice(0, 60);
          await prisma.scholarship.upsert({
            where: { scholarshipId },
            update: { ...data, schemeCode: fallbackCode },
            create: { ...data, schemeCode: fallbackCode },
          });
        }

        upserted += 1;
        primaryCounts.set(
          record.source.source_id,
          (primaryCounts.get(record.source.source_id) || 0) + 1,
        );
      }));
    }

    return { upserted, primaryCounts };
  }
  async syncAll(): Promise<AggregationSummary> {
    if (this.syncInFlight) return this.syncInFlight;
    const defs = sourceDefinitions();
    const jobId = `sch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    initializeScholarshipSyncProgress(defs, jobId);
    this.syncInFlight = this.runSync(jobId, defs)
      .then((summary) => {
        completeScholarshipSyncProgress("SUCCESS", summary);
        return summary;
      })
      .catch((error) => {
        completeScholarshipSyncProgress(
          "FAILED",
          undefined,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      })
      .finally(() => { this.syncInFlight = null; });
    return this.syncInFlight;
  }

  getSyncProgress(): ScholarshipSyncProgress {
    return scholarshipSyncSnapshot();
  }

  private async runSync(jobId: string, defs: SourceDefinition[]): Promise<AggregationSummary> {
    const sourceResults = await Promise.all(defs.map((def) => this.syncSource(def, jobId)));
    const fetchedAt = new Date().toISOString();
    const allRecords = sourceResults.flatMap((result) => result.records).filter(isCredibleRecord);
    const records = new Map<string, NormalizedRecord>();

    for (const record of allRecords) {
      const existing = records.get(record.canonicalKey);
      records.set(record.canonicalKey, existing ? mergeRecord(existing, record) : record);
    }

    scholarshipSyncProgress.phase = "FINALIZING";
    scholarshipSyncProgress.updatedAt = new Date().toISOString();
    scholarshipSyncProgress.percent = Math.max(95, scholarshipSyncProgress.percent);

    const persisted = await this.persistRecords([...records.values()], allRecords);
    const upserted = persisted.upserted;
    const primaryCounts = persisted.primaryCounts;

    const sourceSummaries = sourceResults.map((run) => ({
      ...run.summary,
      recordsUpserted: primaryCounts.get(run.summary.sourceId) || 0,
    }));
    for (const run of sourceSummaries) {
      await prisma.scholarshipSourceRun.create({
        data: {
          sourceId: run.sourceId,
          sourceName: run.sourceName,
          sourceUrl: run.sourceUrl,
          status: run.status,
          fetchedAt: new Date(run.fetchedAt),
          recordsFound: run.recordsFound,
          recordsUpserted: run.recordsUpserted,
          durationMs: run.durationMs,
          errorMessage: run.error,
        },
      });
    }

    scholarshipSyncProgress.uniqueRecords = records.size;
    scholarshipSyncProgress.upserted = upserted;
    scholarshipSyncProgress.updatedAt = new Date().toISOString();
    for (const run of sourceSummaries) {
      updateScholarshipSyncSource(run.sourceId, {
        recordsFound: run.recordsFound,
        recordsUpserted: run.recordsUpserted,
        durationMs: run.durationMs,
      });
    }

    return { sources: sourceSummaries, uniqueRecords: records.size, upserted, fetchedAt };
  }

  private async syncSource(def: SourceDefinition, _jobId: string): Promise<{ summary: SourceRunSummary; records: NormalizedRecord[] }> {
    const started = Date.now();
    updateScholarshipSyncSource(def.id, { status: "RUNNING", percent: 5 }, "DISCOVERING");
    const fetchedAt = new Date().toISOString();
    try {
      let html = "";
      try {
        html = await fetchUrl(def.url, DEFAULT_TIMEOUT_MS);
      } catch (primaryError) {
        if (def.kind !== "MYSCHEME" || !def.sitemapUrl) throw primaryError;
        const sitemap = await fetchOptional(def.sitemapUrl, DEFAULT_TIMEOUT_MS);
        if (!sitemap) throw primaryError;
        html = sitemap;
      }
      let parsed = parseIndex(def, html, fetchedAt);
      updateScholarshipSyncSource(def.id, {
        percent: 15,
        recordsFound: parsed.records.filter(isCredibleRecord).length,
      }, "DISCOVERING");

      if (def.kind === "MYSCHEME" && parsed.links.length < 10 && def.sitemapUrl) {
        const sitemap = await fetchOptional(def.sitemapUrl, DEFAULT_TIMEOUT_MS);
        if (sitemap) parsed.links = [...new Set([...parsed.links, ...extractSchemeLinks(sitemap, def.url)])];
      }

      const discoveredRecords = parsed.records.filter(isCredibleRecord);

      // Publish the fast catalogue immediately after discovery. Detail crawling
      // continues afterwards and the existing final merge will enrich these rows.
      const discoveredPersisted = discoveredRecords.length
        ? await this.persistRecords(discoveredRecords, discoveredRecords)
        : { upserted: 0, primaryCounts: new Map<string, number>() };

      updateScholarshipSyncSource(def.id, {
        percent: discoveredRecords.length ? 25 : 20,
        recordsFound: discoveredRecords.length,
        recordsUpserted: discoveredPersisted.upserted,
      }, "ENRICHING");

      const records = await enrichRecords(def, parsed.records, parsed.links, fetchedAt, (completed, total) => {
        const detailPercent = total > 0 ? Math.round((completed / total) * 80) : 80;
        updateScholarshipSyncSource(def.id, { percent: Math.min(95, 15 + detailPercent) }, "ENRICHING");
      });
      const summary: SourceRunSummary = {
        sourceId: def.id,
        sourceName: def.name,
        sourceUrl: def.url,
        status: records.length ? "SUCCESS" : "NO_RECORDS",
        fetchedAt,
        recordsFound: records.length,
        recordsUpserted: 0,
        durationMs: Date.now() - started,
      };
      updateScholarshipSyncSource(def.id, {
        status: records.length ? "SUCCESS" : "NO_RECORDS",
        percent: 100,
        recordsFound: records.length,
        durationMs: summary.durationMs,
      });
      return { summary, records };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Scholarship Sources] ${def.name} unavailable: ${message}`);
      updateScholarshipSyncSource(def.id, { status: "FAILED", percent: 100, durationMs: Date.now() - started, error: message });
      return {
        summary: { sourceId: def.id, sourceName: def.name, sourceUrl: def.url, status: "FAILED", fetchedAt, recordsFound: 0, recordsUpserted: 0, durationMs: Date.now() - started, error: message },
        records: [],
      };
    }
  }

  async latestSuccessfulFetchedAt(): Promise<number> {
    const latest = await prisma.scholarshipSourceRun.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    return latest?.fetchedAt.getTime() || 0;
  }

  async latestSourceRuns(): Promise<SourceRunSummary[]> {
    const rows = await prisma.scholarshipSourceRun.findMany({ orderBy: { fetchedAt: "desc" }, take: 200 });
    const seen = new Set<string>();
    const latest: SourceRunSummary[] = [];
    for (const row of rows) {
      if (seen.has(row.sourceId)) continue;
      seen.add(row.sourceId);
      latest.push({
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        status: row.status as RunStatus,
        fetchedAt: row.fetchedAt.toISOString(),
        recordsFound: row.recordsFound,
        recordsUpserted: row.recordsUpserted,
        durationMs: row.durationMs,
        error: row.errorMessage || undefined,
      });
    }
    return latest;
  }
}

export const officialScholarshipAggregator = new OfficialScholarshipAggregator();

export const officialScholarshipTestHelpers = {
  cleanHtml,
  normalizeName,
  inferType,
  extractLargestAmount,
  extractIncomeCeiling,
  extractDocuments,
  extractTargetGroup,
  parseDetailPage,
  parseDate,
  extractApplicationWindow,
  extractEligibility,
  parseMySchemeIndex,
  extractTableRows,
};
