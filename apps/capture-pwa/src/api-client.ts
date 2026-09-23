import { COMMAND_STATUSES, type ContractVersion, type InboundCaptureResult, type InboundOcrCapture, type V2Command } from "./types";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export interface CapturePrincipal {
  userId: string;
  displayName: string;
  institutionId: string;
  institutionDisplayName: string;
  roleId: "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04" | "ROLE-05" | "ROLE-06";
  roleDisplayName: string;
  classification: "SIMULATION_ONLY";
}

export class ApiError extends Error {
  public constructor(public readonly code: string, public readonly status: number, message?: string) {
    super(message ?? code);
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function apiError(body: unknown, fallback: string, status: number): ApiError {
  const envelope = body as ApiErrorBody | null;
  return new ApiError(envelope?.error?.code ?? fallback, status, envelope?.error?.message);
}

function isCommand(value: unknown): value is V2Command {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const command = value as Partial<V2Command>;
  return typeof command.commandId === "string"
    && typeof command.resourceId === "string"
    && typeof command.statusUrl === "string"
    && typeof command.status === "string"
    && COMMAND_STATUSES.includes(command.status as V2Command["status"])
    && command.classification === "SIMULATION_ONLY";
}

function isInboundResult(value: unknown): value is InboundCaptureResult {
  if (isCommand(value)) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return result.resolution === "ALREADY_REGISTERED"
    && typeof result.captureId === "string"
    && typeof result.componentId === "string"
    && result.classification === "SIMULATION_ONLY";
}

export async function createSession(username: string, password: string): Promise<CapturePrincipal> {
  const response = await fetch("/api/v1/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await safeJson(response);
  if (!response.ok) throw apiError(body, "AUTH_FAILED", response.status);
  return (body as { principal: CapturePrincipal }).principal;
}

export async function restoreSession(): Promise<CapturePrincipal> {
  const response = await fetch("/api/v1/auth/session", { credentials: "same-origin" });
  const body = await safeJson(response);
  if (!response.ok) throw apiError(body, "AUTH_REQUIRED", response.status);
  return (body as { principal: CapturePrincipal }).principal;
}

export async function endSession(): Promise<void> {
  await fetch("/api/v1/auth/session", { method: "DELETE", credentials: "same-origin" });
}

export async function submitInboundCapture(
  idempotencyKey: string,
  capture: InboundOcrCapture,
  contractVersion: ContractVersion,
): Promise<InboundCaptureResult> {
  const response = await fetch("/api/v2/inbound-captures", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-bloodledger-contract-version": contractVersion,
    },
    body: JSON.stringify(capture),
  });
  const body = await safeJson(response);
  if (!response.ok) throw apiError(body, "INBOUND_CAPTURE_FAILED", response.status);
  if (!isInboundResult(body)) throw new ApiError("V2_RESPONSE_INVALID", response.status);
  return body;
}

export async function fetchCommandStatus(statusUrl: string): Promise<V2Command> {
  if (!/^\/api\/v2\/commands\/[A-Za-z0-9_-]+$/.test(statusUrl)) {
    throw new ApiError("V2_STATUS_URL_INVALID", 0);
  }
  const response = await fetch(statusUrl, { credentials: "same-origin" });
  const body = await safeJson(response);
  if (!response.ok) throw apiError(body, "V2_COMMAND_STATUS_FAILED", response.status);
  if (!isCommand(body)) throw new ApiError("V2_RESPONSE_INVALID", response.status);
  return body;
}

export async function recoverCommands(idempotencyKey?: string): Promise<V2Command[]> {
  const commands: V2Command[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    if (idempotencyKey) query.set("idempotencyKey", idempotencyKey);
    const response = await fetch(`/api/v2/commands${query.size ? `?${query}` : ""}`, { credentials: "same-origin" });
    const body = await safeJson(response);
    if (!response.ok) throw apiError(body, "V2_COMMAND_RECOVERY_FAILED", response.status);
    const page = body as { scope?: unknown; commands?: unknown; nextCursor?: unknown; classification?: unknown } | null;
    if (page?.scope !== "ACTOR_INSTITUTION" || page.classification !== "SIMULATION_ONLY" || !Array.isArray(page.commands) || !page.commands.every(isCommand) || (page.nextCursor !== null && typeof page.nextCursor !== "string")) throw new ApiError("V2_RESPONSE_INVALID", response.status);
    commands.push(...page.commands);
    cursor = page.nextCursor as string | null;
  } while (cursor && !idempotencyKey);
  return commands;
}
