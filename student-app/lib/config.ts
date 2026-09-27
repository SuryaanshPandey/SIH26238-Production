const RUNTIME_RIJVAN_KEY = "sih26238.runtime.rijvan_api_url";
const RUNTIME_VERIFICATION_KEY = "sih26238.runtime.verification_api_url";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function resolveBrowserOverride(queryKey: string, storageKey: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const queryValue = new URLSearchParams(window.location.search).get(queryKey);
    if (queryValue?.trim()) {
      const normalized = normalizeBaseUrl(queryValue);
      window.localStorage.setItem(storageKey, normalized);
      return normalized;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (stored?.trim()) return normalizeBaseUrl(stored);
  } catch {
    // Mobile runtime configuration is optional; environment values remain the fallback.
  }

  return null;
}

export const LIVE_BACKEND = (process.env.NEXT_PUBLIC_USE_LIVE_BACKEND ?? "true") === "true";

const DEFAULT_RIJVAN_API_URL =
  (process.env.NEXT_PUBLIC_RIJVAN_API_URL || "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");
const DEFAULT_VERIFICATION_API_URL =
  (process.env.NEXT_PUBLIC_VERIFICATION_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export const RIJVAN_API_URL =
  resolveBrowserOverride("sihMobileOps", RUNTIME_RIJVAN_KEY) || DEFAULT_RIJVAN_API_URL;

export const VERIFICATION_API_URL =
  resolveBrowserOverride("sihMobileVerification", RUNTIME_VERIFICATION_KEY) || DEFAULT_VERIFICATION_API_URL;
