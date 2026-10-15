import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";

// ACTIVITY_HISTORY_READ_V1: the institution's audit trail, one row per independent event. Events are
// durable V2 commands and off-chain alert acknowledgements; links come only from recorded command
// fields and foreign-key projections, never from parsing prefixes or matching timestamps.
export const ACTIVITY_HISTORY_POLICY_VERSION = "ACTIVITY_HISTORY_READ_V1";
const CURSOR_PATTERN = /^ACT_[A-Za-z0-9_-]{1,140}$/;
const EVENT_ID = /^(CMD|IDEM)_[A-Z0-9_-]{1,59}$/;
const OCR_OPERATIONS = new Set(["REGISTER_INBOUND_COMPONENT", "RECEIVE_INBOUND_COMPONENT"]);
const LEDGER_COMMITTED = new Set(["COMMITTED", "LEDGER_COMMITTED_PROJECTION_PENDING"]);

export interface ActivityRecord {
  eventId: string;
  eventSource: "COMMAND" | "OFF_CHAIN_ACKNOWLEDGEMENT";
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
}

export interface ActivityHistoryReader {
  readActivityHistory(institutionId: string, limit: number, cursor: { recordedAt: string; eventId: string } | null): Promise<{ records: ActivityRecord[]; hasMore: boolean }>;
}

export function decodeActivityCursor(value: unknown): { recordedAt: string; eventId: string } | null {
  if (value === undefined) return null;
  const invalid = new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  if (typeof value !== "string" || !CURSOR_PATTERN.test(value)) throw invalid;
  const [recordedAt, eventId, extra] = Buffer.from(value.slice(4), "base64url").toString("utf8").split("|");
  if (extra !== undefined || !eventId || !EVENT_ID.test(eventId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(recordedAt ?? "") || new Date(recordedAt).toISOString() !== recordedAt) throw invalid;
  return { recordedAt, eventId };
}

function encodeActivityCursor(record: ActivityRecord): string {
  return `ACT_${Buffer.from(`${record.recordedAt}|${record.eventId}`, "utf8").toString("base64url")}`;
}

function eventStatus(record: ActivityRecord): string {
  if (record.eventSource === "OFF_CHAIN_ACKNOWLEDGEMENT") return "OFF_CHAIN_RECORDED";
  if (record.processingStatus === "COMMITTED") return "CONFIRMED";
  if (record.processingStatus === "LEDGER_COMMITTED_PROJECTION_PENDING" || record.processingStatus === "FAILED" || record.processingStatus === "CONFLICT") return record.processingStatus;
  return "PENDING";
}

export function assembleActivityHistory(records: ActivityRecord[], hasMore: boolean) {
  const rows = records.map((record) => {
    const offChain = record.eventSource === "OFF_CHAIN_ACKNOWLEDGEMENT";
    const committed = !offChain && record.processingStatus !== null && LEDGER_COMMITTED.has(record.processingStatus) && record.ledgerTransactionId !== null;
    // Inbound capture commands are created only by the confirmed-OCR route; older payloads omit captureMethod.
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
  });
  const last = records.at(-1);
  return { scope: "INSTITUTION" as const, rows, nextCursor: hasMore && last ? encodeActivityCursor(last) : null, policyVersion: ACTIVITY_HISTORY_POLICY_VERSION, classification: "SIMULATION_ONLY" as const };
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value === null || value === undefined ? null : String(value);
const iso = (value: unknown) => value === null || value === undefined ? null : new Date(String(value)).toISOString();
const ACTOR_KIND = `CASE WHEN o.operator_id IS NOT NULL THEN 'VERIFIED_OPERATOR' WHEN EXISTS (SELECT 1 FROM app.institution_operators a WHERE a.account_id=e.actor_user_id) THEN 'INSTITUTION_ACCOUNT' WHEN u.user_id IS NOT NULL THEN 'USER_ACCOUNT' ELSE 'UNKNOWN' END`;

export class PostgresActivityHistoryReader implements ActivityHistoryReader {
  constructor(private readonly pool: Pool) {}
  async readActivityHistory(institutionId: string, limit: number, cursor: { recordedAt: string; eventId: string } | null) {
    // Named payload keys only; encrypted Donation No. material in command payloads is never selected.
    const result = await this.pool.query<Row>(`WITH events AS (
      SELECT c.command_id AS event_id,'COMMAND' AS event_source,c.operation AS activity_code,c.resource_type AS target_type,c.status AS processing_status,c.safe_error_code,c.correlation_id,c.ledger_transaction_id,c.ledger_committed_at,c.accepted_at AS recorded_at,c.payload->>'eventTime' AS command_event_time,c.actor_user_id,
        c.payload->>'captureId' AS capture_id,c.payload->>'captureMethod' AS capture_method,COALESCE(c.payload->>'transferId',r.transfer_id) AS request_id,c.payload->>'reservationId' AS reservation_id,
        COALESCE(r.purpose,CASE c.operation WHEN 'RESERVE_COMPONENTS' THEN 'TRANSFER' WHEN 'RESERVE_LOCAL_RELEASE' THEN 'LOCAL_RELEASE' END) AS reservation_purpose,
        COALESCE(c.payload->>'localReleaseId',r.local_release_id) AS local_release_id,
        COALESCE(CASE WHEN jsonb_typeof(c.payload->'selectedComponentIds')='array' THEN c.payload->'selectedComponentIds' END,CASE WHEN c.payload ? 'componentId' THEN jsonb_build_array(c.payload->>'componentId') END,rc.members,'[]'::jsonb) AS component_ids
      FROM app.v2_commands c
      LEFT JOIN app.v2_reservations r ON r.reservation_id=c.payload->>'reservationId'
      LEFT JOIN LATERAL (SELECT payload->'selectedComponentIds' AS members FROM app.v2_commands x WHERE x.operation IN ('RESERVE_COMPONENTS','RESERVE_LOCAL_RELEASE') AND x.status IN ('COMMITTED','LEDGER_COMMITTED_PROJECTION_PENDING') AND x.payload->>'reservationId'=c.payload->>'reservationId' AND jsonb_typeof(x.payload->'selectedComponentIds')='array' ORDER BY x.accepted_at LIMIT 1) rc ON c.payload ? 'reservationId'
      WHERE c.actor_institution_id=$1
      UNION ALL
      SELECT a.idempotency_key,'OFF_CHAIN_ACKNOWLEDGEMENT','ALERT_ACKNOWLEDGED_OFF_CHAIN','ALERT',NULL,NULL,a.correlation_id,NULL,NULL,a.acknowledged_at,NULL,a.actor_user_id,NULL,NULL,NULL,NULL,NULL,NULL,jsonb_build_array(a.component_id)
      FROM app.v2_alert_acknowledgement_commands a WHERE a.actor_institution_id=$1)
      SELECT e.*,${ACTOR_KIND} AS actor_kind,u.display_name AS actor_display_name,COALESCE(o.role_id,ra.role_id) AS actor_role_id
      FROM events e
      LEFT JOIN app.application_users u ON u.user_id=e.actor_user_id
      LEFT JOIN app.institution_operators o ON o.operator_id=e.actor_user_id
      LEFT JOIN app.user_role_assignments ra ON ra.user_id=e.actor_user_id
      WHERE ($2::timestamptz IS NULL OR (e.recorded_at,e.event_id)<($2::timestamptz,$3::text))
      ORDER BY e.recorded_at DESC,e.event_id DESC LIMIT $4`, [institutionId, cursor?.recordedAt ?? null, cursor?.eventId ?? null, limit + 1]);
    const records: ActivityRecord[] = result.rows.slice(0, limit).map((row) => ({
      eventId: String(row.event_id), eventSource: String(row.event_source) as ActivityRecord["eventSource"], activityCode: String(row.activity_code), targetType: String(row.target_type),
      processingStatus: text(row.processing_status), safeErrorCode: text(row.safe_error_code), correlationId: String(row.correlation_id),
      ledgerTransactionId: text(row.ledger_transaction_id), ledgerCommittedAt: iso(row.ledger_committed_at), recordedAt: iso(row.recorded_at)!, commandEventTime: text(row.command_event_time),
      actorUserId: String(row.actor_user_id), actorKind: String(row.actor_kind) as ActivityRecord["actorKind"], actorDisplayName: text(row.actor_display_name), actorCurrentRoleId: text(row.actor_role_id),
      captureId: text(row.capture_id), captureMethod: text(row.capture_method), requestId: text(row.request_id), reservationId: text(row.reservation_id), reservationPurpose: text(row.reservation_purpose), localReleaseId: text(row.local_release_id),
      componentIds: Array.isArray(row.component_ids) ? row.component_ids.map(String) : [],
    }));
    return { records, hasMore: result.rows.length > limit };
  }
}
