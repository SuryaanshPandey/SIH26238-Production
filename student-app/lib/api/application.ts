import { Application, Deficiency, RequiredStudentAction } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";

/**
 * Application API Service.
 *
 * The list endpoint is intentionally lightweight and cached client-side for a
 * short window so navigation/React StrictMode does not repeatedly hit the
 * backend. Mutations invalidate the cache.
 */
function mapActor(actor: string): Application["timeline"][number]["actor"] {
  switch (actor) {
    case "STUDENT":
    case "INSTITUTE":
    case "STATE_DNO":
    case "MINISTRY":
    case "PFMS_SYSTEM":
      return actor;
    case "SYSTEM":
      return "MINISTRY";
    case "REVIEWER":
      return "STATE_DNO";
    case "ADMIN":
      return "MINISTRY";
    default:
      return "MINISTRY";
  }
}

function mapApplication(a: any): Application {
  return {
    application_id: a.application_id,
    student_id: a.student_id,
    scheme_id: a.scholarship_id,
    scheme_name: a.scheme_name || a.scholarship_name || a.scholarship?.schemeName || a.scholarship_id,
    academic_year: a.academic_year,
    institution_name: a.institution_name || a.institution?.institutionName || a.institution_id,
    course: a.course || "",
    current_stage: a.current_stage || a.status,
    submitted_at: a.submitted_at || new Date().toISOString(),
    last_updated_at: a.updated_at || new Date().toISOString(),
    submitted_documents: [],
    timeline: [],
    deficiency_ids: a.deficiency_ids || [],
    sanction_id: a.sanction_id || undefined,
    payment_id: a.payment_id || undefined,
  };
}

const applicationCache = new Map<string, { savedAt: number; data: Application[] }>();
const inflightRequests = new Map<string, Promise<Application[]>>();
const APPLICATION_CACHE_TTL_MS = 30_000;
const APPLICATION_STALE_TTL_MS = 30 * 60_000;

function invalidateApplicationCache(studentId: string) {
  applicationCache.delete(studentId);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(`sih26238.applications.${studentId}`);
    } catch {
      // Ignore storage availability errors.
    }
  }
}

function readBrowserApplicationCache(studentId: string, allowStale = false): Application[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`sih26238.applications.${studentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    const maxAge = allowStale ? APPLICATION_STALE_TTL_MS : APPLICATION_CACHE_TTL_MS;
    if (Number(parsed.savedAt) + maxAge <= Date.now()) return null;
    return parsed.data as Application[];
  } catch {
    return null;
  }
}

function writeBrowserApplicationCache(studentId: string, data: Application[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `sih26238.applications.${studentId}`,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export const applicationApi = {
  getCachedApplications(): Application[] {
    const studentId = getCurrentStudentId();
    if (!studentId) return [];
    const memory = applicationCache.get(studentId);
    if (memory) return memory.data;
    const browser = readBrowserApplicationCache(studentId, true);
    if (browser) {
      applicationCache.set(studentId, { savedAt: Date.now(), data: browser });
      return browser;
    }
    return [];
  },

  async getApplications(options?: { force?: boolean }): Promise<Application[]> {
    const studentId = getCurrentStudentId();
    if (!studentId) throw new Error("Please sign in before viewing applications.");

    const now = Date.now();
    const memoryCached = applicationCache.get(studentId);
    if (!options?.force && memoryCached && memoryCached.savedAt + APPLICATION_CACHE_TTL_MS > now) {
      return memoryCached.data;
    }

    const browserCached = !options?.force ? readBrowserApplicationCache(studentId) : null;
    if (browserCached) {
      applicationCache.set(studentId, { savedAt: now, data: browserCached });
      return browserCached;
    }

    const inflightKey = studentId;
    const existing = !options?.force ? inflightRequests.get(inflightKey) : undefined;
    if (existing) return existing;

    const request = apiFetch<any[]>(
      `${RIJVAN_API_URL}/applications`
    )
      .then((list) => {
        const mapped = list.map(mapApplication);
        applicationCache.set(studentId, { savedAt: Date.now(), data: mapped });
        writeBrowserApplicationCache(studentId, mapped);
        return mapped;
      })
      .finally(() => {
        if (inflightRequests.get(inflightKey) === request) {
          inflightRequests.delete(inflightKey);
        }
      });

    inflightRequests.set(inflightKey, request);
    return request;
  },

  async getApplicationById(id: string): Promise<Application | null> {
    try {
      const [a, timeline] = await Promise.all([
        apiFetch<any>(`${RIJVAN_API_URL}/applications/${encodeURIComponent(id)}`),
        apiFetch<any[]>(`${RIJVAN_API_URL}/applications/${encodeURIComponent(id)}/timeline`),
      ]);
      const mapped = mapApplication(a);
      mapped.timeline = timeline.map((e: any) => ({
        event_id: e.audit_event_id,
        stage: mapped.current_stage,
        title: e.action,
        description: e.reason || "",
        timestamp: e.timestamp,
        actor: mapActor(e.actor_type),
        status: "COMPLETED",
      }));
      return mapped;
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  },

  async submitApplication(data: {
    scheme_id: string;
    student_id: string;
    course: string;
    is_hosteller: boolean;
    submitted_document_ids: string[];
    academic_year?: string;
    consent_granted: boolean;
  }): Promise<Application> {
    const studentId = getCurrentStudentId() || data.student_id;
    if (!studentId) throw new Error("Please sign in before submitting an application.");

    const draft = await apiFetch<any>(`${RIJVAN_API_URL}/applications`, {
      method: "POST",
      body: JSON.stringify({
        studentId,
        scholarshipId: data.scheme_id,
        academicYear:
          data.academic_year ||
          (() => {
            const now = new Date();
            const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            return `${startYear}-${startYear + 1}`;
          })(),
      }),
    });

    const submitted = await apiFetch<any>(
      `${RIJVAN_API_URL}/applications/${encodeURIComponent(draft.application_id)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ studentId, consentGranted: data.consent_granted }),
      }
    );

    const mapped = mapApplication(submitted);
    invalidateApplicationCache(studentId);
    return mapped;
  },

  async getApplicationDocuments(applicationId: string): Promise<import("../contracts/types").DocumentItem[]> {
    const { documentsApi } = await import("./documents");
    return documentsApi.getDocumentsByApplicationId(applicationId);
  },

  async getDeficiencies(): Promise<Deficiency[]> {
    const studentId = getCurrentStudentId();
    if (!studentId) throw new Error("Please sign in before viewing deficiencies.");
    return (await apiFetch<any[]>(
      `${RIJVAN_API_URL}/deficiencies?studentId=${encodeURIComponent(studentId)}`
    )) as Deficiency[];
  },

  async resolveDeficiency(
    deficiencyId: string,
    payload: {
      action: RequiredStudentAction;
      clarificationText?: string;
      replacementDocName?: string;
    }
  ): Promise<Deficiency> {
    const result = await apiFetch<Deficiency>(
      `${RIJVAN_API_URL}/deficiencies/${encodeURIComponent(deficiencyId)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify({
          note: payload.clarificationText || payload.replacementDocName || payload.action,
          actorId: getCurrentStudentId() || "STUDENT",
        }),
      }
    );
    if (getCurrentStudentId()) invalidateApplicationCache(getCurrentStudentId() as string);
    return result;
  },
};
