import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import { V2_1_COMPONENT_TYPES, V2_COMPONENT_TYPES, buildCensusSnapshot, censusTsv, type CensusInventoryRow, type CensusSnapshot, type V2BloodType, type V2ComponentType } from "./census.js";

export interface CensusStore {
  capture(institutionId: string, scheduledFor: Date, triggerType: "SCHEDULED" | "MANUAL", now: Date): Promise<CensusSnapshot>;
  get(snapshotId: string, institutionId?: string): Promise<CensusSnapshot | null>;
  copyRow(snapshotId: string, componentType: V2ComponentType, institutionId?: string): Promise<string | null>;
  list?(institutionId: string | undefined, limit: number, cursor?: string): Promise<{ snapshots: CensusSnapshotSummary[]; nextCursor: string | null; exportAvailable: boolean }>;
}

export interface CensusSnapshotSummary { snapshotId: string; institutionId: string; scheduledFor: string; capturedAt: string; reportPolicyVersion: string; triggerType: string; classification: "SIMULATION_ONLY"; }

export const INTERNAL_ML_SNAPSHOT_POLICY_VERSION = "INTERVIEW_ML_INVENTORY_SNAPSHOT_V1";
export const INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION = "BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1";

export interface MlInventorySnapshot extends CensusSnapshot {
  institutionId: string;
  snapshotKind: "INTERNAL_ML";
  schemaVersion: typeof INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION;
  projectionWatermark: number;
}

function snapshotId(institutionId: string, scheduledFor: Date, policyVersion: string): string { return `CENSUS_${createHash("sha256").update(`${institutionId}|${scheduledFor.toISOString()}|${policyVersion}`, "utf8").digest("hex").toUpperCase().slice(0, 40)}`; }

export class PostgresCensusStore implements CensusStore {
  constructor(private readonly pool: Pool, private readonly reportPolicyVersion: string, private readonly bloodTypeOrder?: readonly V2BloodType[]) {}
  async capture(institutionId: string, scheduledFor: Date, triggerType: "SCHEDULED" | "MANUAL", now: Date): Promise<CensusSnapshot> {
    if (!this.bloodTypeOrder) throw new Error("DISABLED_UNAPPROVED_REPORT_FORMAT");
    const id = snapshotId(institutionId, scheduledFor, this.reportPolicyVersion);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`CENSUS|${institutionId}|${scheduledFor.toISOString()}|${this.reportPolicyVersion}`]);
      const rows = await client.query<Record<string, unknown>>(`SELECT component_type,blood_type,inventory_status,COUNT(*)::int AS count,COUNT(*) FILTER (WHERE expires_at > $2)::int AS forecast_eligible_count FROM app.v2_components WHERE institution_id=$1 AND inventory_status IN ('AVAILABLE','RESERVED') GROUP BY component_type,blood_type,inventory_status`, [institutionId, now.toISOString()]);
      const useV21 = this.reportPolicyVersion.endsWith("V2_1");
      const snapshot = buildCensusSnapshot({ snapshotId: id, scheduledFor: scheduledFor.toISOString(), capturedAt: now.toISOString(), reportPolicyVersion: this.reportPolicyVersion, componentTypes: useV21 ? V2_1_COMPONENT_TYPES : V2_COMPONENT_TYPES, bloodTypeOrder: this.bloodTypeOrder, rows: rows.rows.map((row) => ({ componentType: String(row.component_type) as CensusInventoryRow["componentType"], bloodType: String(row.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: String(row.inventory_status), count: Number(row.count), forecastEligibleCount: Number(row.forecast_eligible_count) })) });
      const inserted = await client.query(`INSERT INTO app.v2_census_snapshots(snapshot_id,institution_id,scheduled_for,captured_at,timezone,report_policy_version,trigger_type,classification,source_projection_digest) VALUES($1,$2,$3,$4,'Asia/Manila',$5,$6,'SIMULATION_ONLY',$7) ON CONFLICT(institution_id,scheduled_for,report_policy_version) DO NOTHING RETURNING snapshot_id`, [id, institutionId, scheduledFor.toISOString(), now.toISOString(), this.reportPolicyVersion, triggerType, snapshot.sourceProjectionDigest]);
      if (inserted.rowCount === 0) {
        const existing = await client.query<Record<string, unknown>>("SELECT source_projection_digest FROM app.v2_census_snapshots WHERE snapshot_id=$1 AND institution_id=$2", [id, institutionId]);
        if (!existing.rows[0] || String(existing.rows[0].source_projection_digest) !== snapshot.sourceProjectionDigest) throw new Error("CENSUS_SNAPSHOT_CONFLICT");
        await client.query("COMMIT");
        return (await this.get(id, institutionId)) as CensusSnapshot;
      }
      for (const group of snapshot.groups) for (const bloodType of group.bloodTypes) await client.query("INSERT INTO app.v2_census_counts(snapshot_id,component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count) VALUES($1,$2,$3,$4,$5,$6)", [id, group.componentType, bloodType.bloodType, bloodType.availableCount, bloodType.reservedCount, bloodType.forecastEligibleAvailableCount]);
      await client.query("COMMIT"); return snapshot;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async get(snapshotIdValue: string, institutionId?: string): Promise<CensusSnapshot | null> {
    const result = await this.pool.query<Record<string, unknown>>("SELECT snapshot_id,institution_id,scheduled_for,captured_at,report_policy_version,source_projection_digest FROM app.v2_census_snapshots WHERE snapshot_id=$1 AND ($2::text IS NULL OR institution_id=$2)", [snapshotIdValue, institutionId ?? null]);
    const row = result.rows[0]; if (!row || !this.bloodTypeOrder) return null;
    const counts = await this.pool.query<Record<string, unknown>>("SELECT component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count,reportable_count FROM app.v2_census_counts WHERE snapshot_id=$1 ORDER BY component_type,blood_type", [snapshotIdValue]);
    const rows: CensusInventoryRow[] = counts.rows.map((item) => ({ componentType: String(item.component_type) as CensusInventoryRow["componentType"], bloodType: String(item.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: "AVAILABLE", count: Number(item.available_count), forecastEligibleCount: Number(item.forecast_eligible_available_count) }));
    for (const item of counts.rows) rows.push({ componentType: String(item.component_type) as CensusInventoryRow["componentType"], bloodType: String(item.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: "RESERVED", count: Number(item.reserved_count) });
    return buildCensusSnapshot({ snapshotId: String(row.snapshot_id), scheduledFor: new Date(String(row.scheduled_for)).toISOString(), capturedAt: new Date(String(row.captured_at)).toISOString(), reportPolicyVersion: String(row.report_policy_version), sourceProjectionDigest: row.source_projection_digest ? String(row.source_projection_digest) : undefined, componentTypes: String(row.report_policy_version).endsWith("V2_1") ? V2_1_COMPONENT_TYPES : V2_COMPONENT_TYPES, bloodTypeOrder: this.bloodTypeOrder, rows });
  }
  async copyRow(snapshotIdValue: string, componentType: V2ComponentType, institutionId?: string): Promise<string | null> { const snapshot = await this.get(snapshotIdValue, institutionId); return snapshot ? censusTsv(snapshot, componentType) : null; }
  async list(institutionId: string | undefined, limit: number, cursor?: string): Promise<{ snapshots: CensusSnapshotSummary[]; nextCursor: string | null; exportAvailable: boolean }> {
    const conditions: string[] = []; const values: unknown[] = [];
    if (institutionId) { values.push(institutionId); conditions.push(`institution_id=$${values.length}`); }
    if (cursor) { values.push(cursor); conditions.push(`snapshot_id>$${values.length}`); }
    values.push(limit + 1);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.pool.query<Record<string, unknown>>(`SELECT snapshot_id,institution_id,scheduled_for,captured_at,report_policy_version,trigger_type FROM app.v2_census_snapshots ${where} ORDER BY snapshot_id LIMIT $${values.length}`, values);
    const hasMore = result.rows.length > limit;
    const snapshots = result.rows.slice(0, limit).map((row) => ({ snapshotId:String(row.snapshot_id), institutionId:String(row.institution_id), scheduledFor:new Date(String(row.scheduled_for)).toISOString(), capturedAt:new Date(String(row.captured_at)).toISOString(), reportPolicyVersion:String(row.report_policy_version), triggerType:String(row.trigger_type), classification:"SIMULATION_ONLY" as const }));
    return { snapshots, nextCursor: hasMore ? snapshots.at(-1)?.snapshotId ?? null : null, exportAvailable: this.bloodTypeOrder !== undefined };
  }
}

/** Internal ML evidence is deliberately separate from the DOH report policy. */
type PendingCommandRow = { command_id: string; operation: string; actor_institution_id: string; payload: unknown };

const INSTITUTION_ID = /^INST_[A-Z0-9_-]{1,59}$/;
const PENDING_PROJECTION_STATUSES = ["QUEUED", "SUBMITTING", "LEDGER_COMMITTED_PROJECTION_PENDING", "RETRY_WAIT"] as const;
const PROJECTION_OPERATIONS = new Set([
  "REGISTER_COMPONENT", "REGISTER_INBOUND_COMPONENT", "RECEIVE_INBOUND_COMPONENT",
  "RESERVE_COMPONENTS", "RESERVE_LOCAL_RELEASE", "PREPARE_RESERVATION",
  "DISPATCH_RESERVATION", "START_RESERVATION_TRANSIT", "RECEIVE_RESERVATION",
  "COMPLETE_LOCAL_RELEASE", "CANCEL_RESERVATION", "PLACE_RECONCILIATION_HOLD",
  "RESOLVE_RECONCILIATION_HOLD", "EVALUATE_COMPONENT_EXPIRY", "COMPROMISE_RESERVATION",
  "SUBMIT_TRANSFER",
]);

function payloadObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function addInstitution(value: unknown, affected: Set<string>): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string" || !INSTITUTION_ID.test(value)) return false;
  affected.add(value);
  return true;
}

function optionalReference(payload: Record<string, unknown>, key: string): string | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
  return value;
}

/**
 * Return all institutions a pending command can change. The actor is always
 * included, while source/destination and persisted custody records widen the
 * scope for cross-institution commands. Unknown references fail closed.
 */
async function pendingCommandAffectsInstitution(client: PoolClient, row: PendingCommandRow, institutionId: string): Promise<boolean> {
  const payload = payloadObject(row.payload);
  if (!payload || !INSTITUTION_ID.test(row.actor_institution_id) || !PROJECTION_OPERATIONS.has(row.operation)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
  const affected = new Set<string>([row.actor_institution_id]);
  for (const key of ["sourceInstitutionId", "destinationInstitutionId", "custodyInstitutionId", "institutionId"]) {
    if (!addInstitution(payload[key], affected)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
  }

  const componentIds = new Set<string>();
  const componentId = optionalReference(payload, "componentId");
  if (componentId) componentIds.add(componentId);
  if (Array.isArray(payload.selectedComponentIds)) {
    for (const value of payload.selectedComponentIds) {
      if (typeof value !== "string") throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
      componentIds.add(value);
    }
  } else if (payload.selectedComponentIds !== undefined) {
    throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
  }
  for (const componentId of componentIds) {
    const result = await client.query<{ institution_id: string }>("SELECT institution_id FROM app.v2_components WHERE component_id=$1", [componentId]);
    if (!result.rows[0]) {
      // Registration commands reference a component that has not projected yet;
      // their explicit custody/source scope is the authoritative impact.
      if (!["REGISTER_COMPONENT", "REGISTER_INBOUND_COMPONENT"].includes(row.operation) || !["custodyInstitutionId", "sourceInstitutionId", "institutionId"].some((key) => affected.has(String(payload[key])))) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
      continue;
    }
    if (!addInstitution(result.rows[0].institution_id, affected)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
  }

  const reservationId = optionalReference(payload, "reservationId");
  if (reservationId) {
    const reservation = await client.query<{ institution_id: string }>("SELECT institution_id FROM app.v2_reservations WHERE reservation_id=$1", [reservationId]);
    if (reservation.rows[0]) {
      if (!addInstitution(reservation.rows[0].institution_id, affected)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
      const reservedComponents = await client.query<{ institution_id: string }>("SELECT DISTINCT institution_id FROM app.v2_components WHERE reservation_id=$1", [reservationId]);
      for (const component of reservedComponents.rows) if (!addInstitution(component.institution_id, affected)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
    } else if (!payload.sourceInstitutionId && componentIds.size === 0) {
      throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
    }
  }

  const transferId = optionalReference(payload, "transferId");
  if (transferId) {
    const transfer = await client.query<{ source_institution_id: string; destination_institution_id: string }>("SELECT source_institution_id,destination_institution_id FROM app.v2_transfer_requests WHERE transfer_id=$1", [transferId]);
    if (transfer.rows[0]) {
      if (!addInstitution(transfer.rows[0].source_institution_id, affected) || !addInstitution(transfer.rows[0].destination_institution_id, affected)) throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
    } else if (!payload.sourceInstitutionId || !payload.destinationInstitutionId) {
      throw new Error("ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED");
    }
  }
  return affected.has(institutionId);
}

export class PostgresMlInventorySnapshotStore {
  constructor(private readonly pool: Pool, private readonly bloodTypeOrder: readonly V2BloodType[] = [
    "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
    "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
  ]) {}

  async capture(institutionId: string, scheduledFor: Date, _triggerType: "SCHEDULED" | "MANUAL", now: Date): Promise<MlInventorySnapshot> {
    const id = snapshotId(institutionId, scheduledFor, INTERNAL_ML_SNAPSHOT_POLICY_VERSION);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`ML_SNAPSHOT|${institutionId}|${scheduledFor.toISOString()}`]);
      const pending = await client.query<PendingCommandRow>("SELECT command_id,operation,actor_institution_id,payload FROM app.v2_commands WHERE status = ANY($1::text[])", [PENDING_PROJECTION_STATUSES]);
      for (const command of pending.rows) {
        if (await pendingCommandAffectsInstitution(client, command, institutionId)) throw new Error("ML_SNAPSHOT_PROJECTION_PENDING");
      }
      const rows = await client.query<Record<string, unknown>>(`SELECT component_type,blood_type,inventory_status,COUNT(*)::int AS count,COUNT(*) FILTER (WHERE expires_at > $2)::int AS forecast_eligible_count,MAX(ledger_version)::bigint AS ledger_version FROM app.v2_components WHERE institution_id=$1 AND inventory_status IN ('AVAILABLE','RESERVED') GROUP BY component_type,blood_type,inventory_status`, [institutionId, now.toISOString()]);
      const watermark = rows.rows.reduce((max, row) => Math.max(max, Number(row.ledger_version ?? 0)), 0);
      const snapshot = buildCensusSnapshot({ snapshotId: id, scheduledFor: scheduledFor.toISOString(), capturedAt: now.toISOString(), reportPolicyVersion: INTERNAL_ML_SNAPSHOT_POLICY_VERSION, componentTypes: V2_1_COMPONENT_TYPES, bloodTypeOrder: this.bloodTypeOrder, rows: rows.rows.map((row) => ({ componentType: String(row.component_type) as CensusInventoryRow["componentType"], bloodType: String(row.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: String(row.inventory_status), count: Number(row.count), forecastEligibleCount: Number(row.forecast_eligible_count) })) });
      const existing = await client.query<Record<string, unknown>>("SELECT source_projection_digest FROM app.ml_inventory_snapshots WHERE snapshot_id=$1 AND institution_id=$2", [id, institutionId]);
      if (existing.rows[0]) {
        if (String(existing.rows[0].source_projection_digest) !== snapshot.sourceProjectionDigest) throw new Error("ML_SNAPSHOT_CONFLICT");
        await client.query("COMMIT");
        return (await this.get(id, institutionId)) as MlInventorySnapshot;
      }
      await client.query("INSERT INTO app.ml_inventory_snapshots(snapshot_id,institution_id,scheduled_for,captured_at,timezone,snapshot_kind,policy_version,schema_version,projection_watermark,source_projection_digest,classification) VALUES($1,$2,$3,$4,'Asia/Manila','INTERNAL_ML',$5,$6,$7,$8,'SIMULATION_ONLY')", [id, institutionId, scheduledFor.toISOString(), now.toISOString(), INTERNAL_ML_SNAPSHOT_POLICY_VERSION, INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION, watermark, snapshot.sourceProjectionDigest]);
      for (const group of snapshot.groups) for (const bloodType of group.bloodTypes) await client.query("INSERT INTO app.ml_inventory_snapshot_counts(snapshot_id,component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count,reportable_count) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, group.componentType, bloodType.bloodType, bloodType.availableCount, bloodType.reservedCount, bloodType.forecastEligibleAvailableCount, bloodType.reportableCount]);
      await client.query("COMMIT");
      return { ...snapshot, institutionId, snapshotKind: "INTERNAL_ML", schemaVersion: INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION, projectionWatermark: watermark };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async get(snapshotIdValue: string, institutionId: string): Promise<MlInventorySnapshot | null> {
    if (!INSTITUTION_ID.test(institutionId)) throw new Error("ML_SNAPSHOT_INSTITUTION_INVALID");
    const result = await this.pool.query<Record<string, unknown>>("SELECT snapshot_id,institution_id,scheduled_for,captured_at,policy_version,schema_version,projection_watermark,source_projection_digest FROM app.ml_inventory_snapshots WHERE snapshot_id=$1 AND institution_id=$2", [snapshotIdValue, institutionId]);
    const row = result.rows[0];
    if (!row) return null;
    const counts = await this.pool.query<Record<string, unknown>>("SELECT component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count FROM app.ml_inventory_snapshot_counts WHERE snapshot_id=$1 ORDER BY component_type,blood_type", [snapshotIdValue]);
    const rows: CensusInventoryRow[] = counts.rows.map((item) => ({ componentType: String(item.component_type) as CensusInventoryRow["componentType"], bloodType: String(item.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: "AVAILABLE", count: Number(item.available_count), forecastEligibleCount: Number(item.forecast_eligible_available_count) }));
    for (const item of counts.rows) rows.push({ componentType: String(item.component_type) as CensusInventoryRow["componentType"], bloodType: String(item.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: "RESERVED", count: Number(item.reserved_count) });
    const storedDigest = String(row.source_projection_digest);
    const snapshotInput = { snapshotId: String(row.snapshot_id), scheduledFor: new Date(String(row.scheduled_for)).toISOString(), capturedAt: new Date(String(row.captured_at)).toISOString(), reportPolicyVersion: String(row.policy_version), componentTypes: V2_1_COMPONENT_TYPES, bloodTypeOrder: this.bloodTypeOrder, rows };
    const recomputed = buildCensusSnapshot(snapshotInput);
    if (recomputed.sourceProjectionDigest !== storedDigest) throw new Error("ML_SNAPSHOT_DIGEST_MISMATCH");
    return { ...recomputed, sourceProjectionDigest: storedDigest, institutionId: String(row.institution_id), snapshotKind: "INTERNAL_ML", schemaVersion: String(row.schema_version) as typeof INTERNAL_ML_SNAPSHOT_SCHEMA_VERSION, projectionWatermark: Number(row.projection_watermark) };
  }

  async copyRow(snapshotIdValue: string, componentType: V2ComponentType, institutionId: string): Promise<string | null> {
    const snapshot = await this.get(snapshotIdValue, institutionId);
    return snapshot ? censusTsv(snapshot, componentType) : null;
  }
}

export class CensusWorker {
  constructor(private readonly store: CensusStore, private readonly institutionIds: readonly string[]) {}
  async runSlot(scheduledFor: Date, now = new Date()): Promise<CensusSnapshot[]> { const snapshots: CensusSnapshot[] = []; for (const institutionId of this.institutionIds) snapshots.push(await this.store.capture(institutionId, scheduledFor, "SCHEDULED", now)); return snapshots; }
  async runDueSlots(now = new Date()): Promise<CensusSnapshot[]> {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const slots = [9, 16].map((hour) => new Date(`${values.year}-${values.month}-${values.day}T${String(hour).padStart(2, "0")}:00:00.000+08:00`));
    const due = slots.filter((slot) => now.getTime() >= slot.getTime());
    const snapshots: CensusSnapshot[] = [];
    for (const slot of due) snapshots.push(...await this.runSlot(slot, now));
    return snapshots;
  }
}
