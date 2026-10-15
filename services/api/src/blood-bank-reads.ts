import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";
import { nullableIsoTimestamp } from "./time.js";
import type { WebPrincipal } from "./session.js";

// ADR-046 blood-bank completion reads. All are SIMULATION_ONLY, complete aggregates (never capped lists),
// and carry their own read time. None changes inventory, request or ledger state.
export const BLOOD_BANK_SUMMARY_POLICY_VERSION = "BLOOD_BANK_SUMMARY_V1";
export const NETWORK_AVAILABILITY_POLICY_VERSION = "NETWORK_AVAILABILITY_V1";
export const REQUEST_HISTORY_POLICY_VERSION = "REQUEST_HISTORY_AGGREGATE_V1";
const BANK_ROLES = ["ROLE-01", "ROLE-02"];
const NETWORK_ROLES = ["ROLE-01", "ROLE-02", "ROLE-03"];
const MAX_HISTORY_DAYS = 366;

export interface BloodBankReader {
  summary(institutionId: string, now: Date): Promise<Record<string, unknown>>;
  networkAvailability(now: Date): Promise<Record<string, unknown>[]>;
  requestHistory(institutionId: string, from: string, to: string): Promise<Record<string, unknown>[]>;
}

function requireRoles(principal: WebPrincipal, roles: readonly string[], message: string): void {
  if (!roles.includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", message);
}

export function blockedExpiringSoon() {
  // RQ-03: no approved near-expiry threshold. Display bands in the inventory table do not define this count.
  return { availability: "POLICY_BLOCKED" as const, count: null, blocker: "RQ-03" };
}

export function assembleSummary(row: Record<string, unknown>, now: Date) {
  const count = (key: string) => Number(row[key] ?? 0);
  return {
    scope: "INSTITUTION" as const,
    asOf: now.toISOString(),
    inventory: {
      // Label-current units in the ledger projection; label-expired stock is counted separately.
      available: count("available"),
      reserved: count("reserved"),
      labelExpiredPendingEvaluation: count("label_expired_pending"),
      lastProjectedAt: nullableIsoTimestamp(row.last_projected_at),
    },
    requests: {
      // PENDING requests with no reservation; approval records the request's single reservation.
      incomingAwaitingDecision: count("incoming_awaiting"),
      outgoingAwaitingDecision: count("outgoing_awaiting"),
    },
    expiringSoon: blockedExpiringSoon(),
    policyVersion: BLOOD_BANK_SUMMARY_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}

export function assembleNetworkAvailability(rows: Record<string, unknown>[], now: Date) {
  return {
    scope: "CITY_AGGREGATE" as const,
    asOf: now.toISOString(),
    // Each row is one institution × blood type × component that currently holds label-current AVAILABLE stock.
    // An absent combination means no such unit is recorded, not unknown; coverage is all institutions in the projection.
    rows: rows.map((row) => ({
      institutionId: String(row.institution_id),
      institutionDisplayName: String(row.display_name),
      bloodType: String(row.blood_type),
      componentType: String(row.component_type),
      availableUnits: Number(row.available_units),
      lastProjectedAt: nullableIsoTimestamp(row.last_projected_at),
    })),
    policyVersion: NETWORK_AVAILABILITY_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}

export function parseHistoryRange(from: unknown, to: unknown): { from: string; to: string } {
  const invalid = () => new ApiFailure(400, "REQUEST_HISTORY_RANGE_INVALID", "Use from and to as YYYY-MM-DD (Asia/Manila), at most 366 days, from on or before to.");
  const date = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw invalid();
    return value;
  };
  const start = date(from), end = date(to);
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  if (days < 0 || days >= MAX_HISTORY_DAYS) throw invalid();
  return { from: start, to: end };
}

export function assembleRequestHistory(institutionId: string, range: { from: string; to: string }, rows: Record<string, unknown>[], now: Date) {
  return {
    scope: "INSTITUTION" as const,
    asOf: now.toISOString(),
    range: { ...range, timeZone: "Asia/Manila" },
    // Complete within the range: every recorded V2 request where this institution is the supplier (INCOMING)
    // or the requester (OUTGOING). Requested units are not received or transfused units. Departments are not recorded.
    rows: rows.map((row) => ({
      requestDate: String(row.request_date),
      direction: String(row.source_institution_id) === institutionId ? "INCOMING" as const : "OUTGOING" as const,
      bloodType: String(row.blood_type),
      componentType: String(row.component_type),
      urgency: String(row.urgency),
      requestCount: Number(row.request_count),
      requestedUnits: Number(row.requested_units),
    })),
    departmentAvailability: "NOT_RECORDED" as const,
    policyVersion: REQUEST_HISTORY_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}

export class PostgresBloodBankReader implements BloodBankReader {
  constructor(private readonly pool: Pool) {}
  async summary(institutionId: string, now: Date) {
    const result = await this.pool.query(`SELECT
      (SELECT count(*) FROM app.v2_components WHERE institution_id=$1 AND inventory_status='AVAILABLE' AND expires_at>$2)::int AS available,
      (SELECT count(*) FROM app.v2_components WHERE institution_id=$1 AND inventory_status='RESERVED' AND expires_at>$2)::int AS reserved,
      (SELECT count(*) FROM app.v2_components WHERE institution_id=$1 AND inventory_status IN ('AVAILABLE','RESERVED') AND expires_at<=$2)::int AS label_expired_pending,
      (SELECT max(updated_at) FROM app.v2_components WHERE institution_id=$1) AS last_projected_at,
      (SELECT count(*) FROM app.v2_transfer_requests t WHERE t.source_institution_id=$1 AND t.status='PENDING' AND NOT EXISTS (SELECT 1 FROM app.v2_reservations r WHERE r.transfer_id=t.transfer_id))::int AS incoming_awaiting,
      (SELECT count(*) FROM app.v2_transfer_requests t WHERE t.destination_institution_id=$1 AND t.status='PENDING' AND NOT EXISTS (SELECT 1 FROM app.v2_reservations r WHERE r.transfer_id=t.transfer_id))::int AS outgoing_awaiting`, [institutionId, now]);
    return result.rows[0] as Record<string, unknown>;
  }
  async networkAvailability(now: Date) {
    const result = await this.pool.query(`SELECT c.institution_id,i.display_name,c.blood_type,c.component_type,count(*)::int AS available_units,
        (SELECT max(x.updated_at) FROM app.v2_components x WHERE x.institution_id=c.institution_id) AS last_projected_at
      FROM app.v2_components c JOIN app.institutions i ON i.institution_id=c.institution_id
      WHERE c.inventory_status='AVAILABLE' AND c.expires_at>$1 AND i.status='ACTIVE'
      GROUP BY c.institution_id,i.display_name,c.blood_type,c.component_type
      ORDER BY i.display_name,c.blood_type,c.component_type`, [now]);
    return result.rows as Record<string, unknown>[];
  }
  async requestHistory(institutionId: string, from: string, to: string) {
    const result = await this.pool.query(`SELECT to_char(t.request_time AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS request_date,t.source_institution_id,t.blood_type,t.component_type,t.urgency,
        count(*)::int AS request_count,sum(t.quantity)::int AS requested_units
      FROM app.v2_transfer_requests t
      WHERE (t.source_institution_id=$1 OR t.destination_institution_id=$1)
        AND (t.request_time AT TIME ZONE 'Asia/Manila')::date BETWEEN $2::date AND $3::date
      GROUP BY 1,2,3,4,5 ORDER BY 1,2,3,4,5`, [institutionId, from, to]);
    return result.rows as Record<string, unknown>[];
  }
}

export function bloodBankRoutes(principal: WebPrincipal) {
  return {
    summary: () => requireRoles(principal, BANK_ROLES, "The blood-bank summary requires a blood-bank inventory role."),
    network: () => requireRoles(principal, NETWORK_ROLES, "City-wide availability is read here by hospital roles; regulators use their aggregate reports."),
    history: () => requireRoles(principal, BANK_ROLES, "Request history requires a blood-bank inventory role."),
  };
}
