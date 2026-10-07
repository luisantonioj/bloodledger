import type { Pool } from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebPrincipal } from "./session.js";
import { ApiFailure } from "./errors.js";

type Row = Record<string, unknown>;
export interface DevelopmentReader {
  read(kind: "dashboard" | "transfers" | "alerts" | "audit" | "historical", principal: WebPrincipal, id?: string, cursor?: string, limit?: number): Promise<unknown>;
  acknowledge(alertId: string, principal: WebPrincipal, idempotencyKey: string, correlationId: string): Promise<void>;
}
const classification = "SIMULATION_ONLY";
const iso = (value: unknown) => value == null ? null : new Date(String(value)).toISOString();
export class PostgresDevelopmentReader implements DevelopmentReader {
  constructor(private readonly pool: Pool) {}
  async read(kind: Parameters<DevelopmentReader["read"]>[0], principal: WebPrincipal, id?: string, cursor?: string, limit = 50): Promise<unknown> {
    const institution = principal.institutionId;
    if (kind === "historical") {
      if (institution !== "INST_MEDIATRIX" || !["ROLE-01", "ROLE-02"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Historical stock requires a Mediatrix inventory role.");
      if (!id) {
        const result = await this.pool.query<Row>(`SELECT snapshot_id,source_business_date,source_institution_id,workbook_sha256,manifest_sha256,status,expected_units,verified_units,ledger_transaction_id,block_number,validation_status,completed_at FROM app.synthetic_inventory_snapshots ORDER BY source_business_date DESC,snapshot_id LIMIT 100`);
        return { snapshots: result.rows, classification };
      }
      const snapshots = await this.pool.query<Row>(`SELECT snapshot_id,source_business_date,source_institution_id,workbook_sha256,manifest_sha256,status,expected_units,verified_units,ledger_transaction_id,block_number,validation_status,completed_at FROM app.synthetic_inventory_snapshots WHERE snapshot_id=$1`, [id]);
      if (!snapshots.rows[0]) throw new ApiFailure(404, "HISTORICAL_NOT_FOUND", "Snapshot not found.");
      const counts = await this.pool.query<Row>("SELECT series_key,blood_type,component_type,available_units,reserved_units,closing_units FROM app.synthetic_inventory_counts WHERE snapshot_id=$1 ORDER BY series_key", [id]);
      const units = await this.pool.query<Row>(`SELECT component_id,series_key,snapshot_status,allocation_group_id,original_reservation_purpose,collected_at,expires_at,ledger_transaction_id,block_number,validation_status,committed_at,provenance FROM app.synthetic_inventory_units WHERE snapshot_id=$1 AND ($2::text IS NULL OR component_id>$2) ORDER BY component_id LIMIT $3`, [id, cursor ?? null, limit + 1]);
      return { snapshot: snapshots.rows[0], counts: counts.rows, units: units.rows.slice(0, limit), nextCursor: units.rows.length > limit ? units.rows[limit - 1]?.component_id : null, evidence: "DATABASE_PROJECTION_OF_VERIFIED_LOCAL_FABRIC", classification };
    }
    if (!["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Operational component evidence requires an inventory or recipient role.");
    if (kind === "dashboard") {
      const result = await this.pool.query<Row>(`SELECT c.institution_id,i.display_name,c.blood_type,c.component_type,c.inventory_status,COUNT(*)::int AS count,MAX(c.updated_at) AS projected_at FROM app.v2_components c JOIN app.institutions i USING(institution_id) WHERE c.institution_id=$1 GROUP BY c.institution_id,i.display_name,c.blood_type,c.component_type,c.inventory_status`, [institution]);
      const pending = await this.pool.query<Row>("SELECT status,COUNT(*)::int AS count FROM app.v2_commands WHERE actor_institution_id=$1 AND status<>'COMMITTED' GROUP BY status", [institution]);
      return { composition: "OPERATIONAL", scope: "INSTITUTION", inventory: result.rows.map(r => ({ institutionId: r.institution_id, institutionDisplayName: r.display_name, bloodType: r.blood_type, component: r.component_type, inventoryStatus: r.inventory_status, confirmedCount: r.count, lastProjectedAt: iso(r.projected_at) })), pendingScans: pending.rows, lastSuccessfulProjectionAt: result.rows.map(r => iso(r.projected_at)).sort().at(-1) ?? null, classification };
    }
    if (kind === "transfers") {
      const requests = await this.pool.query<Row>("SELECT transfer_id,source_institution_id,destination_institution_id,blood_type,component_type,quantity,urgency,request_time,status,ledger_transaction_id FROM app.v2_transfer_requests WHERE source_institution_id=$1 OR destination_institution_id=$1 ORDER BY request_time DESC LIMIT 100", [institution]);
      const reservations = await this.pool.query<Row>(`SELECT r.reservation_id,r.purpose,r.transfer_id,r.status,r.version,r.prepared_at,r.institution_id,t.destination_institution_id FROM app.v2_reservations r LEFT JOIN app.v2_transfer_requests t USING(transfer_id) WHERE r.institution_id=$1 OR t.destination_institution_id=$1 ORDER BY r.reservation_id LIMIT 100`, [institution]);
      const timeline = await this.pool.query<Row>(`SELECT c.command_id,c.resource_id,c.operation,c.status,c.accepted_at,c.ledger_transaction_id,c.safe_error_code,c.ledger_result->>'blockNumber' AS block_number,c.ledger_result->>'validationStatus' AS validation_status FROM app.v2_commands c WHERE c.resource_type IN ('TRANSFER','LOCAL_RELEASE') AND (c.actor_institution_id=$1 OR c.payload->>'reservationId' IN (SELECT r.reservation_id FROM app.v2_reservations r JOIN app.v2_transfer_requests t USING(transfer_id) WHERE t.destination_institution_id=$1)) ORDER BY c.accepted_at,c.command_id LIMIT 200`, [institution]);
      return { requests: requests.rows, reservations: reservations.rows, timeline: timeline.rows, classification };
    }
    if (kind === "alerts") {
      const rows = await this.pool.query<Row>(`SELECT c.component_id,c.blood_type,c.component_type,c.expires_at,c.updated_at,EXISTS(SELECT 1 FROM app.v2_alert_acknowledgements a WHERE a.component_id=c.component_id AND a.actor_user_id=$2) AS acknowledged FROM app.v2_components c WHERE c.institution_id=$1 AND c.inventory_status='EXPIRED' ORDER BY c.component_id`, [institution, principal.userId]);
      return { scope: "INSTITUTION", alerts: rows.rows.map(r => ({ alertId: `V2EXP_${r.component_id}`, alertType: "EXPIRED", severity: "CRITICAL", unitId: r.component_id, bloodType: r.blood_type, component: r.component_type, expiresAt: iso(r.expires_at), evaluatedAt: iso(r.updated_at), status: "OPEN", acknowledged: r.acknowledged })), aggregates: [], nearExpiryEligibility: "DISABLED_UNAPPROVED_POLICY", evidence: "OFF_CHAIN_ALERT_FROM_LEDGER_PROJECTION", classification };
    }
    const rows = await this.pool.query<Row>(`SELECT c.command_id,c.operation,c.resource_type,c.status,c.safe_error_code,c.correlation_id,c.ledger_transaction_id,c.accepted_at,i.display_name FROM app.v2_commands c JOIN app.institutions i ON i.institution_id=c.actor_institution_id WHERE c.actor_institution_id=$1 ORDER BY c.accepted_at DESC,c.command_id DESC LIMIT 200`, [institution]);
    const acknowledgements = await this.pool.query<Row>("SELECT a.idempotency_key,a.correlation_id,a.acknowledged_at,i.display_name FROM app.v2_alert_acknowledgement_commands a JOIN app.institutions i ON i.institution_id=a.actor_institution_id WHERE a.actor_institution_id=$1 ORDER BY a.acknowledged_at DESC LIMIT 100", [institution]);
    const offChain = acknowledgements.rows.map(r => ({ auditEventId: r.idempotency_key, institutionDisplayName: r.display_name, actionCode: "ALERT_ACKNOWLEDGED_OFF_CHAIN", targetType: "ALERT", outcome: "ACKNOWLEDGED", safeErrorCode: null, correlationId: r.correlation_id, ledgerTransactionId: null, eventTime: iso(r.acknowledged_at) }));
    return { scope: "INSTITUTION", events: [...offChain, ...rows.rows.map(r => ({ auditEventId: r.command_id, institutionDisplayName: r.display_name, actionCode: r.operation, targetType: r.resource_type, outcome: r.status, safeErrorCode: r.safe_error_code, correlationId: r.correlation_id, ledgerTransactionId: r.ledger_transaction_id, eventTime: iso(r.accepted_at) }))], classification };
  }
  async acknowledge(alertId: string, principal: WebPrincipal, idempotencyKey: string, correlationId: string): Promise<void> {
    if (!["ROLE-01", "ROLE-02"].includes(principal.roleId) || !/^V2EXP_COMP_[A-Z0-9_-]{1,56}$/.test(alertId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Alert acknowledgement is not permitted.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [idempotencyKey]);
      const existing = await client.query<Row>("SELECT * FROM app.v2_alert_acknowledgement_commands WHERE idempotency_key=$1", [idempotencyKey]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.component_id !== alertId.slice(6) || row.actor_user_id !== principal.userId || row.actor_institution_id !== principal.institutionId || row.correlation_id !== correlationId) throw new ApiFailure(409, "ACKNOWLEDGEMENT_CONFLICT", "Idempotency key belongs to another acknowledgement.");
      } else {
        const component = await client.query("SELECT 1 FROM app.v2_components WHERE component_id=$1 AND institution_id=$2 AND inventory_status='EXPIRED' FOR SHARE", [alertId.slice(6), principal.institutionId]);
        if (!component.rowCount) throw new ApiFailure(404, "ALERT_NOT_FOUND", "Alert not found in this institution.");
        await client.query("INSERT INTO app.v2_alert_acknowledgements(component_id,actor_user_id,acknowledged_at,classification) VALUES($1,$2,now(),'SIMULATION_ONLY') ON CONFLICT DO NOTHING", [alertId.slice(6), principal.userId]);
        await client.query("INSERT INTO app.v2_alert_acknowledgement_commands VALUES($1,$2,$3,$4,$5,now(),'SIMULATION_ONLY')", [idempotencyKey, alertId.slice(6), principal.userId, principal.institutionId, correlationId]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
export function registerDevelopmentReads(app: FastifyInstance, reader: DevelopmentReader, restore: (request: FastifyRequest) => Promise<{ principal: WebPrincipal }>, webOrigin: string): void {
  for (const kind of ["dashboard", "transfers", "alerts", "audit", "historical"] as const) {
    const path = kind === "historical" ? "/api/v2/historical-snapshots" : `/api/v2/${kind}`;
    app.get(path, async request => reader.read(kind, (await restore(request)).principal));
  }
  app.get<{ Params: { snapshotId: string }; Querystring: { cursor?: string; limit?: string } }>("/api/v2/historical-snapshots/:snapshotId", async request => {
    const { snapshotId } = request.params; const { cursor, limit } = request.query;
    if (!/^HSNAP_[0-9A-F]{40}$/.test(snapshotId) || (cursor !== undefined && !/^HCOMP_[0-9A-F]{40}$/.test(cursor)) || (limit !== undefined && (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100))) throw new ApiFailure(400, "HISTORICAL_PAGE_INVALID", "Snapshot or page is invalid.");
    return reader.read("historical", (await restore(request)).principal, snapshotId, cursor, limit === undefined ? 50 : Number(limit));
  });
  app.post<{ Params: { alertId: string } }>("/api/v2/alerts/:alertId/acknowledge", async request => {
    if (request.headers.origin !== webOrigin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted.");
    const principal = (await restore(request)).principal;
    const key = request.headers["idempotency-key"]; const body = request.body as { correlationId?: unknown } | null;
    if (typeof key !== "string" || !/^IDEM_[A-Z0-9_-]{1,59}$/.test(key) || !body || Object.keys(body).length !== 1 || typeof body.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(body.correlationId)) throw new ApiFailure(400, "ACKNOWLEDGEMENT_INPUT_INVALID", "A valid idempotency key and correlation are required.");
    await reader.acknowledge(request.params.alertId, principal, key, body.correlationId);
    return { acknowledged: true, evidence: "OFF_CHAIN_ACKNOWLEDGEMENT", classification };
  });
}
