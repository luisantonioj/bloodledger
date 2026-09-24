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

export interface V2Reservation {
  reservationId: string;
  purpose: "TRANSFER" | "LOCAL_RELEASE";
  status: string;
  version: number;
  sourceInstitutionId: string;
  destinationInstitutionId: string | null;
  transferId: string | null;
  localReleaseId: string | null;
  preparedAt: string | null;
  preparedEvidencePresent: boolean;
  updatedAt: string;
  components: { componentId: string; componentType: V2ComponentType; inventoryStatus: string; inventoryVersion: number }[];
  classification: "SIMULATION_ONLY";
}

export interface V2Page<T> { items: T[]; nextCursor: string | null }
export interface ReconciliationReasons { policyVersion: "SYNTHETIC_RECONCILIATION_REASONS_V1"; reasons: { code: string; label: string }[]; effect: "RECONCILIATION_HOLD_ONLY"; freeTextAllowed: false; classification: "SIMULATION_ONLY" }
export interface CompromiseReasons { policyVersion: "SYNTHETIC_COMPROMISE_REASONS_V1"; reasons: { code: string; label: string }[]; effect: "QUARANTINE_PENDING_MANUAL_REVIEW"; freeTextAllowed: false; classification: "SIMULATION_ONLY" }
export interface CensusIndex { scope: "INSTITUTION" | "REGULATORY_AGGREGATE"; displayPolicyVersion: "DOH_CENSUS_COLUMN_ORDER_V1"; displayBloodTypeOrder: V2BloodType[]; totalColumn: "CALCULATED"; reportAvailability: string; snapshots: { snapshotId: string; institutionId: string; scheduledFor: string; capturedAt: string; reportPolicyVersion: string; triggerType: string; classification: "SIMULATION_ONLY" }[]; nextCursor: string | null; classification: "SIMULATION_ONLY" }

function pageCursor(cursor?: string): string { return cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""; }

function parseReservation(value: unknown): V2Reservation {
  const body = record(value, "V2_RESERVATION_RESPONSE_INVALID");
  if (body.classification !== "SIMULATION_ONLY" || !Number.isSafeInteger(body.version) || !Array.isArray(body.components) || !["TRANSFER", "LOCAL_RELEASE"].includes(String(body.purpose))) throw new Error("V2_RESERVATION_RESPONSE_INVALID");
  const components = body.components.map((item: unknown) => {
    const component = record(item, "V2_RESERVATION_RESPONSE_INVALID");
    const componentType = requiredString(component.componentType, "V2_RESERVATION_RESPONSE_INVALID") as V2ComponentType;
    if (!V2_COMPONENT_TYPES.includes(componentType) || !Number.isSafeInteger(component.inventoryVersion)) throw new Error("V2_RESERVATION_RESPONSE_INVALID");
    return { componentId: requiredString(component.componentId, "V2_RESERVATION_RESPONSE_INVALID"), componentType, inventoryStatus: requiredString(component.inventoryStatus, "V2_RESERVATION_RESPONSE_INVALID"), inventoryVersion: Number(component.inventoryVersion) };
  });
  return { reservationId: requiredString(body.reservationId, "V2_RESERVATION_RESPONSE_INVALID"), purpose: body.purpose as V2Reservation["purpose"], status: requiredString(body.status, "V2_RESERVATION_RESPONSE_INVALID"), version: Number(body.version), sourceInstitutionId: requiredString(body.sourceInstitutionId, "V2_RESERVATION_RESPONSE_INVALID"), destinationInstitutionId: nullableString(body.destinationInstitutionId, "V2_RESERVATION_RESPONSE_INVALID"), transferId: nullableString(body.transferId, "V2_RESERVATION_RESPONSE_INVALID"), localReleaseId: nullableString(body.localReleaseId, "V2_RESERVATION_RESPONSE_INVALID"), preparedAt: nullableString(body.preparedAt, "V2_RESERVATION_RESPONSE_INVALID"), preparedEvidencePresent: body.preparedEvidencePresent === true, updatedAt: requiredString(body.updatedAt, "V2_RESERVATION_RESPONSE_INVALID"), components, classification: "SIMULATION_ONLY" };
}

export async function readReservations(cursor?: string): Promise<V2Page<V2Reservation>> {
  const body = record(await requestJson<unknown>(`/api/v2/reservations${pageCursor(cursor)}`, { headers: { "X-BloodLedger-Contract-Version": "V2.1" } }, "Reservations are unavailable."), "V2_RESERVATION_RESPONSE_INVALID");
  if (body.classification !== "SIMULATION_ONLY" || !Array.isArray(body.reservations)) throw new Error("V2_RESERVATION_RESPONSE_INVALID");
  return { items: body.reservations.map(parseReservation), nextCursor: nullableString(body.nextCursor, "V2_RESERVATION_RESPONSE_INVALID") };
}

export async function readReservation(id: string): Promise<V2Reservation> {
  return parseReservation(await requestJson<unknown>(`/api/v2/reservations/${encodeURIComponent(id)}`, { headers: { "X-BloodLedger-Contract-Version": "V2.1" } }, "Reservation detail is unavailable."));
}

export async function readReconciliationReasons(): Promise<ReconciliationReasons> {
  const body = record(await requestJson<unknown>("/api/v2/reconciliation/reasons", {}, "Reconciliation choices are unavailable."), "V2_REASONS_RESPONSE_INVALID");
  if (body.policyVersion !== "SYNTHETIC_RECONCILIATION_REASONS_V1" || body.effect !== "RECONCILIATION_HOLD_ONLY" || body.freeTextAllowed !== false || body.classification !== "SIMULATION_ONLY" || !Array.isArray(body.reasons)) throw new Error("V2_REASONS_RESPONSE_INVALID");
  return { ...body, reasons: body.reasons.map((item: unknown) => { const reason = record(item, "V2_REASONS_RESPONSE_INVALID"); return { code: requiredString(reason.code, "V2_REASONS_RESPONSE_INVALID"), label: requiredString(reason.label, "V2_REASONS_RESPONSE_INVALID") }; }) } as ReconciliationReasons;
}

const COMPROMISE_CODES = ["TEMPERATURE_EXCURSION_REPORTED", "CONTAINER_DAMAGE_OR_LEAK_REPORTED", "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", "HANDLING_OR_CUSTODY_DEVIATION_REPORTED"];
export async function readCompromiseReasons(): Promise<CompromiseReasons> {
  const body = record(await requestJson<unknown>("/api/v2/reservations/compromise-reasons", {}, "Compromise reasons are unavailable."), "V2_COMPROMISE_POLICY_INVALID");
  if (body.policyVersion !== "SYNTHETIC_COMPROMISE_REASONS_V1" || body.effect !== "QUARANTINE_PENDING_MANUAL_REVIEW" || body.freeTextAllowed !== false || body.classification !== "SIMULATION_ONLY" || !Array.isArray(body.reasons) || body.reasons.length !== 4) throw new Error("V2_COMPROMISE_POLICY_INVALID");
  const reasons = body.reasons.map((item: unknown) => { const reason = record(item, "V2_COMPROMISE_POLICY_INVALID"); return { code: requiredString(reason.code, "V2_COMPROMISE_POLICY_INVALID"), label: requiredString(reason.label, "V2_COMPROMISE_POLICY_INVALID") }; });
  if (reasons.some((reason) => !COMPROMISE_CODES.includes(reason.code) || !reason.label) || new Set(reasons.map((reason) => reason.code)).size !== COMPROMISE_CODES.length) throw new Error("V2_COMPROMISE_POLICY_INVALID");
  return { policyVersion: "SYNTHETIC_COMPROMISE_REASONS_V1", reasons, effect: "QUARANTINE_PENDING_MANUAL_REVIEW", freeTextAllowed: false, classification: "SIMULATION_ONLY" };
}

export async function readCensusIndex(cursor?: string): Promise<CensusIndex> {
  const body = record(await requestJson<unknown>(`/api/v2/reports/doh-census${pageCursor(cursor)}`, {}, "Census snapshots are unavailable."), "V2_CENSUS_RESPONSE_INVALID");
  const order = ["O_POSITIVE", "A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_NEGATIVE", "A_NEGATIVE", "B_NEGATIVE", "AB_NEGATIVE"];
  if (body.classification !== "SIMULATION_ONLY" || body.displayPolicyVersion !== "DOH_CENSUS_COLUMN_ORDER_V1" || body.totalColumn !== "CALCULATED" || !Array.isArray(body.snapshots) || !Array.isArray(body.displayBloodTypeOrder) || body.displayBloodTypeOrder.length !== order.length || body.displayBloodTypeOrder.some((item, index) => item !== order[index])) throw new Error("V2_CENSUS_RESPONSE_INVALID");
  return body as unknown as CensusIndex;
}

export async function readCommandPage(cursor?: string, idempotencyKey?: string): Promise<V2Page<V2Command>> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (idempotencyKey) query.set("idempotencyKey", idempotencyKey);
  const body = record(await requestJson<unknown>(`/api/v2/commands${query.size ? `?${query}` : ""}`, {}, "Command recovery is unavailable."), "V2_COMMAND_RESPONSE_INVALID");
  if (body.scope !== "ACTOR_INSTITUTION" || body.classification !== "SIMULATION_ONLY" || !Array.isArray(body.commands)) throw new Error("V2_COMMAND_RESPONSE_INVALID");
  return { items: body.commands.map(parseV2Command), nextCursor: nullableString(body.nextCursor, "V2_COMMAND_RESPONSE_INVALID") };
}

export async function recoverAcceptedCommand(idempotencyKey: string): Promise<V2Command | undefined> {
  return (await readCommandPage(undefined, idempotencyKey)).items[0];
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
