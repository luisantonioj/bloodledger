export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) { super(message); }
}

interface ApiErrorEnvelope {
  error?: { message?: string; code?: string };
}

export interface VerificationRequest { action: string; payload: unknown; idempotencyKey: string }
type Verifier = (request: VerificationRequest) => Promise<string>;
let verifier: Verifier | undefined;
let sessionEpoch = 0;
export function setCommandVerifier(next?: Verifier) { verifier = next; sessionEpoch++; }

export async function requestJson<T>(path: string, init: RequestInit = {}, fallback = "Request failed."): Promise<T> {
  const epoch = sessionEpoch;
  const headers = new Headers(init.headers);
  if (verifier && init.method === "POST" && path.startsWith("/api/v2/") && path !== "/api/v2/auth/operator-verifications") {
    const key = headers.get("Idempotency-Key");
    if (!key || typeof init.body !== "string") throw new Error("A bound command and idempotency key are required.");
    headers.set("Operator-Verification", await verifier({action: "POST " + path, payload: JSON.parse(init.body), idempotencyKey: key}));
    if (headers.has("X-BloodLedger-Contract-Version")) headers.set("X-BloodLedger-Contract-Version", "V2.1");
    if (epoch !== sessionEpoch) throw new ApiRequestError(401, "The account session changed.", "AUTH_SESSION_REVOKED");
  }
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const controlledHeaders: Record<string,string> = {};
  const names: Record<string,string> = {accept:"Accept", "content-type":"Content-Type", "idempotency-key":"Idempotency-Key", "x-bloodledger-contract-version":"X-BloodLedger-Contract-Version", "operator-verification":"Operator-Verification"};
  headers.forEach((value,key) => {controlledHeaders[names[key] ?? key] = value;});
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: controlledHeaders,
  });
  const body = await response.json().catch(() => null) as ApiErrorEnvelope | null;
  if (!response.ok) {
    if (epoch === sessionEpoch && response.status === 401 && path !== "/api/v1/auth/session") window.dispatchEvent(new Event("bloodledger:session-ended"));
    throw new ApiRequestError(response.status, body?.error?.message ?? fallback, body?.error?.code);
  }
  if (epoch !== sessionEpoch && path !== "/api/v1/auth/session") throw new ApiRequestError(401, "The account session changed.");
  return body as T;
}
