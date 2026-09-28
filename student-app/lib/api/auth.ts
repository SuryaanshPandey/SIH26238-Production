import {
  ApiClientError,
  apiFetch,
} from "./http";
import {
  clearSession,
  saveSession,
} from "../auth/session";
import {
  LIVE_BACKEND,
  RIJVAN_API_URL,
} from "../config";

export interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  student: any;
}

export interface LoginOptions {
  onStatus?: (
    message: string,
  ) => void;
}

/*
 * Render Free services can sleep after inactivity.
 *
 * The current documented Render behavior is that a sleeping
 * Free web service starts again when it receives a request,
 * with startup taking roughly a minute.
 *
 * We therefore explicitly warm the Operations service before
 * attempting authentication.
 */
const HEALTH_TIMEOUT_MS =
  10_000;

const HEALTH_MAX_WAIT_MS =
  85_000;

const HEALTH_RETRY_DELAY_MS =
  2_500;

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function checkOperationsHealth(
  signal: AbortSignal,
): Promise<boolean> {
  try {
    /*
     * Raw fetch intentionally avoids Authorization and
     * Content-Type headers.
     *
     * That keeps this probe a simple CORS GET and avoids
     * creating an unnecessary preflight request.
     */
    const response =
      await fetch(
        `${RIJVAN_API_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
          signal,
        },
      );

    if (!response.ok) {
      return false;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) || "";

    /*
     * Render's sleeping/loading response may not be
     * our JSON health response.
     */
    if (
      !contentType
        .toLowerCase()
        .includes(
          "application/json",
        )
    ) {
      return false;
    }

    const body =
      await response
        .json()
        .catch(() => null);

    return (
      body?.success === true &&
      body?.data?.status === "ok"
    );
  } catch {
    return false;
  }
}

export async function warmOperationsBackend(
  onStatus?: (
    message: string,
  ) => void,
): Promise<void> {
  const startedAt =
    Date.now();

  onStatus?.(
    "Connecting to secure services…",
  );

  while (
    Date.now() -
      startedAt <
    HEALTH_MAX_WAIT_MS
  ) {
    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(
        () =>
          controller.abort(),
        HEALTH_TIMEOUT_MS,
      );

    try {
      const ready =
        await checkOperationsHealth(
          controller.signal,
        );

      if (ready) {
        onStatus?.(
          "Secure services are ready. Checking your account…",
        );

        return;
      }
    } finally {
      window.clearTimeout(
        timeoutId,
      );
    }

    const elapsed =
      Date.now() -
      startedAt;

    if (
      elapsed >=
      HEALTH_MAX_WAIT_MS
    ) {
      break;
    }

    onStatus?.(
      "The secure backend is starting. Please wait…",
    );

    await sleep(
      HEALTH_RETRY_DELAY_MS,
    );
  }

  throw new ApiClientError(
    "Secure services are taking longer than expected. Please try again in a moment.",
    503,
    "BACKEND_WARMUP_TIMEOUT",
  );
}

function isTransientLoginError(
  error: unknown,
): boolean {
  if (
    !(error instanceof ApiClientError)
  ) {
    return false;
  }

  /*
   * Do NOT retry 401.
   *
   * 401 means the backend reached the login
   * service and rejected the credentials.
   */
  return (
    error.status === 0 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504 ||
    error.code ===
      "REQUEST_TIMEOUT" ||
    error.code ===
      "NETWORK_ERROR"
  );
}

export const authApi = {
  async login(
    identifier: string,
    password: string,
    options?: LoginOptions,
  ): Promise<AuthSession> {
    if (!LIVE_BACKEND) {
      throw new Error(
        "Live authentication is required. Start the integrated backend.",
      );
    }

    /*
     * Wake Render before sending the actual login request.
     */
    await warmOperationsBackend(
      options?.onStatus,
    );

    let lastError:
      | unknown
      | null = null;

    /*
     * A transient failure after warmup can still happen during
     * the exact moment Render transitions from sleeping to live.
     *
     * Retry only transient failures.
     */
    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {
      try {
        options?.onStatus?.(
          attempt === 0
            ? "Signing you in…"
            : "Connection restored. Retrying sign-in…",
        );

        const session =
          await apiFetch<AuthSession>(
            `${RIJVAN_API_URL}/auth/student/login`,
            {
              method: "POST",
              body: JSON.stringify({
                identifier,
                password,
              }),
            },
            {
              timeoutMs: 25_000,
            },
          );

        saveSession(
          session,
        );

        options?.onStatus?.(
          "Login successful.",
        );

        return session;
      } catch (error) {
        lastError = error;

        if (
          !isTransientLoginError(
            error,
          )
        ) {
          throw error;
        }

        if (
          attempt >= 2
        ) {
          break;
        }

        await sleep(
          1_500 +
            attempt *
              1_500,
        );
      }
    }

    throw (
      lastError ||
      new ApiClientError(
        "Login failed. Please try again.",
        503,
        "LOGIN_UNAVAILABLE",
      )
    );
  },

  async register(
    payload: Record<
      string,
      unknown
    >,
  ): Promise<AuthSession> {
    if (!LIVE_BACKEND) {
      throw new Error(
        "Live registration is required. Start the integrated backend.",
      );
    }

    /*
     * Registration gets the same warm-up protection.
     */
    await warmOperationsBackend();

    const session =
      await apiFetch<AuthSession>(
        `${RIJVAN_API_URL}/auth/student/register`,
        {
          method: "POST",
          body: JSON.stringify(
            payload,
          ),
        },
        {
          timeoutMs: 25_000,
        },
      );

    saveSession(
      session,
    );

    return session;
  },

  logout() {
    clearSession();

    window.location.href =
      "/login";
  },
};
