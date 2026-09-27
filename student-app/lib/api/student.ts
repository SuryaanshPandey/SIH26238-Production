import { StudentProfile } from "../contracts/types";
import { LIVE_BACKEND, RIJVAN_API_URL } from "../config";
import { apiFetch } from "./http";

const PROFILE_CACHE_KEY = "sih26238.student.profile";
const PROFILE_CACHE_TTL_MS = 5 * 60_000;
const PROFILE_STALE_TTL_MS = 2 * 60 * 60_000;
let profileCache: { savedAt: number; data: StudentProfile } | null = null;
let profileInFlight: Promise<StudentProfile> | null = null;

function readBrowserCache(allowStale = false): { savedAt: number; data: StudentProfile } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !Number.isFinite(Number(parsed.savedAt))) return null;
    const maxAge = allowStale ? PROFILE_STALE_TTL_MS : PROFILE_CACHE_TTL_MS;
    if (Number(parsed.savedAt) + maxAge <= Date.now()) return null;
    return { savedAt: Number(parsed.savedAt), data: parsed.data as StudentProfile };
  } catch {
    return null;
  }
}

function writeBrowserCache(data: StudentProfile) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Session cache is optional.
  }
}

function hydrateProfileCache(allowStale = false): StudentProfile | null {
  if (profileCache) return profileCache.data;
  const browser = readBrowserCache(allowStale);
  if (browser) {
    profileCache = browser;
    return browser.data;
  }
  return null;
}

export const studentApi = {
  getCachedProfile(options?: { allowStale?: boolean }): StudentProfile | null {
    return hydrateProfileCache(options?.allowStale ?? true);
  },

  invalidateProfileCache() {
    profileCache = null;
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
    }
  },

  async getProfile(options?: { force?: boolean }): Promise<StudentProfile> {
    if (!LIVE_BACKEND) throw new Error("Live backend is required for student profile data.");

    const cached = hydrateProfileCache(false);
    if (!options?.force && cached && profileCache && profileCache.savedAt + PROFILE_CACHE_TTL_MS > Date.now()) {
      return cached;
    }
    if (!options?.force && profileInFlight) return profileInFlight;

    const request = apiFetch<StudentProfile>(`${RIJVAN_API_URL}/auth/student/me`)
      .then((data) => {
        profileCache = { savedAt: Date.now(), data };
        writeBrowserCache(data);
        return data;
      })
      .finally(() => {
        if (profileInFlight === request) profileInFlight = null;
      });

    if (!options?.force) profileInFlight = request;
    return request;
  },

  async updateProfile(updates: Partial<StudentProfile>): Promise<StudentProfile> {
    if (!LIVE_BACKEND) throw new Error("Live backend is required for student profile updates.");
    const updated = await apiFetch<StudentProfile>(`${RIJVAN_API_URL}/auth/student/profile`, {
      method: "PATCH",
      body: JSON.stringify({
        phone: updates.contact?.phone_masked,
        email: updates.contact?.email_masked,
        location: updates.location,
      }),
    });
    profileCache = { savedAt: Date.now(), data: updated };
    writeBrowserCache(updated);
    return updated;
  },
};
