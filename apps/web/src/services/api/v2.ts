import { requestJson } from "./client";
import type { MutationKeys } from "./mutation-keys";

export const V2_BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
] as const;

export const V2_COMPONENT_TYPES = [
  "WHOLE_BLOOD",
  "PACKED_RED_BLOOD_CELLS",
  "FRESH_FROZEN_PLASMA",
  "PLATELETS",
  "CRYOPRECIPITATE",
] as const;

export const V2_COMMAND_STATUSES = [
  "QUEUED",
  "SUBMITTING",
  "RETRY_WAIT",
  "LEDGER_COMMITTED_PROJECTION_PENDING",
  "COMMITTED",
  "FAILED",
  "CONFLICT",
] as const;

export type V2BloodType = (typeof V2_BLOOD_TYPES)[number];
export type V2ComponentType = (typeof V2_COMPONENT_TYPES)[number];
export type V2CommandStatus = (typeof V2_COMMAND_STATUSES)[number];
export type V2ContractVersion = "V2" | "V2.1";

export interface V2Component {
  componentId: string;
  donationId: string;
  issuerInstitutionId: string;
  componentType: V2ComponentType;
  bloodType: V2BloodType;
  collectedAt: string;
  expiresAt: string;
  institutionId: string;
  inventoryStatus: string;
  reservationId: string | null;
  reservationVersion: number | null;
  inventoryVersion: number;
  policyVersion: string;
  classification: "SIMULATION_ONLY";
}

export interface V2ComponentsResponse {
  scope: "INSTITUTION";
  components: V2Component[];
  classification: "SIMULATION_ONLY";
}

export interface V2Command {
  commandId: string;
  resourceType: "COMPONENT" | "INBOUND_CAPTURE" | "TRANSFER" | "LOCAL_RELEASE" | "RECONCILIATION";
  resourceId: string;
  status: V2CommandStatus;
  statusUrl: string;
  acceptedAt: string;
  correlationId: string;
  safeErrorCode: string | null;
  classification: "SIMULATION_ONLY";
  replayed: boolean;
}

export interface InboundIntakeResponse {
  scope: string;
  statuses: Record<string, number>;
  includedInventoryStatuses: string[];
  excludedFromInventory: string[];
  classification: "SIMULATION_ONLY";
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function nullableString(value: unknown, code: string): string | null {
  if (value === null) return null;
  return requiredString(value, code);
}

export function parseV2Command(value: unknown): V2Command {
  const body = record(value, "V2_COMMAND_RESPONSE_INVALID");
  const status = requiredString(body.status, "V2_COMMAND_RESPONSE_INVALID") as V2CommandStatus;
  if (!V2_COMMAND_STATUSES.includes(status)) throw new Error("V2_COMMAND_RESPONSE_INVALID");
  const statusUrl = requiredString(body.statusUrl, "V2_COMMAND_RESPONSE_INVALID");
  if (!/^\/api\/v2\/commands\/[A-Za-z0-9_-]+$/.test(statusUrl)) throw new Error("V2_STATUS_URL_INVALID");
  if (body.classification !== "SIMULATION_ONLY" || typeof body.replayed !== "boolean") throw new Error("V2_COMMAND_RESPONSE_INVALID");
  return {
    commandId: requiredString(body.commandId, "V2_COMMAND_RESPONSE_INVALID"),
    resourceType: requiredString(body.resourceType, "V2_COMMAND_RESPONSE_INVALID") as V2Command["resourceType"],
    resourceId: requiredString(body.resourceId, "V2_COMMAND_RESPONSE_INVALID"),
    status,
    statusUrl,
    acceptedAt: requiredString(body.acceptedAt, "V2_COMMAND_RESPONSE_INVALID"),
    correlationId: requiredString(body.correlationId, "V2_COMMAND_RESPONSE_INVALID"),
    safeErrorCode: nullableString(body.safeErrorCode, "V2_COMMAND_RESPONSE_INVALID"),
    classification: "SIMULATION_ONLY",
    replayed: body.replayed,
  };
}

function parseComponent(value: unknown): V2Component {
  const body = record(value, "V2_COMPONENT_RESPONSE_INVALID");
  const bloodType = requiredString(body.bloodType, "V2_COMPONENT_RESPONSE_INVALID") as V2BloodType;
  const componentType = requiredString(body.componentType, "V2_COMPONENT_RESPONSE_INVALID") as V2ComponentType;
  if (!V2_BLOOD_TYPES.includes(bloodType) || !V2_COMPONENT_TYPES.includes(componentType)) throw new Error("V2_COMPONENT_RESPONSE_INVALID");
  if (body.classification !== "SIMULATION_ONLY" || !Number.isSafeInteger(body.inventoryVersion)) throw new Error("V2_COMPONENT_RESPONSE_INVALID");
  if (body.reservationVersion !== null && !Number.isSafeInteger(body.reservationVersion)) throw new Error("V2_COMPONENT_RESPONSE_INVALID");
  return {
    componentId: requiredString(body.componentId, "V2_COMPONENT_RESPONSE_INVALID"),
    donationId: requiredString(body.donationId, "V2_COMPONENT_RESPONSE_INVALID"),
    issuerInstitutionId: requiredString(body.issuerInstitutionId, "V2_COMPONENT_RESPONSE_INVALID"),
    componentType,
    bloodType,
    collectedAt: requiredString(body.collectedAt, "V2_COMPONENT_RESPONSE_INVALID"),
    expiresAt: requiredString(body.expiresAt, "V2_COMPONENT_RESPONSE_INVALID"),
    institutionId: requiredString(body.institutionId, "V2_COMPONENT_RESPONSE_INVALID"),
    inventoryStatus: requiredString(body.inventoryStatus, "V2_COMPONENT_RESPONSE_INVALID"),
    reservationId: nullableString(body.reservationId, "V2_COMPONENT_RESPONSE_INVALID"),
    reservationVersion: body.reservationVersion as number | null,
    inventoryVersion: Number(body.inventoryVersion),
    policyVersion: requiredString(body.policyVersion, "V2_COMPONENT_RESPONSE_INVALID"),
    classification: "SIMULATION_ONLY",
  };
}

export function parseComponentsResponse(value: unknown): V2ComponentsResponse {
  const body = record(value, "V2_COMPONENT_RESPONSE_INVALID");
  if (body.scope !== "INSTITUTION" || body.classification !== "SIMULATION_ONLY" || !Array.isArray(body.components)) {
    throw new Error("V2_COMPONENT_RESPONSE_INVALID");
  }
  return { scope: "INSTITUTION", components: body.components.map(parseComponent), classification: "SIMULATION_ONLY" };
}

export function contractVersionFor(componentType: V2ComponentType): V2ContractVersion {
  return componentType === "CRYOPRECIPITATE" ? "V2.1" : "V2";
}

function mutationInit(keys: MutationKeys, payload: object, version: V2ContractVersion): RequestInit {
  return {
    method: "POST",
    headers: {
      "Idempotency-Key": keys.idempotencyKey,
      "X-BloodLedger-Contract-Version": version,
    },
    body: JSON.stringify(payload),
  };
}

async function commandMutation(path: string, keys: MutationKeys, payload: object, version: V2ContractVersion): Promise<V2Command> {
  return parseV2Command(await requestJson<unknown>(path, mutationInit(keys, payload, version), "The V2 command was not accepted."));
}

export async function readV2Components(version: V2ContractVersion = "V2"): Promise<V2ComponentsResponse> {
  const body = await requestJson<unknown>("/api/v2/components", { headers: { "X-BloodLedger-Contract-Version": version } }, "V2 component inventory is unavailable.");
  return parseComponentsResponse(body);
}

export async function readInboundIntake(): Promise<InboundIntakeResponse> {
  return requestJson<InboundIntakeResponse>("/api/v2/reports/inbound-intake", {}, "Inbound intake status is unavailable.");
}

export async function readCommand(statusUrl: string): Promise<V2Command> {
  if (!/^\/api\/v2\/commands\/[A-Za-z0-9_-]+$/.test(statusUrl)) throw new Error("V2_STATUS_URL_INVALID");
  return parseV2Command(await requestJson<unknown>(statusUrl, {}, "V2 command status is unavailable."));
}

export function submitV2Transfer(payload: object & { componentType: V2ComponentType }, keys: MutationKeys): Promise<V2Command> {
  return commandMutation("/api/v2/transfers", keys, payload, contractVersionFor(payload.componentType));
}

export function submitV2LocalRelease(payload: object & { componentType: V2ComponentType }, keys: MutationKeys): Promise<V2Command> {
  return commandMutation("/api/v2/local-releases", keys, payload, contractVersionFor(payload.componentType));
}

export function submitV2Reconciliation(payload: object, keys: MutationKeys, version: V2ContractVersion = "V2"): Promise<V2Command> {
  return commandMutation("/api/v2/reconciliation", keys, payload, version);
}

export function submitReservationAction(reservationId: string, action: string, payload: object, keys: MutationKeys, version: V2ContractVersion = "V2"): Promise<V2Command> {
  const path = "/api/v2/reservations/" + encodeURIComponent(reservationId) + "/" + encodeURIComponent(action);
  return commandMutation(path, keys, payload, version);
}
