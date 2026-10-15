import type { Pool } from "pg";
import type { DonationKeyring } from "./donation-crypto.js";
import { ApiFailure } from "./errors.js";
import { resolveLabelIdentity, unavailableLabel, type LabelIdentity, type SealedDonationNumber } from "./label-identity.js";

// UNIT_HISTORY_READ_V1: institution-relative custody movements read from the durable V2 command
// record, the single source behind the command timeline and audit reads. One row per command and unit.
export const UNIT_HISTORY_POLICY_VERSION = "UNIT_HISTORY_READ_V1";

const EVENT_TYPES = {
  REGISTER_INBOUND_COMPONENT: { eventType: "INBOUND_REGISTERED", direction: "INBOUND" },
  REGISTER_COMPONENT: { eventType: "INBOUND_REGISTERED", direction: "INBOUND" },
  RECEIVE_INBOUND_COMPONENT: { eventType: "TRANSFER_RECEIVED", direction: "INBOUND" },
  RECEIVE_RESERVATION: { eventType: "TRANSFER_RECEIVED", direction: "INBOUND" },
  DISPATCH_RESERVATION: { eventType: "TRANSFER_DISPATCHED", direction: "OUTBOUND" },
  COMPLETE_LOCAL_RELEASE: { eventType: "LOCAL_RELEASE_COMPLETED", direction: "OUTBOUND" },
} as const;
export const UNIT_HISTORY_OPERATIONS = Object.keys(EVENT_TYPES) as readonly (keyof typeof EVENT_TYPES)[];
const RESERVATION_OPERATIONS = new Set(["RECEIVE_INBOUND_COMPONENT", "RECEIVE_RESERVATION", "DISPATCH_RESERVATION", "COMPLETE_LOCAL_RELEASE"]);
const LEDGER_COMMITTED = new Set(["COMMITTED", "LEDGER_COMMITTED_PROJECTION_PENDING"]);
const CURSOR_PATTERN = /^HIST_[A-Za-z0-9_-]{1,120}$/;
const COMMAND_ID = /^CMD_[A-Z0-9_-]{1,56}$/;

export interface HistoryCommandRecord {
  commandId: string;
  operation: string;
  status: string;
  acceptedAt: string;
  ledgerCommittedAt: string | null;
  ledgerTransactionId: string | null;
  blockNumber: string | null;
  validationStatus: string | null;
  safeErrorCode: string | null;
  eventTime: string | null;
  componentId: string | null;
  captureId: string | null;
  captureMethod: string | null;
  reservationId: string | null;
  bloodType: string | null;
  componentType: string | null;
}

export interface HistoryComponentRecord {
  componentId: string;
  bloodType: string;
  componentType: string;
  institutionId: string;
  sealed: SealedDonationNumber | null;
}

export interface UnitHistoryEvidence {
  commands: HistoryCommandRecord[];
  // Committed RESERVE_* selectedComponentIds snapshot; reservation reallocation is disabled.
  members: Map<string, string[]>;
  reservations: Map<string, { transferId: string | null; localReleaseId: string | null }>;
  components: Map<string, HistoryComponentRecord>;
  hasMore: boolean;
}

export interface UnitHistoryReader {
  readUnitHistory(institutionId: string, limit: number, cursor: { acceptedAt: string; commandId: string } | null): Promise<UnitHistoryEvidence>;
}

export function decodeHistoryCursor(value: unknown): { acceptedAt: string; commandId: string } | null {
  if (value === undefined) return null;
  const invalid = new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  if (typeof value !== "string" || !CURSOR_PATTERN.test(value)) throw invalid;
  const [acceptedAt, commandId, extra] = Buffer.from(value.slice(5), "base64url").toString("utf8").split("|");
  if (extra !== undefined || !commandId || !COMMAND_ID.test(commandId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(acceptedAt ?? "") || new Date(acceptedAt).toISOString() !== acceptedAt) throw invalid;
  return { acceptedAt, commandId };
}

export function encodeHistoryCursor(command: Pick<HistoryCommandRecord, "acceptedAt" | "commandId">): string {
  return `HIST_${Buffer.from(`${command.acceptedAt}|${command.commandId}`, "utf8").toString("base64url")}`;
}

function eventStatus(status: string): string {
  if (status === "COMMITTED") return "CONFIRMED";
  if (status === "LEDGER_COMMITTED_PROJECTION_PENDING") return "LEDGER_COMMITTED_PROJECTION_PENDING";
  if (status === "FAILED" || status === "CONFLICT") return status;
  return "PENDING";
}

export interface UnitHistoryRow {
  rowId: string;
  eventType: string;
  direction: "INBOUND" | "OUTBOUND";
  eventTime: string | null;
  acceptedAt: string;
  transactionId: string;
  scanId: string | null;
  method: "OCR" | "WEB_COMMAND" | null;
  links: { captureId: string | null; reservationId: string | null; transferId: string | null; localReleaseId: string | null };
  eventStatus: string;
  processingStatus: string;
  safeErrorCode: string | null;
  ledger: { status: "COMMITTED" | "NOT_COMMITTED"; transactionId: string | null; committedAt: string | null; blockNumber: string | null; validationStatus: string | null };
  unitMembership: "RECORDED" | "UNAVAILABLE";
  componentId: string | null;
  labelIdentity: LabelIdentity;
  bloodType: string | null;
  componentType: string | null;
  unitAttributesSource: "LEDGER_PROJECTION" | "PENDING_COMMAND" | null;
}

export function assembleUnitHistory(institutionId: string, evidence: UnitHistoryEvidence, keyring: DonationKeyring | undefined) {
  const rows = evidence.commands.flatMap((command): UnitHistoryRow[] => {
    const mapping = EVENT_TYPES[command.operation as keyof typeof EVENT_TYPES];
    if (!mapping) return [];
    const reservation = command.reservationId ? evidence.reservations.get(command.reservationId) : undefined;
    const isReservationEvent = RESERVATION_OPERATIONS.has(command.operation);
    const memberIds = isReservationEvent ? (command.reservationId ? evidence.members.get(command.reservationId) : undefined) : command.componentId ? [command.componentId] : undefined;
    const committed = LEDGER_COMMITTED.has(command.status);
    const scanned = command.captureMethod === "OCR" && command.captureId !== null;
    const shared: Omit<UnitHistoryRow, "rowId" | "unitMembership" | "componentId" | "labelIdentity" | "bloodType" | "componentType" | "unitAttributesSource"> = {
      eventType: mapping.eventType,
      direction: mapping.direction,
      eventTime: command.eventTime,
      acceptedAt: command.acceptedAt,
      transactionId: command.commandId,
      scanId: scanned ? command.captureId : null,
      method: scanned ? "OCR" : isReservationEvent ? "WEB_COMMAND" : null,
      links: { captureId: command.captureId, reservationId: command.reservationId, transferId: reservation?.transferId ?? null, localReleaseId: reservation?.localReleaseId ?? null },
      eventStatus: eventStatus(command.status),
      processingStatus: command.status,
      safeErrorCode: command.safeErrorCode,
      ledger: committed && command.ledgerTransactionId
        ? { status: "COMMITTED", transactionId: command.ledgerTransactionId, committedAt: command.ledgerCommittedAt, blockNumber: command.blockNumber, validationStatus: command.validationStatus }
        : { status: "NOT_COMMITTED", transactionId: null, committedAt: null, blockNumber: null, validationStatus: null },
    };
    if (!memberIds || memberIds.length === 0) {
      return [{ rowId: `${command.commandId}:UNAVAILABLE`, ...shared, unitMembership: "UNAVAILABLE", componentId: null, labelIdentity: unavailableLabel("NOT_RECORDED"), bloodType: null, componentType: null, unitAttributesSource: null }];
    }
    return memberIds.map((componentId) => {
      const component = evidence.components.get(componentId);
      // A label is shown when this institution held the unit at a ledger-committed event or holds it now.
      const labelIdentity: LabelIdentity = !component
        ? unavailableLabel(committed ? "NOT_RECORDED" : "NOT_COMMITTED")
        : committed || component.institutionId === institutionId
          ? resolveLabelIdentity(component.sealed ?? undefined, keyring)
          : unavailableLabel("NOT_COMMITTED");
      const fromCommand = !component && !isReservationEvent && command.bloodType && command.componentType;
      return {
        rowId: `${command.commandId}:${componentId}`,
        ...shared,
        unitMembership: "RECORDED",
        componentId,
        labelIdentity,
        bloodType: component?.bloodType ?? (fromCommand ? command.bloodType : null),
        componentType: component?.componentType ?? (fromCommand ? command.componentType : null),
        unitAttributesSource: component ? "LEDGER_PROJECTION" : fromCommand ? "PENDING_COMMAND" : null,
      };
    });
  });
  const last = evidence.commands.at(-1);
  return { scope: "INSTITUTION" as const, rows, nextCursor: evidence.hasMore && last ? encodeHistoryCursor(last) : null, policyVersion: UNIT_HISTORY_POLICY_VERSION, classification: "SIMULATION_ONLY" as const };
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value === null || value === undefined ? null : String(value);
const iso = (value: unknown) => value === null || value === undefined ? null : new Date(String(value)).toISOString();

export class PostgresUnitHistoryReader implements UnitHistoryReader {
  constructor(private readonly pool: Pool) {}
  async readUnitHistory(institutionId: string, limit: number, cursor: { acceptedAt: string; commandId: string } | null): Promise<UnitHistoryEvidence> {
    // Only named payload keys are selected; encrypted Donation No. material in the payload is never read here.
    const commandRows = await this.pool.query<Row>(`SELECT command_id,operation,status,accepted_at,ledger_committed_at,ledger_transaction_id,safe_error_code,ledger_result->>'blockNumber' AS block_number,ledger_result->>'validationStatus' AS validation_status,payload->>'eventTime' AS event_time,payload->>'componentId' AS component_id,payload->>'captureId' AS capture_id,payload->>'captureMethod' AS capture_method,payload->>'reservationId' AS reservation_id,payload->>'bloodType' AS blood_type,payload->>'componentType' AS component_type FROM app.v2_commands WHERE actor_institution_id=$1 AND operation=ANY($2::text[]) AND ($3::timestamptz IS NULL OR (accepted_at,command_id)<($3::timestamptz,$4::text)) ORDER BY accepted_at DESC,command_id DESC LIMIT $5`, [institutionId, [...UNIT_HISTORY_OPERATIONS], cursor?.acceptedAt ?? null, cursor?.commandId ?? null, limit + 1]);
    const commands: HistoryCommandRecord[] = commandRows.rows.slice(0, limit).map((row) => ({ commandId: String(row.command_id), operation: String(row.operation), status: String(row.status), acceptedAt: iso(row.accepted_at)!, ledgerCommittedAt: iso(row.ledger_committed_at), ledgerTransactionId: text(row.ledger_transaction_id), blockNumber: text(row.block_number), validationStatus: text(row.validation_status), safeErrorCode: text(row.safe_error_code), eventTime: text(row.event_time), componentId: text(row.component_id), captureId: text(row.capture_id), captureMethod: text(row.capture_method), reservationId: text(row.reservation_id), bloodType: text(row.blood_type), componentType: text(row.component_type) }));
    const reservationIds = [...new Set(commands.map((command) => command.reservationId).filter((id): id is string => id !== null))];
    const members = new Map<string, string[]>();
    const reservations = new Map<string, { transferId: string | null; localReleaseId: string | null }>();
    if (reservationIds.length > 0) {
      const memberRows = await this.pool.query<Row>(`SELECT DISTINCT payload->>'reservationId' AS reservation_id,member AS component_id FROM app.v2_commands,jsonb_array_elements_text(payload->'selectedComponentIds') AS member WHERE operation IN ('RESERVE_COMPONENTS','RESERVE_LOCAL_RELEASE') AND status IN ('COMMITTED','LEDGER_COMMITTED_PROJECTION_PENDING') AND payload->>'reservationId'=ANY($1::text[]) ORDER BY 1,2`, [reservationIds]);
      for (const row of memberRows.rows) members.set(String(row.reservation_id), [...(members.get(String(row.reservation_id)) ?? []), String(row.component_id)]);
      const reservationRows = await this.pool.query<Row>("SELECT reservation_id,transfer_id,local_release_id FROM app.v2_reservations WHERE reservation_id=ANY($1::text[])", [reservationIds]);
      for (const row of reservationRows.rows) reservations.set(String(row.reservation_id), { transferId: text(row.transfer_id), localReleaseId: text(row.local_release_id) });
    }
    const componentIds = [...new Set([...commands.map((command) => command.componentId), ...[...members.values()].flat()].filter((id): id is string => id !== null))];
    const components = new Map<string, HistoryComponentRecord>();
    if (componentIds.length > 0) {
      const componentRows = await this.pool.query<Row>(`SELECT c.component_id,c.blood_type,c.component_type,c.institution_id,c.capture_method,d.donation_number_ciphertext,d.donation_number_nonce,d.donation_number_auth_tag,d.donation_number_key_version FROM app.v2_components c LEFT JOIN app.v2_donations d ON d.donation_id=c.donation_id WHERE c.component_id=ANY($1::text[])`, [componentIds]);
      for (const row of componentRows.rows) components.set(String(row.component_id), { componentId: String(row.component_id), bloodType: String(row.blood_type), componentType: String(row.component_type), institutionId: String(row.institution_id), sealed: row.donation_number_ciphertext == null ? null : { ciphertext: String(row.donation_number_ciphertext), nonce: String(row.donation_number_nonce), authTag: String(row.donation_number_auth_tag), encryptionKeyVersion: String(row.donation_number_key_version), captureMethod: text(row.capture_method) } });
    }
    return { commands, members, reservations, components, hasMore: commandRows.rows.length > limit };
  }
}
