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
  onStatus?: (message: string) => void;
}

/*
 * Render Free services can sleep after inactivity.
 *
 * The health probe is useful for waking the backend, but it MUST
 * NOT be a hard dependency for authentication.
 *
 * If health fails, we continue to the real login request because
 * that request itself can wake the Render service.
 */

const HEALTH_TIMEOUT_MS = 10_000;

const HEALTH_MAX_WAIT_MS = 30_000;

const HEALTH_RETRY_DELAY_MS = 2_000;

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

/**
 * Check whether Operations is alive.
 *
 * This intentionally uses a plain GET without Authorization,
 * Content-Type, or custom headers so that it does not create
 * an unnecessary browser preflight.
 */
async function checkOperationsHealth(
  signal: AbortSignal,
): Promise<boolean> {
  try {
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

/**
 * Wake the Operations backend.
 *
 * IMPORTANT:
 * Failure here does NOT fail login.
 */
export async function warmOperationsBackend(
  onStatus?: (
    message: string,
  ) => void,
): Promise<boolean> {
  const startedAt =
    Date.now();

  onStatus?.(
    "Starting a secure connection…",
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

    let ready =
      false;

    try {
      ready =
        await checkOperationsHealth(
          controller.signal,
        );
    } finally {
      window.clearTimeout(
        timeoutId,
      );
    }

    if (ready) {
      onStatus?.(
        "Secure services are ready. Verifying your account…",
      );

      return true;
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

    if (
      elapsed <
      8_000
    ) {
      onStatus?.(
        "Waking the secure scholarship service…",
      );
    } else {
      onStatus?.(
        "The service is still waking up. Keeping the connection open…",
      );
    }

    await sleep(
      HEALTH_RETRY_DELAY_MS,
    );
  }

  /*
   * CRITICAL:
   *
   * Do NOT throw here.
   *
   * The actual authentication request is the authoritative
   * availability check and can itself wake a sleeping service.
   */
  onStatus?.(
    "The service is taking a little longer. Trying secure sign-in now…",
  );

  return false;
}

/**
 * Decide whether an error is safe to retry.
 *
 * 401 is deliberately excluded.
 *
 * If the backend returned 401, the request reached the
 * authentication service and the credentials were rejected.
 */
function isTransientLoginError(
  error: unknown,
): boolean {
  if (
    !(error instanceof ApiClientError)
  ) {
    return false;
  }

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

/**
 * Convert infrastructure failures into human-readable
 * messages.
 */
function friendlyTransientMessage(
  error: unknown,
): string {
  if (
    error instanceof ApiClientError
  ) {
    if (
      error.code ===
        "REQUEST_TIMEOUT" ||
      error.status === 504
    ) {
      return (
        "The secure service is taking longer than expected to respond. Please keep this screen open and try again."
      );
    }

    if (
      error.status === 502 ||
      error.status === 503
    ) {
      return (
        "The scholarship service is waking up. Please try sign-in again in a moment."
      );
    }

    if (
      error.code ===
      "NETWORK_ERROR"
    ) {
      return (
        "The secure connection could not be completed. Check your internet connection and try again."
      );
    }
  }

  return (
    "The secure sign-in service is temporarily unavailable. Please try again."
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
     * Try to wake Render first.
     *
     * Even if this fails, we CONTINUE to login.
     */
    await warmOperationsBackend(
      options?.onStatus,
    );

    let lastError:
      | unknown
      | null = null;

    /*
     * Three attempts are enough to handle a Render cold start
     * without making the user wait indefinitely.
     */
    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {
      try {
        options?.onStatus?.(
          attempt === 0
            ? "Verifying your student account…"
            : `Connection restored. Retrying secure sign-in (${attempt + 1}/3)…`,
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
              /*
               * Give Render enough time to wake.
               */
              timeoutMs:
                35_000,
            },
          );

        /*
         * Authentication succeeded.
         */
        saveSession(
          session,
        );

        options?.onStatus?.(
          "Login successful. Opening your scholarship dashboard…",
        );

        /*
         * Small success-state delay so the user actually sees
         * the successful animation before navigation.
         */
        await sleep(
          450,
        );

        return session;
      } catch (
        error
      ) {
        lastError =
          error;

        /*
         * Credential errors such as 401 must immediately reach
         * the UI. Never hide them behind retries.
         */
        if (
          !isTransientLoginError(
            error,
          )
        ) {
          throw error;
        }

        /*
         * No more attempts.
         */
        if (
          attempt >=
          2
        ) {
          break;
        }

        options?.onStatus?.(
          attempt === 0
            ? "The service is still waking up. Retrying securely…"
            : "Reconnecting to the scholarship service…",
        );

        await sleep(
          1_500 +
            attempt *
              1_500,
        );
      }
    }

    throw new ApiClientError(
      friendlyTransientMessage(
        lastError,
      ),
      503,
      "LOGIN_UNAVAILABLE",
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
          timeoutMs:
            35_000,
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
