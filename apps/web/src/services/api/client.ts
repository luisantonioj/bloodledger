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
  if (!response.ok) throw new Error(body?.error?.message ?? fallback);
  return body as T;
}
