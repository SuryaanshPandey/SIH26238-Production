import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";
import {
  JagoMessage,
  JagoClientAction,
} from "../contracts/types";

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

function createWelcomeMessage(
  language: "en" | "hi" = "en",
): JagoMessage {
  if (language === "hi") {
    return {
      id: "jago-welcome",
      sender: "JAGO",
      text:
        "नमस्ते! मैं JAGO हूँ। ऐप के अंदर कुछ ढूँढना, खोलना, समझना या करना हो तो बस बोलिए।",
      timestamp: new Date().toISOString(),
      suggested_followups: [
        "मेरी सभी अर्जी दिखाओ",
        "आय प्रमाणपत्र अपलोड करना है",
        "मेरी पेमेंट ट्रैक करो",
      ],
    };
  }

  return {
    id: "jago-welcome",
    sender: "JAGO",
    text:
      "Namaste! I’m JAGO. Tell me what you want to find, open, understand, or do inside this scholarship app.",
    timestamp: new Date().toISOString(),
    suggested_followups: [
      "Show all my applications",
      "I want to upload my income certificate",
      "Track my scholarship payment",
    ],
  };
}

function getStoredLanguage(): "en" | "hi" {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    return window.localStorage.getItem("mota_lang") === "hi"
      ? "hi"
      : "en";
  } catch {
    return "en";
  }
}

function mapBackendResponse(
  payload: JagoBackendResponse,
): JagoMessage {
  const actions =
    payload.suggested_actions || [];

  return {
    id: payload.assistance_id,
    sender: "JAGO",
    text: payload.response,
    timestamp: payload.generated_at,
    intent: payload.intent,
    application_id: payload.application_id,
    actions,
    suggested_actions: actions.map(
      (action) => ({
        label: action.label,
        href: action.href,
      }),
    ),
    suggested_followups:
      payload.suggested_followups || [],
    sources_cited:
      payload.source_refs.length > 0
        ? payload.source_refs.map(
            (ref) => ({
              title: ref,
            }),
          )
        : [],
  };
}

function currentApplicationId():
  string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const match =
    window.location.pathname.match(
      /^\/applications\/([^/]+)$/,
    );

  if (!match) {
    return undefined;
  }

  return decodeURIComponent(
    match[1],
  );
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "JAGO is temporarily unavailable. Please try again.";
}

export const jagoApi = {
  async getMessages(): Promise<
    JagoMessage[]
  > {
    const studentId =
      getCurrentStudentId();

    if (!studentId) {
      return [
        createWelcomeMessage(
          getStoredLanguage(),
        ),
      ];
    }

    try {
      /*
       * Use the Student App same-origin proxy instead of calling the
       * Operations Render service directly from the browser/WebView.
       */
      const history =
        await apiFetch<
          JagoBackendResponse[]
        >(
          `/api/jago/history/${encodeURIComponent(
            studentId,
          )}`,
          {},
          {
            timeoutMs: 10_000,
          },
        );

      if (
        !Array.isArray(history) ||
        history.length === 0
      ) {
        return [
          createWelcomeMessage(
            getStoredLanguage(),
          ),
        ];
      }

      return history.flatMap(
        (entry) => [
          {
            id: `${entry.assistance_id}-student`,
            sender:
              "STUDENT" as const,
            text: entry.query,
            timestamp:
              entry.generated_at,
          },

          mapBackendResponse(
            entry,
          ),
        ],
      );
    } catch {
      /*
       * History is optional.
       * JAGO must still open and accept a new request when history
       * is unavailable.
       */
      return [
        createWelcomeMessage(
          getStoredLanguage(),
        ),
      ];
    }
  },

  async askQuestion(
    query: string,
    language?: "en" | "hi",
    applicationId?: string,
  ): Promise<JagoMessage> {
    const cleanQuery =
      query.trim();

    if (!cleanQuery) {
      throw new Error(
        "Please enter a question for JAGO.",
      );
    }

    const preferredLanguage =
      language ||
      getStoredLanguage();

    const effectiveLanguage =
      /[\u0900-\u097F]/.test(
        cleanQuery,
      )
        ? "hi"
        : preferredLanguage;

    const studentId =
      getCurrentStudentId();

    if (!studentId) {
      throw new Error(
        "Please sign in before using JAGO.",
      );
    }

    try {
      /*
       * Same-origin request:
       *
       * Browser/WebView
       *      ↓
       * Student App /api/jago/query
       *      ↓
       * Operations /api/v1/jago/query
       *
       * The Student App proxy forwards the student's Bearer token.
       */
      const response =
        await apiFetch<
          JagoBackendResponse
        >(
          "/api/jago/query",
          {
            method: "POST",

            body: JSON.stringify({
              studentId,
              applicationId:
                applicationId ||
                currentApplicationId(),
              query: cleanQuery,
              language:
                effectiveLanguage,
            }),
          },
          {
            timeoutMs: 35_000,
          },
        );

      return mapBackendResponse(
        response,
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(error),
      );
    }
  },
};
