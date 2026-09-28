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

  if (
    method === "GET" ||
    method === "HEAD"
  ) {
    return false;
  }

  return true;
}

function buildRequestHeaders(
  init?: RequestInit,
  authToken?: string | null,
): Headers {
  const headers = new Headers(
    init?.headers,
  );

  /*
   * Always request JSON responses.
   */
  headers.set(
    "Accept",
    "application/json",
  );

  const method = String(
    init?.method || "GET",
  ).toUpperCase();

  const body = init?.body;

  const isFormData =
    typeof FormData !== "undefined" &&
    body instanceof FormData;

  const requestHasBody =
    hasRequestBody(
      method,
      body,
    );

  /*
   * Only set application/json when the request actually
   * has a non-FormData body.
   *
   * This prevents unnecessary CORS preflights on GET requests.
   */
  if (
    requestHasBody &&
    !isFormData &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  /*
   * Attach the current authenticated student token.
   */
  if (
    authToken &&
    !headers.has("Authorization")
  ) {
    headers.set(
      "Authorization",
      `Bearer ${authToken}`,
    );
  }

  return headers;
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
      () => controller.abort(),
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

    const headers =
      buildRequestHeaders(
        init,
        authToken,
      );

    response =
      await fetch(url, {
        ...init,

        method,

        headers,

        /*
         * Keep API responses fresh.
         */
        cache: "no-store",

        /*
         * Always use our composed abort signal.
         */
        signal:
          controller.signal,
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

  /*
   * Most SIH endpoints return JSON envelopes.
   *
   * Some infrastructure responses may return an empty body,
   * so JSON parsing is intentionally defensive.
   */
  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    /*
     * Authentication failure.
     *
     * Do not redirect from public login/register requests.
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
   * SIH contract envelope:
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
