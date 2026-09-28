export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

function hasRequestBody(
  method: string,
  body: BodyInit | null | undefined,
): boolean {
  if (body == null) {
    return false;
  }

  /*
   * GET and HEAD should never have a body in this client.
   */
  if (
    method === "GET" ||
    method === "HEAD"
  ) {
    return false;
  }

  return true;
}

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  options?: {
    timeoutMs?: number;
  },
): Promise<T> {
  let response: Response;

  const authToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(
          "sih26238.student.access_token",
        )
      : null;

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      options?.timeoutMs ??
        DEFAULT_TIMEOUT_MS,
    );

  const externalSignal =
    init?.signal;

  const onAbort = () =>
    controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        onAbort,
        {
          once: true,
        },
      );
    }
  }

  try {
    const method =
      String(
        init?.method || "GET",
      ).toUpperCase();

    const body =
      init?.body;

    const isFormData =
      typeof FormData !== "undefined" &&
      body instanceof FormData;

    const requestHasBody =
      hasRequestBody(
        method,
        body,
      );

    /*
     * Do NOT set Content-Type on bodyless GET/HEAD requests.
     *
     * Previously this client sent:
     *
     *   Content-Type: application/json
     *
     * even on GET requests. That unnecessarily caused the
     * browser to issue a CORS OPTIONS preflight.
     */
    const contentHeaders =
      requestHasBody &&
      !isFormData
        ? {
            "Content-Type":
              "application/json",
          }
        : {};

    const authHeaders =
      authToken
        ? {
            Authorization:
              `Bearer ${authToken}`,
          }
        : {};

    response =
      await fetch(url, {
        cache: "no-store",

        ...init,

        method,

        signal:
          controller.signal,

        headers: {
          Accept:
            "application/json",

          ...contentHeaders,

          ...authHeaders,

          ...(init?.headers || {}),
        },
      });
  } catch (error) {
    const timedOut =
      controller.signal.aborted &&
      !(
        externalSignal?.aborted
      );

    throw new ApiClientError(
      timedOut
        ? "Request timed out. Please retry."
        : error instanceof Error
          ? error.message
          : "Network request failed",

      0,

      timedOut
        ? "REQUEST_TIMEOUT"
        : "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeoutId);

    externalSignal?.removeEventListener(
      "abort",
      onAbort,
    );
  }

  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    /*
     * Authentication failure.
     */
    if (
      (
        response.status === 401 ||
        response.status === 403
      ) &&
      typeof window !==
        "undefined"
    ) {
      localStorage.removeItem(
        "sih26238.student.access_token",
      );

      localStorage.removeItem(
        "sih26238.student.student_id",
      );

      document.cookie =
        "sih26238_session=; " +
        "Path=/; " +
        "Max-Age=0; " +
        "SameSite=Lax";

      const pathname =
        window.location.pathname;

      const isPublicAuth =
        pathname === "/login" ||
        pathname === "/register";

      const isAuthRequest =
        /\/auth\/student\/(login|register)$/.test(
          url,
        );

      if (
        !isPublicAuth &&
        !isAuthRequest
      ) {
        const next =
          `${window.location.pathname}${window.location.search}`;

        window.location.replace(
          `/login?reason=session_expired&next=${encodeURIComponent(next)}`,
        );
      }
    }

    throw new ApiClientError(
      body?.error?.message ||
        body?.detail?.error?.message ||
        `HTTP ${response.status}`,

      response.status,

      body?.error?.code ||
        body?.detail?.error?.code,
    );
  }

  /*
   * SIH API contract envelope.
   *
   * Expected:
   *
   * {
   *   success: true,
   *   data: ...
   * }
   */
  if (
    body &&
    typeof body === "object" &&
    "success" in body
  ) {
    if (
      !(body as any).success
    ) {
      throw new ApiClientError(
        (body as any).error
          ?.message ||
          "Remote API error",

        response.status,

        (body as any).error
          ?.code,
      );
    }

    return (
      body as any
    ).data as T;
  }

  return body as T;
}
