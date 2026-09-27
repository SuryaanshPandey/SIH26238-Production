export class IntegrationHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "IntegrationHttpError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new IntegrationHttpError(
      error instanceof Error ? error.message : "Integration request failed",
      0,
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || body?.detail?.error?.message || body?.message || `HTTP ${response.status}`;
    throw new IntegrationHttpError(message, response.status, body?.error?.code || body?.detail?.error?.code);
  }

  // Both modules use the v1 envelope. Accept a raw object only for non-envelope future adapters.
  if (body && typeof body === "object" && "success" in body) {
    if (!(body as any).success) {
      throw new IntegrationHttpError((body as any).error?.message || "Remote API returned an error", response.status, (body as any).error?.code);
    }
    return (body as any).data as T;
  }
  return body as T;
}
