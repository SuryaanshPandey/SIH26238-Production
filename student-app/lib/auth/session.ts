import type { StudentProfile } from "../contracts/types";

const TOKEN_KEY = "sih26238.student.access_token";
const STUDENT_ID_KEY = "sih26238.student.student_id";
const PROFILE_CACHE_KEY = "sih26238.student.profile";

type SessionStudent = StudentProfile & { student_id: string };

export function saveSession(session: { access_token: string; student: SessionStudent }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(STUDENT_ID_KEY, session.student.student_id);
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: session.student }));
  } catch {
    // Optional performance cache.
  }
  document.cookie = `sih26238_session=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Max-Age=28800`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentStudentId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STUDENT_ID_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  const studentId = localStorage.getItem(STUDENT_ID_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STUDENT_ID_KEY);
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
    if (studentId) sessionStorage.removeItem(`sih26238.applications.${studentId}`);
    if (studentId) sessionStorage.removeItem(`sih26238.documents.${studentId}`);
  } catch {
    // Ignore optional cache cleanup failures.
  }
  document.cookie = "sih26238_session=; Path=/; Max-Age=0; SameSite=Lax";
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
