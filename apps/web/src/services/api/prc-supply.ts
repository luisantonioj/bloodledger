import type { Principal } from "../../auth/permissions";
import { ApiRequestError, requestJson } from "./client";
import { choice, integer, invalidRead, nullableChoice, nullableText, nullableTimestamp, object, text, timestamp } from "./contract-validation";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "./v2";
import { URGENCIES } from "./transaction-reads";
import type { ReadPage } from "./transaction-reads";

export const PRC_SUPPLY_POLICY = "SYNTHETIC_PRC_SUPPLY_V1";
export const PRC_SUPPLY_STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "FULFILLED", "DECLINED", "CANCELLED"] as const;
export const PRC_DECLINE_REASONS = ["NO_STOCK", "OUT_OF_SCOPE", "DUPLICATE_REQUEST", "DEADLINE_NOT_FEASIBLE"] as const;
export const PRC_ACTIONS = ["cancel", "acknowledge", "fulfil", "decline"] as const;
export type PrcAction = typeof PRC_ACTIONS[number];
export const PRC_REQUEST_ID = /^PRCSR_[A-Z0-9]{40}$/;
export const PRC_REFERENCE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const terminal = (status: string) => ["FULFILLED", "DECLINED", "CANCELLED"].includes(status);

export const canReadPrcSupply = (p: Principal) => Boolean(p.accountId) && (p.accountCategory === "PRC" || p.accountCategory === "BLOOD_BANK" && ["ROLE-01", "ROLE-02"].includes(p.roleId));
export function parsePrcSupplyRequest(value: unknown) {
  const row = object(value), institution = object(row.requestingInstitution);
  const requestId = text(row.requestId), status = choice(row.status, PRC_SUPPLY_STATUSES);
  const requestedQuantity = integer(row.requestedQuantity), fulfilledQuantity = row.fulfilledQuantity === null ? null : integer(row.fulfilledQuantity);
  const prcReference = nullableText(row.prcReference), referenceProvenance = nullableChoice(row.referenceProvenance, ["PRC_RECORDED_IN_SYSTEM"]);
  const declineReason = nullableChoice(row.declineReason, PRC_DECLINE_REASONS);
  const submittedAt = timestamp(row.submittedAt), requiredBy = timestamp(row.requiredBy), acknowledgedAt = nullableTimestamp(row.acknowledgedAt), closedAt = nullableTimestamp(row.closedAt);
  if (!PRC_REQUEST_ID.test(requestId) || requestedQuantity > 10 || fulfilledQuantity !== null && fulfilledQuantity > requestedQuantity || object(row.ledger).status !== "NOT_APPLICABLE" || row.policyVersion !== PRC_SUPPLY_POLICY || row.classification !== "SIMULATION_ONLY") throw invalidRead();
  if (prcReference !== null && !PRC_REFERENCE.test(prcReference) || (prcReference === null) !== (referenceProvenance === null) || (prcReference === null) !== (acknowledgedAt === null)) throw invalidRead();
  if ((status === "FULFILLED") !== (fulfilledQuantity !== null) || (status === "DECLINED") !== (declineReason !== null) || terminal(status) !== (closedAt !== null)) throw invalidRead();
  if (["SUBMITTED", "CANCELLED"].includes(status) && prcReference !== null || ["ACKNOWLEDGED", "FULFILLED"].includes(status) && prcReference === null || Date.parse(requiredBy) <= Date.parse(submittedAt)) throw invalidRead();
  return { requestId, requestingInstitution: {institutionId: text(institution.institutionId), displayName: nullableText(institution.displayName)}, bloodType: choice(row.bloodType, V2_BLOOD_TYPES), componentType: choice(row.componentType, V2_COMPONENT_TYPES), requestedQuantity, fulfilledQuantity, urgency: choice(row.urgency, URGENCIES), requiredBy, status, prcReference, referenceProvenance, declineReason, submittedAt, acknowledgedAt, closedAt, version: integer(row.version), ledger: {status: "NOT_APPLICABLE" as const}, policyVersion: PRC_SUPPLY_POLICY, classification: "SIMULATION_ONLY" as const };
}
export type PrcSupplyRequest = ReturnType<typeof parsePrcSupplyRequest>;
export function verifyPrcScope(row: PrcSupplyRequest, principal: Principal) {
  if (!canReadPrcSupply(principal) || principal.accountCategory !== "PRC" && row.requestingInstitution.institutionId !== principal.institutionId) throw invalidRead();
  return row;
}
export function parsePrcSupplyList(value: unknown, principal: Principal): ReadPage<PrcSupplyRequest> {
  const row = object(value);
  if (!canReadPrcSupply(principal) || row.scope !== (principal.accountCategory === "PRC" ? "PRC_ALL" : "INSTITUTION") || row.policyVersion !== PRC_SUPPLY_POLICY || row.classification !== "SIMULATION_ONLY" || !Array.isArray(row.rows)) throw invalidRead();
  const nextCursor = nullableText(row.nextCursor);
  if (nextCursor !== null && !/^PRCS_[A-Za-z0-9_-]{1,140}$/.test(nextCursor)) throw invalidRead();
  const rows = row.rows.map(value => verifyPrcScope(parsePrcSupplyRequest(value), principal));
  if (new Set(rows.map(item => item.requestId)).size !== rows.length) throw invalidRead();
  return {rows, nextCursor};
}
export function parsePrcSupplyDetail(value: unknown, principal: Principal) {
  const row = object(value), base = verifyPrcScope(parsePrcSupplyRequest(value), principal);
  if (!Array.isArray(row.history)) throw invalidRead();
  const history = row.history.map(value => {
    const entry = object(value), actor = object(entry.actor);
    return {action: choice(entry.action, ["PRC_SUPPLY_SUBMIT", "PRC_SUPPLY_CANCEL", "PRC_SUPPLY_ACKNOWLEDGE", "PRC_SUPPLY_FULFIL", "PRC_SUPPLY_DECLINE"]), priorStatus: nullableChoice(entry.priorStatus, PRC_SUPPLY_STATUSES), resultingStatus: choice(entry.resultingStatus, PRC_SUPPLY_STATUSES), reasonCode: nullableChoice(entry.reasonCode, PRC_DECLINE_REASONS), actor: {reference: text(actor.reference), institutionId: nullableText(actor.institutionId), displayName: nullableText(actor.displayName)}, recordedAt: timestamp(entry.recordedAt)};
  });
  if (history.some((entry, index) => index > 0 && Date.parse(entry.recordedAt) < Date.parse(history[index - 1].recordedAt))) throw invalidRead();
  return {...base, history};
}
export type PrcSupplyDetail = ReturnType<typeof parsePrcSupplyDetail>;
export function parsePrcMutation(value: unknown, principal: Principal, requestId?: string) {
  const row = object(value), result = verifyPrcScope(parsePrcSupplyRequest(value), principal);
  if (typeof row.replayed !== "boolean" || requestId && result.requestId !== requestId) throw invalidRead();
  return {...result, replayed: row.replayed};
}
export async function readPrcDetail(id: string, principal: Principal, signal: AbortSignal) {
  if (!PRC_REQUEST_ID.test(id)) throw invalidRead();
  const row = parsePrcSupplyDetail(await requestJson("/api/v2/prc-supply-requests/" + id, {signal}), principal);
  if (row.requestId !== id) throw invalidRead();
  return row;
}
export function prcRequiredBy(value: string, now: number = Date.now()) {
  // datetime-local is explicitly entered as Manila time, regardless of the browser timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter the required date and time in Asia/Manila.");
  const parsed = new Date(value + ":00+08:00");
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 16) !== value) throw new Error("Enter a valid required date and time.");
  const lead = parsed.getTime() - now;
  if (lead < 3600000 || lead > 30 * 24 * 3600000) throw new Error("Required By must be between 1 hour and 30 days from now (Asia/Manila).");
  return parsed.toISOString();
}
export function prcSupplyError(reason: unknown) {
  const messages: Record<string, string> = {
    PRC_SUPPLY_REQUIRED_BY_OUT_OF_WINDOW: "Required By is outside the allowed window. Choose a time 1 hour to 30 days ahead; check the device clock if this repeats.",
    PRC_SUPPLY_INPUT_INVALID: "Check the product, quantity, required time and action fields before submitting again.",
    PRC_SUPPLY_NOT_AUTHORIZED: "Your account or operator is not authorized for this PRC supply action.",
    PRC_SUPPLY_NOT_FOUND: "This PRC supply request is unavailable in your account's scope.",
    PRC_SUPPLY_VERSION_CONFLICT: "This request changed. Refresh its details before taking another action.",
    PRC_SUPPLY_TRANSITION_INVALID: "This action is no longer allowed. Refresh the request's coordination status.",
    PRC_SUPPLY_REFERENCE_CONFLICT: "That PRC reference is already in use. Check it with PRC and refresh before trying again.",
    PRC_SUPPLY_IDEMPOTENCY_CONFLICT: "This request key conflicts with a recorded attempt. Refresh and review the request before continuing.",
  };
  return reason instanceof ApiRequestError && reason.code && messages[reason.code] || "The result could not be confirmed. Refresh the list or retry the same attempt using the original operator.";
}

export function prcDefiniteRejection(reason: unknown, wasUnconfirmed: boolean) {
  // A later rejection cannot prove an earlier lost-response submission was never recorded.
  return !wasUnconfirmed && reason instanceof ApiRequestError && reason.code !== "AUTH_CONTEXT_CHANGED" && [400, 401, 403, 404, 409, 413, 415].includes(reason.status);
}
