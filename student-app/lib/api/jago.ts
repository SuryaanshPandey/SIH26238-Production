import { RIJVAN_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";
import { JagoMessage, JagoClientAction } from "../contracts/types";

interface JagoBackendResponse {
  assistance_id: string;
  student_id: string;
  application_id: string | null;
  query: string;
  intent: JagoMessage["intent"];
  response: string;
  language: "en" | "hi";
  source_refs: string[];
  generated_at: string;
  suggested_actions?: JagoClientAction[];
  suggested_followups?: string[];
}

function createWelcomeMessage(language: "en" | "hi" = "en"): JagoMessage {
  return {
    id: "jago-welcome",
    sender: "JAGO",
    text:
      language === "hi"
        ? "नमस्ते! मैं JAGO हूँ। ऐप के अंदर कुछ ढूँढना, खोलना, आवेदन/भुगतान समझना या दस्तावेज़ अपलोड शुरू करना हो तो बस बोलिए।"
        : "Namaste! I’m JAGO. Tell me what you want to find, open, understand, or do inside this scholarship app.",
    timestamp: new Date().toISOString(),
    suggested_followups: [
      language === "hi" ? "मेरी सभी अर्जी दिखाओ" : "Show all my applications",
      language === "hi" ? "आय प्रमाणपत्र अपलोड करना है" : "I want to upload my income certificate",
      language === "hi" ? "मेरी पेमेंट ट्रैक करो" : "Track my scholarship payment",
    ],
  };
}

function getStoredLanguage(): "en" | "hi" {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("mota_lang") === "hi" ? "hi" : "en";
}

function mapBackendResponse(payload: JagoBackendResponse): JagoMessage {
  const actions = payload.suggested_actions || [];
  return {
    id: payload.assistance_id,
    sender: "JAGO",
    text: payload.response,
    timestamp: payload.generated_at,
    intent: payload.intent,
    application_id: payload.application_id,
    actions,
    suggested_actions: actions.map((action) => ({ label: action.label, href: action.href })),
    suggested_followups: payload.suggested_followups || [],
    sources_cited: payload.source_refs.length
      ? payload.source_refs.map((ref) => ({ title: ref }))
      : [],
  };
}

function currentApplicationId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const match = window.location.pathname.match(/^\/applications\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export const jagoApi = {
  async getMessages(): Promise<JagoMessage[]> {
    const studentId = getCurrentStudentId();
    if (!studentId) return [createWelcomeMessage(getStoredLanguage())];

    try {
      const history = await apiFetch<JagoBackendResponse[]>(
        `${RIJVAN_API_URL}/jago/history/${encodeURIComponent(studentId)}`,
        { timeoutMs: 3000 },
      );
      if (!history.length) return [createWelcomeMessage(getStoredLanguage())];
      return history.flatMap((entry) => [
        {
          id: `${entry.assistance_id}-student`,
          sender: "STUDENT" as const,
          text: entry.query,
          timestamp: entry.generated_at,
        },
        mapBackendResponse(entry),
      ]);
    } catch {
      // History is optional. A current-session chat must still work when the history endpoint is unavailable.
      return [createWelcomeMessage(getStoredLanguage())];
    }
  },

  async askQuestion(query: string, language?: "en" | "hi", applicationId?: string): Promise<JagoMessage> {
    const preferredLanguage = language || getStoredLanguage();
    const effectiveLanguage = /[\u0900-\u097F]/.test(query) ? "hi" : preferredLanguage;
    const response = await apiFetch<JagoBackendResponse>(`${RIJVAN_API_URL}/jago/query`, {
      method: "POST",
      body: JSON.stringify({
        studentId: getCurrentStudentId() || "",
        applicationId: applicationId || currentApplicationId(),
        query,
        language: effectiveLanguage,
      }),
    }, { timeoutMs: 30000 });
    return mapBackendResponse(response);
  },
};
