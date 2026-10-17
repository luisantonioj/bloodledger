import { nullableIsoTimestamp } from "./time.js";
import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";

// ACTIVITY_HISTORY_READ_V1: the institution's audit trail, one row per independent event. Events are
// durable V2 commands and off-chain alert acknowledgements; links come only from recorded command
// fields and foreign-key projections, never from parsing prefixes or matching timestamps.
// ACTIVITY_HISTORY_READ_V2 (ADR-045, opt-in via ?contract=) adds the institution's own PRC supply
// coordination audit events. V1 output is unchanged and never contains PRC events.
export const ACTIVITY_HISTORY_POLICY_VERSION = "ACTIVITY_HISTORY_READ_V1";
export const ACTIVITY_HISTORY_V2_POLICY_VERSION = "ACTIVITY_HISTORY_READ_V2";
export type ActivityContract = typeof ACTIVITY_HISTORY_POLICY_VERSION | typeof ACTIVITY_HISTORY_V2_POLICY_VERSION;
const CURSOR_PATTERN: Record<ActivityContract, RegExp> = { ACTIVITY_HISTORY_READ_V1: /^ACT_[A-Za-z0-9_-]{1,140}$/, ACTIVITY_HISTORY_READ_V2: /^ACT2_[A-Za-z0-9_-]{1,140}$/ };
const CURSOR_PREFIX: Record<ActivityContract, string> = { ACTIVITY_HISTORY_READ_V1: "ACT_", ACTIVITY_HISTORY_READ_V2: "ACT2_" };
const EVENT_ID: Record<ActivityContract, RegExp> = { ACTIVITY_HISTORY_READ_V1: /^(CMD|IDEM)_[A-Z0-9_-]{1,59}$/, ACTIVITY_HISTORY_READ_V2: /^(CMD|IDEM|AUD)_[A-Z0-9_-]{1,59}$/ };

// An absent contract is V1; an unknown or repeated value is refused rather than silently ignored.
export function activityContract(value: unknown): ActivityContract {
  if (value === undefined || value === ACTIVITY_HISTORY_POLICY_VERSION) return ACTIVITY_HISTORY_POLICY_VERSION;
  if (value === ACTIVITY_HISTORY_V2_POLICY_VERSION) return ACTIVITY_HISTORY_V2_POLICY_VERSION;
  throw new ApiFailure(400, "ACTIVITY_CONTRACT_UNSUPPORTED", "The requested activity history contract is not supported.");
}
const OCR_OPERATIONS = new Set(["REGISTER_INBOUND_COMPONENT", "RECEIVE_INBOUND_COMPONENT"]);
const LEDGER_COMMITTED = new Set(["COMMITTED", "LEDGER_COMMITTED_PROJECTION_PENDING"]);

export interface ActivityRecord {
  eventId: string;
  eventSource: "COMMAND" | "OFF_CHAIN_ACKNOWLEDGEMENT" | "PRC_SUPPLY_COORDINATION";
  activityCode: string;
  targetType: string;
  processingStatus: string | null;
  safeErrorCode: string | null;
  correlationId: string;
  ledgerTransactionId: string | null;
  ledgerCommittedAt: string | null;
  recordedAt: string;
  commandEventTime: string | null;
  actorUserId: string;
  actorKind: "VERIFIED_OPERATOR" | "INSTITUTION_ACCOUNT" | "USER_ACCOUNT" | "UNKNOWN";
  actorDisplayName: string | null;
  actorCurrentRoleId: string | null;
  captureId: string | null;
  captureMethod: string | null;
  requestId: string | null;
  reservationId: string | null;
  reservationPurpose: string | null;
  localReleaseId: string | null;
  componentIds: string[];
  actorInstitutionId: string | null;
  prcSupplyRequestId: string | null;
  coordinationPriorStatus: string | null;
  coordinationResultingStatus: string | null;
  coordinationReasonCode: string | null;
}

export interface ActivityHistoryReader {
  readActivityHistory(institutionId: string, limit: number, cursor: { recordedAt: string; eventId: string } | null, includePrcCoordination?: boolean): Promise<{ records: ActivityRecord[]; hasMore: boolean }>;
}

export function decodeActivityCursor(value: unknown, contract: ActivityContract = ACTIVITY_HISTORY_POLICY_VERSION): { recordedAt: string; eventId: string } | null {
  if (value === undefined) return null;
  const invalid = new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  // Cursors are bound to the contract that issued them.
  if (typeof value !== "string" || !CURSOR_PATTERN[contract].test(value)) throw invalid;
  const [recordedAt, eventId, extra] = Buffer.from(value.slice(CURSOR_PREFIX[contract].length), "base64url").toString("utf8").split("|");
  if (extra !== undefined || !eventId || !EVENT_ID[contract].test(eventId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(recordedAt ?? "") || new Date(recordedAt).toISOString() !== recordedAt) throw invalid;
  return { recordedAt, eventId };
}

function encodeActivityCursor(record: ActivityRecord, contract: ActivityContract): string {
  return `${CURSOR_PREFIX[contract]}${Buffer.from(`${record.recordedAt}|${record.eventId}`, "utf8").toString("base64url")}`;
}

function eventStatus(record: ActivityRecord): string {
  if (record.eventSource !== "COMMAND") return "OFF_CHAIN_RECORDED";
  if (record.processingStatus === "COMMITTED") return "CONFIRMED";
  if (record.processingStatus === "LEDGER_COMMITTED_PROJECTION_PENDING" || record.processingStatus === "FAILED" || record.processingStatus === "CONFLICT") return record.processingStatus;
  return "PENDING";
}

function assembleV1Row(record: ActivityRecord) {
    const offChain = record.eventSource === "OFF_CHAIN_ACKNOWLEDGEMENT";
    const committed = !offChain && record.processingStatus !== null && LEDGER_COMMITTED.has(record.processingStatus) && record.ledgerTransactionId !== null;
    // Commands with a captureId came from the confirmed-OCR route; older payloads omit captureMethod.
    // ADR-049 bank receipts through `receive` carry no captureId, so they are not shown as scans.
    const scanned = record.captureId !== null && (record.captureMethod === "OCR" || OCR_OPERATIONS.has(record.activityCode));
    return {
      eventId: record.eventId,
      eventSource: record.eventSource,
      activityCode: record.activityCode,
      targetType: record.targetType,
      eventTime: offChain ? record.recordedAt : record.commandEventTime,
      eventTimeSource: offChain ? "OFF_CHAIN_ACKNOWLEDGED_AT" : record.commandEventTime ? "COMMAND_EVENT_TIME" : null,
      recordedAt: record.recordedAt,
      actor: { kind: record.actorKind, reference: record.actorUserId, displayName: record.actorDisplayName, currentRoleId: record.actorCurrentRoleId },
      links: {
        scanId: scanned ? record.captureId : null,
        transferId: record.requestId,
        reservationId: record.reservationId,
        reservationPurpose: record.reservationPurpose,
        localReleaseId: record.localReleaseId,
        componentIds: record.componentIds,
      },
      eventStatus: eventStatus(record),
      processingStatus: record.processingStatus,
      safeErrorCode: record.safeErrorCode,
      correlationId: record.correlationId,
      ledger: offChain
        ? { status: "NOT_APPLICABLE", transactionId: null, committedAt: null }
        : committed ? { status: "COMMITTED", transactionId: record.ledgerTransactionId, committedAt: record.ledgerCommittedAt } : { status: "NOT_COMMITTED", transactionId: null, committedAt: null },
    };
}

// V2 keeps every V1 field and adds actor institution, the PRC request link and coordination statuses.
// A PRC row is off-chain coordination only: no scan, request, transfer, unit or ledger reference.
function assembleV2Row(record: ActivityRecord) {
  const prc = record.eventSource === "PRC_SUPPLY_COORDINATION";
  const row = assembleV1Row(record);
  return {
    ...row,
    eventSource: record.eventSource,
    eventTime: prc ? record.recordedAt : row.eventTime,
    eventTimeSource: prc ? "PRC_COORDINATION_RECORDED_AT" : row.eventTimeSource,
    actor: { ...row.actor, institutionId: record.actorInstitutionId },
    links: prc
      ? { scanId: null, transferId: null, reservationId: null, reservationPurpose: null, localReleaseId: null, componentIds: [], prcSupplyRequestId: record.prcSupplyRequestId }
      : { ...row.links, prcSupplyRequestId: null },
    coordination: prc ? { priorStatus: record.coordinationPriorStatus, resultingStatus: record.coordinationResultingStatus, reasonCode: record.coordinationReasonCode } : null,
    ledger: prc ? { status: "NOT_APPLICABLE", transactionId: null, committedAt: null } : row.ledger,
  };
}

type ActivityPage<Row> = { scope: "INSTITUTION"; rows: Row[]; nextCursor: string | null; policyVersion: ActivityContract; classification: "SIMULATION_ONLY" };
export function assembleActivityHistory(records: ActivityRecord[], hasMore: boolean, contract?: typeof ACTIVITY_HISTORY_POLICY_VERSION): ActivityPage<ReturnType<typeof assembleV1Row>>;
export function assembleActivityHistory(records: ActivityRecord[], hasMore: boolean, contract: typeof ACTIVITY_HISTORY_V2_POLICY_VERSION): ActivityPage<ReturnType<typeof assembleV2Row>>;
export function assembleActivityHistory(records: ActivityRecord[], hasMore: boolean, contract: ActivityContract): ActivityPage<ReturnType<typeof assembleV1Row> | ReturnType<typeof assembleV2Row>>;
export function assembleActivityHistory(records: ActivityRecord[], hasMore: boolean, contract: ActivityContract = ACTIVITY_HISTORY_POLICY_VERSION): ActivityPage<ReturnType<typeof assembleV1Row> | ReturnType<typeof assembleV2Row>> {
  const v2 = contract === ACTIVITY_HISTORY_V2_POLICY_VERSION;
  // Defense in depth: V1 never carries PRC rows even if a reader returned them.
  const visible = v2 ? records : records.filter((record) => record.eventSource !== "PRC_SUPPLY_COORDINATION");
  const rows = visible.map((record) => v2 ? assembleV2Row(record) : assembleV1Row(record));
  const last = records.at(-1);
  return { scope: "INSTITUTION", rows, nextCursor: hasMore && last ? encodeActivityCursor(last, contract) : null, policyVersion: contract, classification: "SIMULATION_ONLY" };
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value === null || value === undefined ? null : String(value);
const iso = nullableIsoTimestamp;
const ACTOR_KIND = `CASE WHEN o.operator_id IS NOT NULL THEN 'VERIFIED_OPERATOR' WHEN EXISTS (SELECT 1 FROM app.institution_operators a WHERE a.account_id=e.actor_user_id) THEN 'INSTITUTION_ACCOUNT' WHEN u.user_id IS NOT NULL THEN 'USER_ACCOUNT' ELSE 'UNKNOWN' END`;

export class PostgresActivityHistoryReader implements ActivityHistoryReader {
  constructor(private readonly pool: Pool) {}
  async readActivityHistory(institutionId: string, limit: number, cursor: { recordedAt: string; eventId: string } | null, includePrcCoordination = false) {
    // Named payload keys only; encrypted Donation No. material in command payloads is never selected.
    const result = await this.pool.query<Row>(`WITH events AS (
      SELECT c.command_id AS event_id,'COMMAND' AS event_source,c.operation AS activity_code,c.resource_type AS target_type,c.status AS processing_status,c.safe_error_code,c.correlation_id,c.ledger_transaction_id,c.ledger_committed_at,c.accepted_at AS recorded_at,c.payload->>'eventTime' AS command_event_time,c.actor_user_id,
        c.payload->>'captureId' AS capture_id,c.payload->>'captureMethod' AS capture_method,COALESCE(c.payload->>'transferId',r.transfer_id) AS request_id,c.payload->>'reservationId' AS reservation_id,
        COALESCE(r.purpose,CASE c.operation WHEN 'RESERVE_COMPONENTS' THEN 'TRANSFER' WHEN 'RESERVE_LOCAL_RELEASE' THEN 'LOCAL_RELEASE' END) AS reservation_purpose,
        COALESCE(c.payload->>'localReleaseId',r.local_release_id) AS local_release_id,
        COALESCE(CASE WHEN jsonb_typeof(c.payload->'selectedComponentIds')='array' THEN c.payload->'selectedComponentIds' END,CASE WHEN c.payload ? 'componentId' THEN jsonb_build_array(c.payload->>'componentId') END,rc.members,'[]'::jsonb) AS component_ids,
        c.actor_institution_id,NULL::text AS prc_request_id,NULL::text AS prior_status,NULL::text AS resulting_status,NULL::text AS reason_code
      FROM app.v2_commands c
      LEFT JOIN app.v2_reservations r ON r.reservation_id=c.payload->>'reservationId'
      LEFT JOIN LATERAL (SELECT payload->'selectedComponentIds' AS members FROM app.v2_commands x WHERE x.operation IN ('RESERVE_COMPONENTS','RESERVE_LOCAL_RELEASE') AND x.status IN ('COMMITTED','LEDGER_COMMITTED_PROJECTION_PENDING') AND x.payload->>'reservationId'=c.payload->>'reservationId' AND jsonb_typeof(x.payload->'selectedComponentIds')='array' ORDER BY x.accepted_at LIMIT 1) rc ON c.payload ? 'reservationId'
      WHERE c.actor_institution_id=$1
      UNION ALL
      SELECT a.idempotency_key,'OFF_CHAIN_ACKNOWLEDGEMENT','ALERT_ACKNOWLEDGED_OFF_CHAIN','ALERT',NULL,NULL,a.correlation_id,NULL,NULL,a.acknowledged_at,NULL,a.actor_user_id,NULL,NULL,NULL,NULL,NULL,NULL,jsonb_build_array(a.component_id),
        a.actor_institution_id,NULL,NULL,NULL,NULL
      FROM app.v2_alert_acknowledgement_commands a WHERE a.actor_institution_id=$1
      UNION ALL
      -- V2 only: audited PRC coordination on this institution's own requests, including PRC's responses.
      SELECT au.audit_id,'PRC_SUPPLY_COORDINATION',au.action,'PRC_SUPPLY_REQUEST',NULL,NULL,au.correlation_id,NULL,NULL,au.created_at,NULL,au.actor_id,NULL,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,
        au.actor_institution_id,au.subject_id,au.prior_status,au.resulting_status,au.reason_code
      FROM app.account_audit au JOIN app.prc_supply_requests p ON p.request_id=au.subject_id
      WHERE $5::boolean AND au.action LIKE 'PRC_SUPPLY_%' AND p.requesting_institution_id=$1)
      SELECT e.*,${ACTOR_KIND} AS actor_kind,u.display_name AS actor_display_name,COALESCE(o.role_id,ra.role_id) AS actor_role_id
      FROM events e
      LEFT JOIN app.application_users u ON u.user_id=e.actor_user_id
      LEFT JOIN app.institution_operators o ON o.operator_id=e.actor_user_id
      LEFT JOIN app.user_role_assignments ra ON ra.user_id=e.actor_user_id
      WHERE ($2::timestamptz IS NULL OR (e.recorded_at,e.event_id)<($2::timestamptz,$3::text))
      ORDER BY e.recorded_at DESC,e.event_id DESC LIMIT $4`, [institutionId, cursor?.recordedAt ?? null, cursor?.eventId ?? null, limit + 1, includePrcCoordination]);
    const records: ActivityRecord[] = result.rows.slice(0, limit).map((row) => ({
      eventId: String(row.event_id), eventSource: String(row.event_source) as ActivityRecord["eventSource"], activityCode: String(row.activity_code), targetType: String(row.target_type),
      processingStatus: text(row.processing_status), safeErrorCode: text(row.safe_error_code), correlationId: String(row.correlation_id),
      ledgerTransactionId: text(row.ledger_transaction_id), ledgerCommittedAt: iso(row.ledger_committed_at), recordedAt: iso(row.recorded_at)!, commandEventTime: text(row.command_event_time),
      actorUserId: String(row.actor_user_id), actorKind: String(row.actor_kind) as ActivityRecord["actorKind"], actorDisplayName: text(row.actor_display_name), actorCurrentRoleId: text(row.actor_role_id),
      captureId: text(row.capture_id), captureMethod: text(row.capture_method), requestId: text(row.request_id), reservationId: text(row.reservation_id), reservationPurpose: text(row.reservation_purpose), localReleaseId: text(row.local_release_id),
      componentIds: Array.isArray(row.component_ids) ? row.component_ids.map(String) : [],
      actorInstitutionId: text(row.actor_institution_id), prcSupplyRequestId: text(row.prc_request_id),
      coordinationPriorStatus: text(row.prior_status), coordinationResultingStatus: text(row.resulting_status), coordinationReasonCode: text(row.reason_code),
    }));
    return { records, hasMore: result.rows.length > limit };
  }
}
