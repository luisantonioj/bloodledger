import type { ConfirmedCapture, LocalScanEvent } from "./types";

interface ApiErrorBody {
  error?: { code?: string };
}

export type RemoteScanState = Pick<LocalScanEvent, "eventId" | "correlationId" | "status"> & {
  safeErrorCode?: string;
};

export class ApiError extends Error {
  public constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

async function safeJson(response: Response): Promise<ApiErrorBody> {
  try {
    return await response.json() as ApiErrorBody;
  } catch {
    return {};
  }
}

export async function createSession(operatorId: string, credential: string): Promise<string> {
  const response = await fetch("/api/v1/simulation/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operatorId, credential }),
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body.error?.code ?? "AUTH_FAILED", response.status);
  }
  return ((await response.json()) as { token: string }).token;
}

export async function submitCapture(
  token: string,
  idempotencyKey: string,
  capture: ConfirmedCapture,
): Promise<RemoteScanState> {
  const response = await fetch("/api/v1/scan-events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(capture),
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body.error?.code ?? "SCAN_SUBMISSION_FAILED", response.status);
  }
  return await response.json() as RemoteScanState;
}

export async function fetchScanStatus(
  token: string,
  eventId: string,
): Promise<RemoteScanState> {
  const response = await fetch(`/api/v1/scan-events/${encodeURIComponent(eventId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(body.error?.code ?? "SCAN_STATUS_FAILED", response.status);
  }
  return await response.json() as RemoteScanState;
}
