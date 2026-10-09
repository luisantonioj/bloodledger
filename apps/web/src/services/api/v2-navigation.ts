import type { Principal } from "../../auth/permissions";
import { ApiRequestError, requestJson } from "./client";
import { parseV2Component, type V2Component } from "./v2";

export interface ReservationDetail {
  reservationId: string; purpose: "TRANSFER" | "LOCAL_RELEASE"; status: string; version: number;
  sourceInstitutionId: string; destinationInstitutionId: string | null;
  transferId: string | null; localReleaseId: string | null; preparedAt: string | null;
  preparedEvidencePresent: boolean; updatedAt: string;
  components: {componentId: string; componentType: string; inventoryStatus: string; inventoryVersion: number}[];
  classification: "SIMULATION_ONLY";
}
export interface TransferRequestDetail {
  transfer_id: string; source_institution_id: string; destination_institution_id: string;
  blood_type: string; component_type: string; quantity: number; status: string;
  ledger_transaction_id: string | null;
}
export type RecordSelection = {kind: "component" | "reservation" | "request"; id: string};
export type SelectedRecord = {kind: "component"; value: V2Component} | {kind: "reservation"; value: ReservationDetail} | {kind: "request"; value: TransferRequestDetail};

export function selectionFromSearch(search: string): RecordSelection | undefined {
  const query = new URLSearchParams(search), kind = query.get("record"), id = query.get("recordId");
  return id && ["component", "reservation", "request"].includes(kind ?? "") ? {kind: kind as RecordSelection["kind"], id} : undefined;
}

const invalid = () => new Error("The record response is incomplete or inconsistent.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== "string" || !value) throw invalid(); return value; }
function nullable(value: unknown): string | null { return value === null ? null : text(value); }
function integer(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw invalid(); return Number(value); }
function scope(allowed: boolean) { if (!allowed) throw new ApiRequestError(403, "This record is outside the authorized institution scope."); }

export function parseReservationDetail(value: unknown, id: string, principal: Principal): ReservationDetail {
  const row = object(value);
  if (row.classification !== "SIMULATION_ONLY" || row.reservationId !== id || !["TRANSFER", "LOCAL_RELEASE"].includes(String(row.purpose)) || !Array.isArray(row.components)) throw invalid();
  const sourceInstitutionId = text(row.sourceInstitutionId), destinationInstitutionId = nullable(row.destinationInstitutionId);
  scope([sourceInstitutionId, destinationInstitutionId].includes(principal.institutionId));
  const transferId = nullable(row.transferId), localReleaseId = nullable(row.localReleaseId);
  if (row.purpose === "TRANSFER" ? !transferId || localReleaseId !== null : !localReleaseId || transferId !== null) throw invalid();
  if (typeof row.preparedEvidencePresent !== "boolean") throw invalid();
  const components = row.components.map(item => {
    const member = object(item);
    return {componentId: text(member.componentId), componentType: text(member.componentType), inventoryStatus: text(member.inventoryStatus), inventoryVersion: integer(member.inventoryVersion)};
  });
  if (new Set(components.map(c => c.componentId)).size !== components.length) throw invalid();
  return {reservationId: id, purpose: row.purpose as ReservationDetail["purpose"], status: text(row.status), version: integer(row.version), sourceInstitutionId, destinationInstitutionId, transferId, localReleaseId, preparedAt: nullable(row.preparedAt), preparedEvidencePresent: row.preparedEvidencePresent, updatedAt: text(row.updatedAt), components, classification: "SIMULATION_ONLY"};
}

export function parseTransferRequest(value: unknown, id: string, principal: Principal): TransferRequestDetail {
  const row = object(value);
  if (row.transfer_id !== id) throw invalid();
  const source = text(row.source_institution_id), destination = text(row.destination_institution_id);
  scope([source, destination].includes(principal.institutionId));
  return {transfer_id: id, source_institution_id: source, destination_institution_id: destination, blood_type: text(row.blood_type), component_type: text(row.component_type), quantity: integer(row.quantity), status: text(row.status), ledger_transaction_id: nullable(row.ledger_transaction_id)};
}

export async function readSelectedRecord(selection: RecordSelection, principal: Principal, signal?: AbortSignal): Promise<SelectedRecord> {
  const prefix = {component: "COMP", reservation: "RES", request: "TRF"}[selection.kind];
  if (!new RegExp(`^${prefix}_[A-Z0-9_-]{1,56}$`).test(selection.id)) throw new ApiRequestError(404, "Record unavailable in this scope.");
  const init = {signal, headers: {"X-BloodLedger-Contract-Version": "V2.1"}};
  if (selection.kind === "component") {
    const value = parseV2Component(await requestJson<unknown>("/api/v2/components/" + selection.id, init));
    if (value.componentId !== selection.id) throw invalid();
    scope(value.institutionId === principal.institutionId);
    return {kind: "component", value};
  }
  if (selection.kind === "reservation") return {kind: "reservation", value: parseReservationDetail(await requestJson<unknown>("/api/v2/reservations/" + selection.id, init), selection.id, principal)};
  // Requests are exposed through this existing list contract. No detail route is assumed.
  const response = object(await requestJson<unknown>("/api/v2/transfers", init));
  if (response.classification !== "SIMULATION_ONLY" || !Array.isArray(response.requests)) throw invalid();
  const found = response.requests.find(row => object(row).transfer_id === selection.id);
  if (!found) throw new ApiRequestError(404, "The request is missing or not visible in this scope.");
  return {kind: "request", value: parseTransferRequest(found, selection.id, principal)};
}

export function recordErrorMessage(reason: unknown): string {
  if (reason instanceof ApiRequestError) {
    if (reason.status === 401) return "Your session ended. Sign in again.";
    if (reason.status === 403) return "Access denied. This record is outside the authorized scope.";
    if (reason.status === 404) return "Record unavailable. It may be missing or outside the authorized scope.";
    if (reason.status === 409) return "The record changed or conflicted. Refresh before continuing.";
  }
  return "The record could not be verified. Retry to read its current state.";
}
