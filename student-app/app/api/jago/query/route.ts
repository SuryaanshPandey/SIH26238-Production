import {
  NextRequest,
  NextResponse,
} from "next/server";

const OPERATIONS_API_URL = (
  process.env.NEXT_PUBLIC_RIJVAN_API_URL ||
  "https://sih26238-operations-v25-free.onrender.com/api/v1"
).replace(/\/$/, "");

const UPSTREAM_TIMEOUT_MS = 35_000;

function errorResponse(
  message: string,
  status: number,
  code: string,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  /*
   * Never allow an unauthenticated client to use the proxy.
   *
   * apiFetch normally supplies the student's Bearer token automatically.
   */
  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    return errorResponse(
      "Authentication is required for JAGO.",
      401,
      "UNAUTHORIZED",
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "Invalid JAGO request payload.",
      400,
      "INVALID_REQUEST",
    );
  }

  if (
    !body ||
    typeof body !==
      "object"
  ) {
    return errorResponse(
      "Invalid JAGO request payload.",
      400,
      "INVALID_REQUEST",
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, UPSTREAM_TIMEOUT_MS);

  try {
    const upstream =
      await fetch(
        `${OPERATIONS_API_URL}/jago/query`,
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Authorization:
              authorization,

            ...(request.headers.get(
              "x-request-id",
            )
              ? {
                  "X-Request-ID":
                    request.headers.get(
                      "x-request-id",
                    ) as string,
                }
              : {}),

            "X-Contract-Version":
              "v1",
          },

          body: JSON.stringify(body),

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    const responseText =
      await upstream.text();

    /*
     * Preserve the Operations response body and HTTP status.
     *
     * This allows the Student App's existing apiFetch error handling to
     * interpret authentication, validation, and server errors normally.
     */
    const responseHeaders =
      new Headers();

    responseHeaders.set(
      "Content-Type",
      upstream.headers.get(
        "content-type",
      ) ||
        "application/json",
    );

    responseHeaders.set(
      "Cache-Control",
      "no-store",
    );

    const requestId =
      upstream.headers.get(
        "x-request-id",
      );

    if (requestId) {
      responseHeaders.set(
        "X-Request-ID",
        requestId,
      );
    }

    return new NextResponse(
      responseText,
      {
        status:
          upstream.status,

        headers:
          responseHeaders,
      },
    );
  } catch (
    error
  ) {
    if (
      controller.signal.aborted
    ) {
      return errorResponse(
        "JAGO service timed out while contacting the scholarship backend. Please try again.",
        504,
        "JAGO_UPSTREAM_TIMEOUT",
      );
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "JAGO could not reach the scholarship backend.",
      503,
      "JAGO_UPSTREAM_UNAVAILABLE",
    );
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}
