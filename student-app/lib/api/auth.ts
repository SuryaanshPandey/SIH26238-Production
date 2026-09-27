import { apiFetch } from "./http";
import { clearSession, saveSession } from "../auth/session";
import { LIVE_BACKEND, RIJVAN_API_URL } from "../config";

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  student: any;
}

export const authApi = {
  async login(identifier: string, password: string): Promise<AuthSession> {
    if (!LIVE_BACKEND) throw new Error("Live authentication is required. Start the integrated backend.");
    const session = await apiFetch<AuthSession>(`${RIJVAN_API_URL}/auth/student/login`, {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    saveSession(session);
    return session;
  },

  async register(payload: Record<string, unknown>): Promise<AuthSession> {
    if (!LIVE_BACKEND) throw new Error("Live registration is required. Start the integrated backend.");
    const session = await apiFetch<AuthSession>(`${RIJVAN_API_URL}/auth/student/register`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveSession(session);
    return session;
  },

  logout() {
    clearSession();
    window.location.href = "/login";
  },
};
