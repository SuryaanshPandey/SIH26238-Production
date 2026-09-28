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

const LOGIN_ATTEMPTS = 3;

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

/*
 * Best-effort backend warmup utility.
 *
 * This function is intentionally NOT used as a hard prerequisite
 * for authentication. The real login request is authoritative and
 * can itself wake a sleeping Render service.
 */
export async function warmOperationsBackend(
  onStatus?: (
    message: string,
  ) => void,
): Promise<boolean> {
  onStatus?.(
    "Starting a secure connection…",
  );

  try {
    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(
        () =>
          controller.abort(),
        5_000,
      );

    try {
      const response =
        await fetch(
          `${RIJVAN_API_URL}/health`,
          {
            method: "GET",
            cache: "no-store",
            signal:
              controller.signal,
          },
        );

      if (
        response.ok
      ) {
        onStatus?.(
          "Secure services are responding…",
        );

        return true;
      }
    } finally {
      window.clearTimeout(
        timeoutId,
      );
    }
  } catch {
    /*
     * Deliberately ignored.
     *
     * Health is advisory only. Authentication continues.
     */
  }

  onStatus?.(
    "Connecting to the scholarship service…",
  );

  return false;
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
   * 401/403 are deliberately excluded.
   *
   * They mean the request reached the backend and was rejected.
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

function getFailureMessage(
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
        "The scholarship service is taking longer than expected to respond. Please try again."
      );
    }

    if (
      error.status === 502 ||
      error.status === 503
    ) {
      return (
        "The scholarship service is waking up. Please try again in a moment."
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
    error instanceof Error
      ? error.message
      : "Unable to sign in right now. Please try again."
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

    const normalizedIdentifier =
      identifier.trim();

    if (
      !normalizedIdentifier
    ) {
      throw new ApiClientError(
        "Enter your mobile number, Student ID, or email.",
        400,
        "IDENTIFIER_REQUIRED",
      );
    }

    if (
      password.length <
      8
    ) {
      throw new ApiClientError(
        "Password must be at least 8 characters long.",
        400,
        "PASSWORD_REQUIRED",
      );
    }

    /*
     * DO NOT wait for health here.
     *
     * The actual POST is the real availability check and can wake
     * a sleeping Render service.
     */
    options?.onStatus?.(
      "Connecting to the secure scholarship service…",
    );

    let lastError:
      | unknown
      | null = null;

    for (
      let attempt = 0;
      attempt < LOGIN_ATTEMPTS;
      attempt++
    ) {
      try {
        if (
          attempt === 0
        ) {
          options?.onStatus?.(
            "Verifying your student account…",
          );
        } else if (
          attempt === 1
        ) {
          options?.onStatus?.(
            "The service is waking up. Reconnecting securely…",
          );
        } else {
          options?.onStatus?.(
            "Connection restored. Completing sign-in…",
          );
        }

        const session =
          await apiFetch<AuthSession>(
            `${RIJVAN_API_URL}/auth/student/login`,
            {
              method: "POST",
              body: JSON.stringify({
                identifier:
                  normalizedIdentifier,
                password,
              }),
            },
            {
              timeoutMs:
                35_000,
            },
          );

        saveSession(
          session,
        );

        options?.onStatus?.(
          "Login successful. Opening your scholarship dashboard…",
        );

        await sleep(
          600,
        );

        return session;
      } catch (
        error
      ) {
        lastError =
          error;

        /*
         * Credential/API validation errors immediately reach the UI.
         */
        if (
          !isTransientLoginError(
            error,
          )
        ) {
          throw error;
        }

        if (
          attempt ===
          LOGIN_ATTEMPTS - 1
        ) {
          break;
        }

        await sleep(
          attempt === 0
            ? 1_500
            : 3_000,
        );
      }
    }

    throw new ApiClientError(
      getFailureMessage(
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

    try {
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
    } catch (
      error
    ) {
      throw new ApiClientError(
        getFailureMessage(
          error,
        ),
        error instanceof ApiClientError
          ? error.status
          : 0,
        error instanceof ApiClientError
          ? error.code
          : "REGISTRATION_FAILED",
      );
    }
  },

  logout() {
    clearSession();

    window.location.href =
      "/login";
  },
};
