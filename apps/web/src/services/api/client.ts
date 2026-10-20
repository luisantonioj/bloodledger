import { operatorBoundPayload } from "./operator-payload";

export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string, public readonly details?: Array<{field:string;rule:string}>, public readonly retryAfter?: number) { super(message); }
}

interface ApiErrorEnvelope {
  error?: { message?: string; code?: string; details?: Array<{field:string;rule:string}> };
}

export interface VerificationRequest { action: string; payload: unknown; idempotencyKey: string }
type Verifier = (request: VerificationRequest) => Promise<string>;
let verifier: Verifier | undefined;
let sessionEpoch = 0;
export function setCommandVerifier(next?: Verifier) { verifier = next; sessionEpoch++; }

// A verifier install or removal advances the epoch and rejects reads already in flight. Retry an
// idempotent read once while its caller is still current; a real account change remounts the view.
export async function retryAfterContextChange<T>(read: () => Promise<T>, active: () => boolean = () => true): Promise<T> {
  try { return await read(); }
  catch (reason) {
    if (reason instanceof ApiRequestError && reason.code === "AUTH_CONTEXT_CHANGED" && active()) return read();
    throw reason;
  }
}

export async function requestJson<T>(path: string, init: RequestInit = {}, fallback = "Request failed."): Promise<T> {
  const epoch = sessionEpoch;
  const headers = new Headers(init.headers);
  if (verifier && init.method === "POST" && path.startsWith("/api/v2/") && path !== "/api/v2/auth/operator-verifications" && path !== "/api/v2/onboarding/public-applications") {
    const key = headers.get("Idempotency-Key");
    if (!key || typeof init.body !== "string") throw new Error("A bound command and idempotency key are required.");
    headers.set("Operator-Verification", await verifier({action: "POST " + path, payload: operatorBoundPayload(JSON.parse(init.body)), idempotencyKey: key}));
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
  if (epoch !== sessionEpoch && path !== "/api/v1/auth/session") {
    // Do not terminate a newer session for an old response, but preserve a real denial.
    if (response.status === 401) throw new ApiRequestError(401, body?.error?.message ?? fallback, body?.error?.code ?? "AUTH_REQUIRED");
    throw new ApiRequestError(401, "The account session changed.", "AUTH_CONTEXT_CHANGED");
  }
  if (!response.ok) {
    if (epoch === sessionEpoch && response.status === 401 && path !== "/api/v1/auth/session") window.dispatchEvent(new Event("bloodledger:session-ended"));
    const details=Array.isArray(body?.error?.details)?body.error.details.filter(item=>item&&typeof item.field==="string"&&typeof item.rule==="string").slice(0,40).map(({field,rule})=>({field,rule})):undefined;
    const header=response.headers?.get("Retry-After");
    const retryAfter=header&&/^\d+$/.test(header)?Number(header):undefined;
    throw new ApiRequestError(response.status, body?.error?.message ?? fallback, body?.error?.code, details, retryAfter);
  }
  return body as T;
}
