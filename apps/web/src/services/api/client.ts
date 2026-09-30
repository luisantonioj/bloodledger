interface ApiErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
}

export async function requestJson<T>(path: string, init: RequestInit = {}, fallback = "Request failed."): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as ApiErrorEnvelope | null;
  if (!response.ok) throw new ApiRequestError(body?.error?.message ?? fallback, response.status, body?.error?.code);
  return body as T;
}
