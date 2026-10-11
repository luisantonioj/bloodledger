import type { Principal } from "../../auth/permissions";

export interface RequestRow {
  transfer_id: string; source_institution_id: string; destination_institution_id: string;
  blood_type: string; component_type: string; quantity: number; urgency: string;
  request_time: string | null; status: string; ledger_transaction_id: string | null;
}
export interface TransferRow {
  reservation_id: string; transfer_id: string; status: string; version: number;
  request: RequestRow;
}
export interface OperationRow { command_id: string; resource_id: string; operation: string; status: string; accepted_at: string; ledger_transaction_id: string | null }
export interface RequesterRecords { requests: RequestRow[]; transfers: TransferRow[]; timeline: OperationRow[] }
const invalid = () => new Error("Request records are incomplete. Refresh to try again.");
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== "string" || !value) throw invalid(); return value; }
function integer(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw invalid(); return Number(value); }

// FR-05/12 / BL-TST-01: own requests only; reservation states never replace request states.
export function parseRequesterRecords(value: unknown, principal: Principal): RequesterRecords {
  const body = object(value);
  if (body.classification !== "SIMULATION_ONLY" || body.scope === "CITY_AGGREGATE" || !Array.isArray(body.requests) || !Array.isArray(body.reservations) || !Array.isArray(body.timeline)) throw invalid();
  const requests = body.requests.map(object).filter(row => row.destination_institution_id === principal.institutionId).map(row => ({
    transfer_id: text(row.transfer_id), source_institution_id: text(row.source_institution_id), destination_institution_id: text(row.destination_institution_id),
    blood_type: text(row.blood_type), component_type: text(row.component_type), quantity: integer(row.quantity), urgency: text(row.urgency),
    request_time: typeof row.request_time === "string" && Number.isFinite(Date.parse(row.request_time)) ? row.request_time : null,
    status: text(row.status), ledger_transaction_id: row.ledger_transaction_id === null ? null : text(row.ledger_transaction_id),
  }));
  const transfers = body.reservations.map(object).filter(row => row.purpose === "TRANSFER" && row.destination_institution_id === principal.institutionId).flatMap(row => {
    const request = requests.find(request => request.transfer_id === row.transfer_id);
    if (!request) return [];
    return [{reservation_id: text(row.reservation_id), transfer_id: request.transfer_id, status: text(row.status), version: integer(row.version), request}];
  });
  const allowed = new Set([...requests.map(row => row.transfer_id), ...transfers.map(row => row.reservation_id)]);
  const timeline = body.timeline.map(object).filter(row => allowed.has(String(row.resource_id))).map(row => ({command_id:text(row.command_id),resource_id:text(row.resource_id),operation:text(row.operation),status:text(row.status),accepted_at:text(row.accepted_at),ledger_transaction_id:row.ledger_transaction_id === null ? null : text(row.ledger_transaction_id)}));
  return { requests, transfers, timeline };
}
export const readableCode = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
export const componentLabel = (value: string) => ({PACKED_RED_BLOOD_CELLS:"PRBC",FRESH_FROZEN_PLASMA:"FFP",WHOLE_BLOOD:"Whole Blood",PLATELETS:"Platelets",CRYOPRECIPITATE:"Cryo"} as Record<string,string>)[value] ?? readableCode(value);
export function facilityLabel(id: string, principal: Principal): string {
  if (id === principal.institutionId) return principal.institutionDisplayName;
  return ({INST_MEDIATRIX:"Mary Mediatrix",INST_SYNTH_MEDIX:"Lipa Medix",INST_SYNTH_NLVILLA:"N.L. Villa"} as Record<string,string>)[id] ?? id;
}
