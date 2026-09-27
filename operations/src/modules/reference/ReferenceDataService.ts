import crypto from "crypto";
import { AppError } from "@/shared/errors/AppError";

const LGD_BASE = "https://lgdirectory.gov.in/webservices/lgdws";
const UGC_COLLEGES_URL = "https://www.ugc.gov.in/colleges";
const UGC_COLLEGES_ALTERNATE_URL = "https://www.ugc.gov.in/colleges/recog_College_other";
const UBA_INSTITUTIONS_URL = "https://unnatbharatabhiyan.gov.in/rci-details/321";
const OGD_BASE = "https://api.data.gov.in/resource";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };

export interface ReferenceState {
  code: string;
  name: string;
}

export interface ReferenceDistrict {
  code: string;
  name: string;
  stateCode: string;
}

export interface InstitutionSuggestion {
  institution_id: string;
  name: string;
  affiliated_to?: string;
  address?: string;
  district?: string;
  state?: string;
  status?: string;
  source_system: "UGC" | "AISHE" | "UBA";
  source_url: string;
  retrieved_at: string;
  source_mode?: "LIVE" | "SNAPSHOT";
}

let statesCache: CacheEntry<ReferenceState[]> | null = null;
const districtsCache = new Map<string, CacheEntry<ReferenceDistrict[]>>();
let institutionCache: CacheEntry<InstitutionSuggestion[]> | null = null;
let ugcUnavailableUntil = 0;

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

async function fetchOfficialJson(url: string, timeoutMs = 15_000): Promise<string> {
  const attempts: Array<{
    label: string;
    init: RequestInit;
  }> = [
    // Match the request shape used by working LGD clients: POST with an empty
    // form payload and no custom headers.
    {
      label: "POST-empty",
      init: {
        method: "POST",
        body: new URLSearchParams(),
      },
    },
    {
      label: "POST-form",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
        body: "",
      },
    },
    {
      label: "POST-json",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: "{}",
      },
    },
    // Keep GET as a compatibility probe because some LGD deployments have
    // exposed the same public operation through GET at different times.
    {
      label: "GET",
      init: {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      },
    },
  ];

  const failures: Array<Record<string, string>> = [];

  for (const attempt of attempts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...attempt.init,
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
      });
      const text = await response.text();
      const preview = text.replace(/\s+/g, " ").trim().slice(0, 220);

      if (response.ok && text.trim()) return text;

      failures.push({
        attempt: attempt.label,
        status: String(response.status),
        statusText: response.statusText || "",
        body: preview,
      });
    } catch (error) {
      failures.push({
        attempt: attempt.label,
        status: "FETCH_ERROR",
        statusText: error instanceof Error ? error.message : String(error),
        body: "",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  const error = new Error("LGD_ATTEMPTS_EXHAUSTED") as Error & { attempts: Array<Record<string, string>> };
  error.attempts = failures;
  throw error;
}

/**
 * Fallback adapter for the official Open Government Data (OGD) Platform India
 * resource API (api.data.gov.in). This is the path documented in
 * REAL_DATA_SETUP.md as "supported" once DATA_GOV_API_KEY and the resource
 * ID are configured, but it previously did not exist in code, so the app had
 * no way to recover when the live lgdirectory.gov.in scrape target failed.
 *
 * Only attempted when both an API key and the relevant resource ID are
 * present in the environment; otherwise the caller should skip straight to
 * reporting the LGD failure.
 */
async function fetchOgdResource(
  resourceId: string,
  apiKey: string,
  filters: Record<string, string> = {},
  timeoutMs = 15_000
): Promise<Array<Record<string, unknown>>> {
  const url = new URL(`${OGD_BASE}/${encodeURIComponent(resourceId)}`);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5000");
  for (const [key, value] of Object.entries(filters)) {
    if (value) url.searchParams.set(`filters[${key}]`, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OGD resource API returned HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as { records?: unknown };
    if (!Array.isArray(parsed.records)) {
      throw new Error("OGD resource API response did not contain a 'records' array.");
    }
    return parsed.records as Array<Record<string, unknown>>;
  } finally {
    clearTimeout(timeout);
  }
}

function ogdCredentials(resourceIdEnvVar: string): { apiKey: string; resourceId: string } | null {
  const apiKey = process.env.DATA_GOV_API_KEY;
  const resourceId = process.env[resourceIdEnvVar];
  if (!apiKey || !resourceId) return null;
  return { apiKey, resourceId };
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/html, application/json;q=0.9, */*;q=0.8",
        "User-Agent": "SIH26238/1.0 Government Reference Directory Client",
        Referer: "https://unnatbharatabhiyan.gov.in/",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Official reference source returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseUnknownCollection(payload: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    if (parsed && typeof parsed === "object") {
      const object = parsed as Record<string, unknown>;
      for (const key of ["records", "data", "result", "results", "items", "states", "districts"]) {
        if (Array.isArray(object[key])) return object[key] as Array<Record<string, unknown>>;
      }
      return [object];
    }
  } catch {
    // XML is handled below.
  }
  return [];
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) normalized.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), value);
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return undefined;
}

// Candidate field names cover both the LGD webservice's own JSON shape and
// the differently-cased/worded columns published on the OGD Platform
// (api.data.gov.in), e.g. "State Name (In English)" normalizes to
// "statenameinenglish" via firstString's key normalization.
const STATE_CODE_KEYS = ["statecode", "lgdstatecode", "statelgdcode", "code", "stateid", "lgdcode"];
const STATE_NAME_KEYS = ["statename", "statesname", "statenameinenglish", "statenameenglish", "name"];
const DISTRICT_CODE_KEYS = ["districtcode", "lgddistrictcode", "districtlgdcode", "code", "districtid", "lgdcode"];
const DISTRICT_NAME_KEYS = ["districtname", "districtsname", "districtnameinenglish", "districtnameenglish", "name"];

function rowsToStates(jsonRows: Array<Record<string, unknown>>): ReferenceState[] {
  const rows = jsonRows.map((row) => ({
    code: firstString(row, STATE_CODE_KEYS) || "",
    name: firstString(row, STATE_NAME_KEYS) || "",
  })).filter((row) => row.code && row.name);
  return dedupeBy(rows, (r) => r.code);
}

function rowsToDistricts(jsonRows: Array<Record<string, unknown>>, fallbackStateCode: string): ReferenceDistrict[] {
  const rows = jsonRows.map((row) => ({
    code: firstString(row, DISTRICT_CODE_KEYS) || "",
    name: firstString(row, DISTRICT_NAME_KEYS) || "",
    stateCode: firstString(row, STATE_CODE_KEYS) || fallbackStateCode,
  })).filter((row) => row.code && row.name);
  return dedupeBy(rows, (r) => r.code);
}

function parseStates(payload: string): ReferenceState[] {
  const jsonRows = parseUnknownCollection(payload);
  if (jsonRows.length) {
    const rows = rowsToStates(jsonRows);
    if (rows.length) return rows;
  }

  const rows: ReferenceState[] = [];
  const pairRegex = /<(?:state|item|record)[^>]*>[\s\S]*?<[^>]*(?:statecode|code)[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<[^>]*(?:statename|name)[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<\/(?:state|item|record)>/gi;
  for (const match of payload.matchAll(pairRegex)) rows.push({ code: cleanText(match[1]), name: cleanText(match[2]) });
  return dedupeBy(rows.filter((r) => r.code && r.name), (r) => r.code);
}

function parseDistricts(payload: string, stateCode: string): ReferenceDistrict[] {
  const jsonRows = parseUnknownCollection(payload);
  if (jsonRows.length) {
    const rows = rowsToDistricts(jsonRows, stateCode);
    if (rows.length) return rows;
  }

  const rows: ReferenceDistrict[] = [];
  const pairRegex = /<(?:district|item|record)[^>]*>[\s\S]*?<[^>]*(?:districtcode|code)[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<[^>]*(?:districtname|name)[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<\/(?:district|item|record)>/gi;
  for (const match of payload.matchAll(pairRegex)) rows.push({ code: cleanText(match[1]), name: cleanText(match[2]), stateCode });
  return dedupeBy(rows.filter((r) => r.code && r.name), (r) => r.code);
}

function dedupeBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const row of rows) {
    const k = key(row).trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    output.push(row);
  }
  return output;
}

function deterministicInstitutionId(name: string, state: string, address: string): string {
  const digest = crypto.createHash("sha256").update(`${name}|${state}|${address}`.toLowerCase()).digest("hex").slice(0, 16).toUpperCase();
  return `UGC-${digest}`;
}

function normalizeHeader(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseUgcColleges(html: string): InstitutionSuggestion[] {
  const output: InstitutionSuggestion[] = [];
  const retrievedAt = new Date().toISOString();
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let headerIndexes: Record<string, number> | null = null;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const row = rowMatch[1];
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) => cleanText(m[1]));
    if (cells.length < 6) continue;

    const headers = cells.map(normalizeHeader);
    const looksLikeHeader = headers.some((h) => h === "nameofthecollege") ||
      headers.some((h) => h === "affiliatedtouniversity") ||
      headers.some((h) => h === "collegeaddress");

    if (looksLikeHeader) {
      headerIndexes = {
        name: headers.findIndex((h) => h === "nameofthecollege"),
        affiliated: headers.findIndex((h) => h === "affiliatedtouniversity"),
        address: headers.findIndex((h) => h === "collegeaddress"),
        district: headers.findIndex((h) => h === "district"),
        state: headers.findIndex((h) => h === "state"),
        status: headers.findIndex((h) => h === "status"),
      };
      continue;
    }

    // The current official UGC table has these columns in this order:
    // Sr No, Name of the college, Affiliated To University, College address,
    // District, State, Status, Year of Estb., Teaching Upto, Govt/Non Govt,
    // Aided/Unaided. Map by header when available, with this published
    // column order as a compatibility fallback.
    const indexes = headerIndexes || {
      name: 1, affiliated: 2, address: 3, district: 4, state: 5, status: 6,
    };

    const pick = (index: number) => (index >= 0 && index < cells.length ? cells[index] : "");
    const name = pick(indexes.name);
    const affiliatedTo = pick(indexes.affiliated);
    const address = pick(indexes.address);
    const district = pick(indexes.district);
    const state = pick(indexes.state);
    const status = pick(indexes.status);

    if (!name || !state || !/\w/.test(name)) continue;
    if (name.length < 3 || name.length > 300) continue;
    if (/^sr\.?\s*no\.?$/i.test(name)) continue;

    output.push({
      institution_id: deterministicInstitutionId(name, state, address || ""),
      name,
      affiliated_to: affiliatedTo || undefined,
      address: address || undefined,
      district: district || undefined,
      state: state || undefined,
      status: status || undefined,
      source_system: "UGC",
      source_url: UGC_COLLEGES_URL,
      retrieved_at: retrievedAt,
      source_mode: "LIVE",
    });
  }

  return dedupeBy(output, (r) => `${r.name}|${r.state}|${r.address || ""}`);
}

export class ReferenceDataService {
  async listStates(forceRefresh = false): Promise<ReferenceState[]> {
    if (!forceRefresh && statesCache && statesCache.expiresAt > Date.now()) return statesCache.value;
    const endpoint = `${LGD_BASE}/stateList`;
    const diagnostics: Record<string, unknown> = { source_system: "LGD", endpoint };

    let rows: ReferenceState[] = [];
    try {
      const payload = await fetchOfficialJson(endpoint);
      rows = parseStates(payload);
      if (!rows.length) diagnostics.lgd_parse_failure = "Response received but no state records could be parsed.";
    } catch (error) {
      diagnostics.lgd_attempts = (error as { attempts?: unknown }).attempts ?? String(error);
    }

    if (!rows.length) {
      const ogd = ogdCredentials("LGD_OGD_STATES_RESOURCE_ID");
      if (ogd) {
        try {
          const records = await fetchOgdResource(ogd.resourceId, ogd.apiKey);
          rows = rowsToStates(records);
          diagnostics.ogd_used = true;
          if (!rows.length) diagnostics.ogd_parse_failure = "OGD resource responded but no state records could be parsed.";
        } catch (error) {
          diagnostics.ogd_error = error instanceof Error ? error.message : String(error);
        }
      } else {
        diagnostics.ogd_configured = false;
      }
    }

    rows = rows.sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) {
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "The official state directory could not be reached or parsed from either the LGD service or the OGD fallback API.",
        503,
        diagnostics
      );
    }
    statesCache = { value: rows, expiresAt: Date.now() + CACHE_TTL_MS };
    return rows;
  }

  async listDistricts(stateCode: string, forceRefresh = false): Promise<ReferenceDistrict[]> {
    const key = stateCode.trim();
    const cached = districtsCache.get(key);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
    if (!/^\d+$/.test(key)) throw AppError.invalidRequest("A valid LGD state code is required.");
    const endpoint = `${LGD_BASE}/districtList?stateCode=${encodeURIComponent(key)}`;
    const diagnostics: Record<string, unknown> = { source_system: "LGD", endpoint, state_code: key };

    let rows: ReferenceDistrict[] = [];
    try {
      const payload = await fetchOfficialJson(endpoint);
      rows = parseDistricts(payload, key);
      if (!rows.length) diagnostics.lgd_parse_failure = "Response received but no district records could be parsed.";
    } catch (error) {
      diagnostics.lgd_attempts = (error as { attempts?: unknown }).attempts ?? String(error);
    }

    if (!rows.length) {
      const ogd = ogdCredentials("LGD_OGD_DISTRICTS_RESOURCE_ID");
      if (ogd) {
        try {
          const records = await fetchOgdResource(ogd.resourceId, ogd.apiKey, { state_code: key });
          // The exact OGD filter column name for state varies by dataset, so
          // the server-side filter above is a best-effort narrowing. Always
          // re-filter client-side against the row's own resolved state code
          // so a filter miss (which makes the API return every district
          // nationwide) can never leak other states into this dropdown.
          rows = rowsToDistricts(records, key).filter((row) => row.stateCode === key);
          diagnostics.ogd_used = true;
          if (!rows.length) diagnostics.ogd_parse_failure = "OGD resource responded but no district records could be parsed for this state.";
        } catch (error) {
          diagnostics.ogd_error = error instanceof Error ? error.message : String(error);
        }
      } else {
        diagnostics.ogd_configured = false;
      }
    }

    rows = rows.sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) {
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "The official district directory could not be reached or parsed from either the LGD service or the OGD fallback API, for the selected state.",
        503,
        diagnostics
      );
    }
    districtsCache.set(key, { value: rows, expiresAt: Date.now() + CACHE_TTL_MS });
    return rows;
  }

  async searchInstitutions(query: string, state?: string, district?: string, limit = 10): Promise<InstitutionSuggestion[]> {
    const q = query.trim();
    if (q.length < 2 || q.length > 120) return [];

    const aisheRows = searchAisheInstitutions(q, state, district, limit);
    const ubaRows = await searchUbaInstitutions(q, state, district, limit);

    // UGC is a live page source and can be slow. Keep its cached directory,
    // but do not make UGC availability a prerequisite when another official
    // education/government source can answer the query.
    let ugcRows: InstitutionSuggestion[] = [];
    const now = Date.now();
    if ((!institutionCache || institutionCache.expiresAt <= now) && now >= ugcUnavailableUntil) {
      let rows: InstitutionSuggestion[] = [];
      let lastError: unknown = null;
      for (const url of [UGC_COLLEGES_URL, UGC_COLLEGES_ALTERNATE_URL]) {
        try {
          const html = await fetchText(url, 60_000);
          rows = parseUgcColleges(html);
          if (rows.length) break;
          lastError = new Error(`No college rows could be parsed from ${url}`);
        } catch (error) {
          lastError = error;
        }
      }
      if (rows.length) {
        institutionCache = { value: rows, expiresAt: now + CACHE_TTL_MS };
        ugcUnavailableUntil = 0;
      } else {
        ugcUnavailableUntil = now + 10 * 60 * 1000;
      }
    }

    if (institutionCache) {
      const candidates = institutionCache.value.filter((item) => {
        const haystack = normalizedText(`${item.name} ${item.affiliated_to || ""} ${item.address || ""}`);
        return haystack.includes(normalizedText(q));
      });
      ugcRows = rankInstitutionResults(candidates, q, state, district).slice(0, Math.max(25, limit * 4));
    }

    const combined = [...ugcRows, ...aisheRows, ...ubaRows];
    const seen = new Set<string>();
    const deduped: InstitutionSuggestion[] = [];
    for (const item of combined) {
      const identity = String(item.institution_id || "").toLowerCase();
      const key = identity || `${normalizedText(item.name)}|${normalizedText(item.state || "")}|${normalizedText(item.district || "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    // Prefer exact district matches. If a source has no district but its state
    // matches, keep it behind exact matches instead of falsely discarding it.
    const stateQ = state ? normalizeLocation(state) : "";
    const districtQ = district ? normalizeLocation(district) : "";
    deduped.sort((a, b) => {
      const score = (item: InstitutionSuggestion) => {
        let value = scoreInstitution(item, normalizedText(q));
        if (stateQ && item.state && locationMatches(item.state, stateQ)) value += 150;
        if (districtQ && item.district && locationMatches(item.district, districtQ)) value += 500;
        if (item.source_system === "AISHE") value += 30;
        if (item.source_system === "UBA") value += 60;
        return value;
      };
      return score(b) - score(a);
    });

    return deduped.slice(0, Math.max(1, Math.min(25, limit)));
  }
}

function normalizeLocation(value: string): string {
  let normalized = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(dist|district|dt)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Prayagraj was officially known as Allahabad until the district/city
  // name change. AISHE historical records may still contain "Allahabad".
  // Treat the two names as the same location for directory matching.
  if (normalized === "allahabad") normalized = "prayagraj";
  return normalized;
}

function locationMatches(value: string, query: string): boolean {
  const v = normalizeLocation(value);
  const q = normalizeLocation(query);
  if (!v || !q) return false;
  return v === q || v.includes(q) || q.includes(v);
}

function normalizedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aisheSourceUrl(_code: string): string {
  return "https://dashboard.aishe.gov.in/hedirectory/#/institutionDirectory";
}

function loadAisheSearch(): ((query: string, limit?: number) => Array<{ aisheCode: string; name: string; state: string; district?: string }>) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require("aishe-institutions-list") as {
      search?: (query: string, limit?: number) => Array<{ aisheCode: string; name: string; state: string; district?: string }>;
      default?: {
        search?: (query: string, limit?: number) => Array<{ aisheCode: string; name: string; state: string; district?: string }>;
      };
    };
    const search = loaded.search || loaded.default?.search;
    return typeof search === "function" ? search.bind(loaded.search ? loaded : loaded.default) : null;
  } catch {
    return null;
  }
}

let ubaInstitutionCache: CacheEntry<InstitutionSuggestion[]> | null = null;
let ubaUnavailableUntil = 0;

function normalizedHeader(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function headerIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex((h) => h === candidate);
    if (index >= 0) return index;
  }
  return -1;
}

export function parseUbaInstitutions(html: string): InstitutionSuggestion[] {
  const retrievedAt = new Date().toISOString();
  const output: InstitutionSuggestion[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let indexes: { name: number; code: number; district: number } | null = null;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const cells = Array.from(rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) => cleanText(m[1]));
    if (cells.length < 4) continue;

    const headers = cells.map(normalizedHeader);
    const looksLikeHeader = headers.some((h) => h === "institutename" || h === "aishecode" || h === "districts" || h === "district" || h === "institute");
    if (looksLikeHeader && (headers.includes("aishecode") || headers.includes("institutename"))) {
      indexes = {
        name: headerIndex(headers, ["institutename", "institute", "institutenamecollege", "nameofinstitute", "nameofcollege"]),
        code: headerIndex(headers, ["aishecode", "aishecode ".trim(), "institutioncode"]),
        district: headerIndex(headers, ["districts", "district", "districtname"]),
      };
      continue;
    }

    const rowIndexes = indexes || { name: 1, code: 2, district: 3 };
    const pick = (index: number) => index >= 0 && index < cells.length ? cells[index].trim() : "";
    let name = pick(rowIndexes.name);
    let code = pick(rowIndexes.code).toUpperCase();
    const district = pick(rowIndexes.district);

    // The published UBA table is currently: ID | Institute Name | Aishe Code | Districts | ...
    // Keep a defensive scan in case responsive markup shifts cells without changing data order.
    if (!/^[CUS]-\d+$/i.test(code)) {
      const detectedCodeIndex = cells.findIndex((cell) => /^[CUS]-\d+$/i.test(cell));
      if (detectedCodeIndex >= 0) {
        code = cells[detectedCodeIndex].toUpperCase();
        if (rowIndexes.name < 0 || !name || /^\d+$/.test(name)) {
          name = cells[detectedCodeIndex - 1] || "";
        }
      }
    }

    if (!name || !code || !/^[CUS]-\d+$/i.test(code)) continue;
    if (name.length < 3 || name.length > 300) continue;

    output.push({
      institution_id: code,
      name,
      district: district || undefined,
      state: "Uttar Pradesh",
      source_system: "UBA",
      source_url: UBA_INSTITUTIONS_URL,
      retrieved_at: retrievedAt,
      source_mode: "LIVE",
    });
  }

  return dedupeBy(output, (r) => `${r.institution_id}|${normalizedText(r.name)}`);
}

async function fetchUbaInstitutions(): Promise<InstitutionSuggestion[]> {
  const now = Date.now();
  if (ubaInstitutionCache && ubaInstitutionCache.expiresAt > now) return ubaInstitutionCache.value;
  if (now < ubaUnavailableUntil) return [];

  try {
    const html = await fetchText(UBA_INSTITUTIONS_URL, 60_000);
    const rows = parseUbaInstitutions(html);
    if (!rows.length) throw new Error("No UBA institution rows could be parsed from the official page.");
    ubaInstitutionCache = { value: rows, expiresAt: now + CACHE_TTL_MS };
    ubaUnavailableUntil = 0;
    return rows;
  } catch {
    ubaUnavailableUntil = now + 10 * 60 * 1000;
    return [];
  }
}

function rankInstitutionResults(
  rows: InstitutionSuggestion[],
  q: string,
  state?: string,
  district?: string,
): InstitutionSuggestion[] {
  const nq = normalizedText(q);
  const stateQ = state ? normalizeLocation(state) : "";
  const districtQ = district ? normalizeLocation(district) : "";
  return rows
    .filter((item) => !stateQ || !item.state || locationMatches(item.state, stateQ))
    .sort((a, b) => {
      const score = (item: InstitutionSuggestion) => {
        let value = scoreInstitution(item, nq);
        if (stateQ && item.state && locationMatches(item.state, stateQ)) value += 150;
        if (districtQ && item.district && locationMatches(item.district, districtQ)) value += 350;
        if (!item.district) value += 15;
        return value;
      };
      return score(b) - score(a);
    });
}

function searchAisheInstitutions(
  query: string,
  state?: string,
  district?: string,
  limit = 25,
): InstitutionSuggestion[] {
  const search = loadAisheSearch();
  if (!search) return [];
  const rows = search(query, Math.max(100, Math.min(500, limit * 20))) || [];
  const stateQ = state ? normalizeLocation(state) : "";
  const districtQ = district ? normalizeLocation(district) : "";

  const mapped = rows
    .filter((row) => row && (row.aisheCode || (row as any).aishe_code) && row.name && row.state)
    .map((row: any) => ({
      institution_id: String(row.aisheCode || row.aishe_code).trim(),
      name: String(row.name).trim(),
      state: row.state?.trim() || undefined,
      district: row.district?.trim() || undefined,
      source_system: "AISHE" as const,
      source_url: aisheSourceUrl(String(row.aisheCode || row.aishe_code)),
      retrieved_at: new Date().toISOString(),
      source_mode: "SNAPSHOT" as const,
    }))
    .filter((item) => {
      if (stateQ && (!item.state || !locationMatches(item.state, stateQ))) return false;
      if (districtQ && item.district && !locationMatches(item.district, districtQ)) return false;
      return normalizedText(`${item.name} ${item.state || ""} ${item.district || ""}`).includes(normalizedText(query));
    });

  return rankInstitutionResults(mapped, query, state, district).slice(0, Math.max(25, limit * 4));
}

async function searchUbaInstitutions(
  query: string,
  state?: string,
  district?: string,
  limit = 25,
): Promise<InstitutionSuggestion[]> {
  // This RCI dashboard is the official Uttar Pradesh UBA directory. Do not
  // fetch it for other states; UGC/AISHE/OGD sources handle those locations.
  if (state && !locationMatches(state, "Uttar Pradesh")) return [];
  try {
    const rows = await fetchUbaInstitutions();
    const nq = normalizedText(query);
    const candidates = rows.filter((item) => {
      if (state && item.state && !locationMatches(item.state, state)) return false;
      const haystack = normalizedText(`${item.name} ${item.institution_id} ${item.district || ""}`);
      const words = nq.split(" ").filter(Boolean);
      return words.length > 0 && words.every((word) => haystack.includes(word));
    });
    return rankInstitutionResults(candidates, query, state, district).slice(0, Math.max(10, limit));
  } catch {
    return [];
  }
}

function scoreInstitution(item: InstitutionSuggestion, q: string): number {
  const name = item.name.toLowerCase();
  let score = 0;
  if (name.startsWith(q)) score += 100;
  if (name.includes(` ${q}`)) score += 50;
  if (name.includes(q)) score += 25;
  return score;
}

export const referenceDataService = new ReferenceDataService();
