export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

interface ApiErrorEnvelope {
  error?: { message?: string };
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
  if (!response.ok) throw new ApiRequestError(response.status, body?.error?.message ?? fallback);
  return body as T;
}
