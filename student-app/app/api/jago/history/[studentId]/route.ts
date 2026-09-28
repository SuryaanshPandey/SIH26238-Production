import {
  NextRequest,
  NextResponse,
} from "next/server";

const OPERATIONS_API_URL = (
  process.env.NEXT_PUBLIC_RIJVAN_API_URL ||
  "https://sih26238-operations-v25-free.onrender.com/api/v1"
).replace(/\/$/, "");

const UPSTREAM_TIMEOUT_MS = 10_000;

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

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      studentId: string;
    };
  },
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    return errorResponse(
      "Authentication is required to load JAGO history.",
      401,
      "UNAUTHORIZED",
    );
  }

  const studentId =
    String(
      params.studentId ||
        "",
    ).trim();

  if (!studentId) {
    return errorResponse(
      "Student ID is required.",
      400,
      "STUDENT_ID_REQUIRED",
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
        `${OPERATIONS_API_URL}/jago/history/${encodeURIComponent(
          studentId,
        )}`,
        {
          method: "GET",

          headers: {
            Accept:
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

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    const responseText =
      await upstream.text();

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
        "JAGO history request timed out. Please try again.",
        504,
        "JAGO_HISTORY_TIMEOUT",
      );
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "JAGO history could not be loaded.",
      503,
      "JAGO_HISTORY_UNAVAILABLE",
    );
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}
