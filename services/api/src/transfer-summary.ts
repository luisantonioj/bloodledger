import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";

// TRANSFER_SUMMARY_READ_V1: one row per reservation (the custody workflow), joined to its own
// transfer request or local release and its committed allocation snapshot. A transfer request has at
// most one reservation (unique index), so no request is split or grouped across rows.
export const TRANSFER_SUMMARY_POLICY_VERSION = "TRANSFER_SUMMARY_READ_V1";
const CURSOR_PATTERN = /^TSUM_[A-Za-z0-9_-]{1,120}$/;
const RESERVATION_ID = /^RES_[A-Z0-9_-]{1,56}$/;
const NO_RESERVE_COMMAND = "1970-01-01T00:00:00.000Z";

export interface TransferSummaryRecord {
  reservationId: string;
  purpose: "TRANSFER" | "LOCAL_RELEASE";
  status: string;
  version: number;
  transferId: string | null;
  localReleaseId: string | null;
  sourceInstitutionId: string;
  sourceDisplayName: string;
  destinationInstitutionId: string | null;
  destinationDisplayName: string | null;
  requestStatus: string | null;
  urgency: string | null;
  requestBloodType: string | null;
  requestComponentType: string | null;
  requestQuantity: number | null;
  reservedAt: string | null;
  reserveBloodType: string | null;
  reserveComponentType: string | null;
  reserveQuantity: number | null;
  allocatedUnits: number | null;
  currentUnitStatus: Record<string, number>;
  sortKey: string;
}

export interface TransferSummaryReader {
  readTransferSummaries(institutionId: string, roleId: string, limit: number, cursor: { sortKey: string; reservationId: string } | null): Promise<{ records: TransferSummaryRecord[]; hasMore: boolean }>;
}

export function decodeSummaryCursor(value: unknown): { sortKey: string; reservationId: string } | null {
  if (value === undefined) return null;
  const invalid = new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  if (typeof value !== "string" || !CURSOR_PATTERN.test(value)) throw invalid;
  const [sortKey, reservationId, extra] = Buffer.from(value.slice(5), "base64url").toString("utf8").split("|");
  if (extra !== undefined || !reservationId || !RESERVATION_ID.test(reservationId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(sortKey ?? "") || new Date(sortKey).toISOString() !== sortKey) throw invalid;
  return { sortKey, reservationId };
}

function encodeSummaryCursor(record: TransferSummaryRecord): string {
  return `TSUM_${Buffer.from(`${record.sortKey}|${record.reservationId}`, "utf8").toString("base64url")}`;
}

export function assembleTransferSummaries(records: TransferSummaryRecord[], hasMore: boolean) {
  const rows = records.map((record) => {
    const transfer = record.purpose === "TRANSFER";
    // A transfer row takes product and requested units from its own request; a local release from its reserve command.
    const bloodType = transfer ? record.requestBloodType : record.reserveBloodType;
    const componentType = transfer ? record.requestComponentType : record.reserveComponentType;
    const requested = transfer ? record.requestQuantity : record.reserveQuantity;
    return {
      reservationId: record.reservationId,
      purpose: record.purpose,
      status: record.status,
      version: record.version,
      transferId: record.transferId,
      localReleaseId: record.localReleaseId,
      requestStatus: transfer ? record.requestStatus : null,
      urgency: transfer ? record.urgency : null,
      bloodType,
      componentType,
      productAvailability: bloodType && componentType ? "RECORDED" : "UNAVAILABLE",
      units: { requested, allocated: record.allocatedUnits, currentStatus: record.currentUnitStatus },
      source: { institutionId: record.sourceInstitutionId, displayName: record.sourceDisplayName },
      destination: transfer && record.destinationInstitutionId ? { institutionId: record.destinationInstitutionId, displayName: record.destinationDisplayName } : null,
      destinationApplicability: transfer ? (record.destinationInstitutionId ? "RECORDED" : "UNAVAILABLE") : "NOT_APPLICABLE",
      reservedAt: record.reservedAt,
    };
  });
  const last = records.at(-1);
  return { scope: "INSTITUTION" as const, rows, nextCursor: hasMore && last ? encodeSummaryCursor(last) : null, policyVersion: TRANSFER_SUMMARY_POLICY_VERSION, classification: "SIMULATION_ONLY" as const };
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value === null || value === undefined ? null : String(value);
const int = (value: unknown) => value === null || value === undefined ? null : Number(value);
const iso = (value: unknown) => value === null || value === undefined ? null : new Date(String(value)).toISOString();

export class PostgresTransferSummaryReader implements TransferSummaryReader {
  constructor(private readonly pool: Pool) {}
  async readTransferSummaries(institutionId: string, roleId: string, limit: number, cursor: { sortKey: string; reservationId: string } | null) {
    // Same scope as reservation reads: ROLE-03 sees inbound transfers; bank roles see their source and inbound rows.
    const scope = roleId === "ROLE-03" ? "t.destination_institution_id=$1" : "(r.institution_id=$1 OR t.destination_institution_id=$1)";
    const result = await this.pool.query<Row>(`WITH scoped AS (
      SELECT r.reservation_id,r.purpose,r.status,r.version,r.transfer_id,r.local_release_id,r.institution_id AS source_id,si.display_name AS source_name,t.destination_institution_id AS destination_id,di.display_name AS destination_name,t.status AS request_status,t.urgency,t.blood_type AS request_blood_type,t.component_type AS request_component_type,t.quantity AS request_quantity,rc.accepted_at AS reserved_at,rc.payload->>'bloodType' AS reserve_blood_type,rc.payload->>'componentType' AS reserve_component_type,rc.payload->>'quantity' AS reserve_quantity,rc.payload->'selectedComponentIds' AS members,COALESCE(rc.accepted_at,timestamptz '${NO_RESERVE_COMMAND}') AS sort_key
      FROM app.v2_reservations r
      JOIN app.institutions si ON si.institution_id=r.institution_id
      LEFT JOIN app.v2_transfer_requests t ON t.transfer_id=r.transfer_id
      LEFT JOIN app.institutions di ON di.institution_id=t.destination_institution_id
      LEFT JOIN LATERAL (SELECT accepted_at,payload FROM app.v2_commands WHERE operation IN ('RESERVE_COMPONENTS','RESERVE_LOCAL_RELEASE') AND status IN ('COMMITTED','LEDGER_COMMITTED_PROJECTION_PENDING') AND payload->>'reservationId'=r.reservation_id ORDER BY accepted_at LIMIT 1) rc ON true
      WHERE ${scope})
      SELECT s.*,CASE WHEN jsonb_typeof(s.members)='array' THEN jsonb_array_length(s.members) END AS allocated_units,
        (SELECT COALESCE(jsonb_object_agg(x.inventory_status,x.n),'{}'::jsonb) FROM (SELECT c.inventory_status,COUNT(*)::int AS n FROM app.v2_components c WHERE jsonb_typeof(s.members)='array' AND c.component_id IN (SELECT jsonb_array_elements_text(s.members)) GROUP BY 1) x) AS current_unit_status
      FROM scoped s WHERE ($2::timestamptz IS NULL OR (s.sort_key,s.reservation_id)<($2::timestamptz,$3::text))
      ORDER BY s.sort_key DESC,s.reservation_id DESC LIMIT $4`, [institutionId, cursor?.sortKey ?? null, cursor?.reservationId ?? null, limit + 1]);
    const records: TransferSummaryRecord[] = result.rows.slice(0, limit).map((row) => ({
      reservationId: String(row.reservation_id), purpose: String(row.purpose) as TransferSummaryRecord["purpose"], status: String(row.status), version: Number(row.version),
      transferId: text(row.transfer_id), localReleaseId: text(row.local_release_id),
      sourceInstitutionId: String(row.source_id), sourceDisplayName: String(row.source_name), destinationInstitutionId: text(row.destination_id), destinationDisplayName: text(row.destination_name),
      requestStatus: text(row.request_status), urgency: text(row.urgency), requestBloodType: text(row.request_blood_type), requestComponentType: text(row.request_component_type), requestQuantity: int(row.request_quantity),
      reservedAt: iso(row.reserved_at), reserveBloodType: text(row.reserve_blood_type), reserveComponentType: text(row.reserve_component_type), reserveQuantity: int(row.reserve_quantity),
      allocatedUnits: int(row.allocated_units), currentUnitStatus: (row.current_unit_status ?? {}) as Record<string, number>, sortKey: iso(row.sort_key)!,
    }));
    return { records, hasMore: result.rows.length > limit };
  }
}
