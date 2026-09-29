export type ApiErrorKind =
  | "AUTH"
  | "BACKEND_UNAVAILABLE"
  | "SERVER_ERROR"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "CLIENT_ERROR"
  | "UNKNOWN";

export interface ApiErrorPresentation {
  kind: ApiErrorKind;
  title: string;
  message: string;
  retryable: boolean;
  actionLabel?: string;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly kind: ApiErrorKind;
  public readonly retryable: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    kind: ApiErrorKind = "UNKNOWN",
    retryable = false,
  ) {
    super(message);

    this.name =
      "ApiClientError";

    this.status =
      status;

    this.code =
      code;

    this.kind =
      kind;

    this.retryable =
      retryable;
  }
}

const DEFAULT_TIMEOUT_MS =
  15_000;

function hasRequestBody(
  method: string,
  body:
    | BodyInit
    | null
    | undefined,
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
  const headers =
    new Headers(
      init?.headers,
    );

  headers.set(
    "Accept",
    "application/json",
  );

  const method =
    String(
      init?.method ||
        "GET",
    ).toUpperCase();

  const body =
    init?.body;

  const isFormData =
    typeof FormData !==
      "undefined" &&
    body instanceof
      FormData;

  const requestHasBody =
    hasRequestBody(
      method,
      body,
    );

  if (
    requestHasBody &&
    !isFormData &&
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (
    authToken &&
    !headers.has(
      "Authorization",
    )
  ) {
    headers.set(
      "Authorization",
      `Bearer ${authToken}`,
    );
  }

  return headers;
}

function getErrorKindForStatus(
  status: number,
): ApiErrorKind {
  if (
    status === 401 ||
    status === 403
  ) {
    return "AUTH";
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return "BACKEND_UNAVAILABLE";
  }

  if (
    status === 429 ||
    status === 408
  ) {
    return "RATE_LIMITED";
  }

  if (
    status >= 500
  ) {
    return "SERVER_ERROR";
  }

  if (
    status >= 400
  ) {
    return "CLIENT_ERROR";
  }

  return "UNKNOWN";
}

function getRetryableForStatus(
  status: number,
): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function extractEnvelopeError(
  body: any,
): {
  message?: string;
  code?: string;
} {
  if (
    !body ||
    typeof body !==
      "object"
  ) {
    return {};
  }

  const direct =
    body.error;

  if (
    direct &&
    typeof direct ===
      "object"
  ) {
    return {
      message:
        typeof direct.message ===
        "string"
          ? direct.message
          : undefined,

      code:
        typeof direct.code ===
        "string"
          ? direct.code
          : undefined,
    };
  }

  if (
    body.detail &&
    typeof body.detail ===
      "object"
  ) {
    const detail =
      body.detail;

    const nested =
      detail.error;

    if (
      nested &&
      typeof nested ===
        "object"
    ) {
      return {
        message:
          typeof nested.message ===
          "string"
            ? nested.message
            : undefined,

        code:
          typeof nested.code ===
          "string"
            ? nested.code
            : undefined,
      };
    }

    return {
      message:
        typeof detail.message ===
        "string"
          ? detail.message
          : undefined,

      code:
        typeof detail.code ===
        "string"
          ? detail.code
          : undefined,
    };
  }

  return {};
}

function sanitizeServerMessage(
  message: string,
): string {
  const normalized =
    message.trim();

  if (!normalized) {
    return "";
  }

  /*
   * Never expose raw browser networking text such as:
   * "Failed to fetch"
   */
  if (
    /failed to fetch/i.test(
      normalized,
    )
  ) {
    return "";
  }

  /*
   * Do not expose raw HTML gateway pages to the user.
   */
  if (
    /<!doctype html|<html/i.test(
      normalized,
    )
  ) {
    return "";
  }

  return normalized;
}

export function getApiErrorPresentation(
  error: unknown,
): ApiErrorPresentation {
  if (
    error instanceof ApiClientError
  ) {
    switch (
      error.kind
    ) {
      case "AUTH":
        return {
          kind: "AUTH",
          title:
            "Your session has expired",
          message:
            "Please sign in again to continue using this part of the scholarship app.",
          retryable: false,
          actionLabel:
            "Sign in again",
        };

      case "BACKEND_UNAVAILABLE":
        return {
          kind:
            "BACKEND_UNAVAILABLE",
          title:
            "Scholarship service unavailable",
          message:
            "The scholarship backend is temporarily unavailable. Your account data is not affected. Please try again in a moment.",
          retryable: true,
          actionLabel:
            "Retry",
        };

      case "SERVER_ERROR":
        return {
          kind:
            "SERVER_ERROR",
          title:
            "Scholarship service error",
          message:
            sanitizeServerMessage(
              error.message,
            ) ||
            "The scholarship backend encountered an internal error while processing this request. Please try again.",
          retryable: true,
          actionLabel:
            "Retry",
        };

      case "TIMEOUT":
        return {
          kind: "TIMEOUT",
          title:
            "Scholarship service is taking too long",
          message:
            "The backend did not respond within the expected time. Your request was not confirmed as completed. Please try again.",
          retryable: true,
          actionLabel:
            "Retry",
        };

      case "NETWORK":
        return {
          kind: "NETWORK",
          title:
            "Connection problem",
          message:
            "The app could not reach the scholarship service. Check your internet connection and try again.",
          retryable: true,
          actionLabel:
            "Retry",
        };

      case "RATE_LIMITED":
        return {
          kind:
            "RATE_LIMITED",
          title:
            "Please wait a moment",
          message:
            "The scholarship service is temporarily limiting requests. Please try again shortly.",
          retryable: true,
          actionLabel:
            "Retry",
        };

      case "CLIENT_ERROR":
        return {
          kind:
            "CLIENT_ERROR",
          title:
            "Request could not be completed",
          message:
            sanitizeServerMessage(
              error.message,
            ) ||
            "The request could not be accepted by the scholarship service. Please check the information and try again.",
          retryable: false,
        };

      default:
        return {
          kind: "UNKNOWN",
          title:
            "Something went wrong",
          message:
            sanitizeServerMessage(
              error.message,
            ) ||
            "The scholarship service returned an unexpected response. Please try again.",
          retryable: true,
          actionLabel:
            "Retry",
        };
    }
  }

  if (
    error instanceof
    DOMException &&
    error.name ===
      "AbortError"
  ) {
    return {
      kind: "TIMEOUT",
      title:
        "Request timed out",
      message:
        "The scholarship service did not respond in time. Please try again.",
      retryable: true,
      actionLabel:
        "Retry",
    };
  }

  if (
    error instanceof Error
  ) {
    if (
      /failed to fetch/i.test(
        error.message,
      ) ||
      /network/i.test(
        error.message,
      )
    ) {
      return {
        kind: "NETWORK",
        title:
          "Connection problem",
        message:
          "The app could not reach the scholarship service. Check your internet connection and try again.",
        retryable: true,
        actionLabel:
          "Retry",
      };
    }

    if (
      /timeout/i.test(
        error.message,
      )
    ) {
      return {
        kind: "TIMEOUT",
        title:
          "Request timed out",
        message:
          "The scholarship service took too long to respond. Please try again.",
        retryable: true,
        actionLabel:
          "Retry",
      };
    }

    return {
      kind: "UNKNOWN",
      title:
        "Something went wrong",
      message:
        error.message ||
        "The request could not be completed.",
      retryable: true,
      actionLabel:
        "Retry",
    };
  }

  return {
    kind: "UNKNOWN",
    title:
      "Something went wrong",
    message:
      "The request could not be completed. Please try again.",
    retryable: true,
    actionLabel:
      "Retry",
  };
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
    typeof window !==
      "undefined"
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

  const onAbort =
    () =>
      controller.abort();

  if (
    externalSignal
  ) {
    if (
      externalSignal.aborted
    ) {
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
        init?.method ||
          "GET",
      ).toUpperCase();

    const headers =
      buildRequestHeaders(
        init,
        authToken,
      );

    response =
      await fetch(
        url,
        {
          ...init,
          method,
          headers,
          cache:
            "no-store",
          signal:
            controller.signal,
        },
      );
  } catch (
    error
  ) {
    const timedOut =
      controller.signal
        .aborted &&
      !externalSignal?.aborted;

    throw new ApiClientError(
      timedOut
        ? "The scholarship service did not respond in time."
        : "The scholarship service could not be reached.",
      0,
      timedOut
        ? "REQUEST_TIMEOUT"
        : "NETWORK_ERROR",
      timedOut
        ? "TIMEOUT"
        : "NETWORK",
      true,
    );
  } finally {
    clearTimeout(
      timeoutId,
    );

    externalSignal?.removeEventListener(
      "abort",
      onAbort,
    );
  }

  const rawBody =
    await response.text();

  let body: any = null;

  if (
    rawBody.trim()
  ) {
    try {
      body =
        JSON.parse(
          rawBody,
        );
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const extracted =
      extractEnvelopeError(
        body,
      );

    const kind =
      getErrorKindForStatus(
        response.status,
      );

    if (
      (
        response.status ===
          401 ||
        response.status ===
          403
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
          `${pathname}${window.location.search}`;

        window.location.replace(
          `/login?reason=session_expired&next=${encodeURIComponent(next)}`,
        );
      }
    }

    let message =
      extracted.message ||
      `HTTP ${response.status}`;

    if (
      kind ===
      "BACKEND_UNAVAILABLE"
    ) {
      message =
        "The scholarship backend is temporarily unavailable.";
    }

    if (
      kind ===
      "SERVER_ERROR"
    ) {
      message =
        extracted.message ||
        "The scholarship backend encountered an internal error.";
    }

    throw new ApiClientError(
      message,
      response.status,
      extracted.code,
      kind,
      getRetryableForStatus(
        response.status,
      ),
    );
  }

  if (
    body &&
    typeof body ===
      "object" &&
    "success" in body
  ) {
    if (
      !body.success
    ) {
      const extracted =
        extractEnvelopeError(
          body,
        );

      throw new ApiClientError(
        extracted.message ||
          "The remote API returned an error.",
        response.status,
        extracted.code,
        getErrorKindForStatus(
          response.status,
        ),
        getRetryableForStatus(
          response.status,
        ),
      );
    }

    return body.data as T;
  }

  return body as T;
}
