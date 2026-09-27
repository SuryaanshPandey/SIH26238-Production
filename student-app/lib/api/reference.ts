import { apiFetch } from "./http";
import { RIJVAN_API_URL } from "../config";

export interface ReferenceState { code: string; name: string; }
export interface ReferenceDistrict { code: string; name: string; stateCode: string; }
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

export const referenceApi = {
  states(forceRefresh = false) {
    const suffix = forceRefresh ? "?refresh=true" : "";
    return apiFetch<ReferenceState[]>(`${RIJVAN_API_URL}/reference/states${suffix}`);
  },
  districts(stateCode: string, forceRefresh = false) {
    const query = new URLSearchParams({ stateCode });
    if (forceRefresh) query.set("refresh", "true");
    return apiFetch<ReferenceDistrict[]>(`${RIJVAN_API_URL}/reference/districts?${query.toString()}`);
  },
  institutions(params: { q: string; state?: string; district?: string; limit?: number }, signal?: AbortSignal) {
    const query = new URLSearchParams({ q: params.q, limit: String(params.limit || 8) });
    if (params.state) query.set("state", params.state);
    if (params.district) query.set("district", params.district);
    return apiFetch<InstitutionSuggestion[]>(`${RIJVAN_API_URL}/reference/institutions?${query.toString()}`, { signal });
  },
};
