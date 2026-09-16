import type { Pool } from "pg";
import { createHash } from "node:crypto";
import { V2_1_COMPONENT_TYPES, V2_COMPONENT_TYPES, buildCensusSnapshot, censusTsv, type CensusInventoryRow, type CensusSnapshot, type V2BloodType, type V2ComponentType } from "./census.js";

export interface CensusStore {
  capture(institutionId: string, scheduledFor: Date, triggerType: "SCHEDULED" | "MANUAL", now: Date): Promise<CensusSnapshot>;
  get(snapshotId: string, institutionId?: string): Promise<CensusSnapshot | null>;
  copyRow(snapshotId: string, componentType: V2ComponentType, institutionId?: string): Promise<string | null>;
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
      const inserted = await client.query(`INSERT INTO app.v2_census_snapshots(snapshot_id,institution_id,scheduled_for,captured_at,timezone,report_policy_version,trigger_type,classification) VALUES($1,$2,$3,$4,'Asia/Manila',$5,$6,'SIMULATION_ONLY') ON CONFLICT(institution_id,scheduled_for,report_policy_version) DO NOTHING RETURNING snapshot_id`, [id, institutionId, scheduledFor.toISOString(), now.toISOString(), this.reportPolicyVersion, triggerType]);
      if (inserted.rowCount === 0) { await client.query("COMMIT"); return (await this.get(id, institutionId)) as CensusSnapshot; }
      const rows = await client.query<Record<string, unknown>>(`SELECT component_type,blood_type,inventory_status,COUNT(*)::int AS count,COUNT(*) FILTER (WHERE expires_at > $2)::int AS forecast_eligible_count FROM app.v2_components WHERE institution_id=$1 AND inventory_status IN ('AVAILABLE','RESERVED') GROUP BY component_type,blood_type,inventory_status`, [institutionId, now.toISOString()]);
      const useV21 = this.reportPolicyVersion.endsWith("V2_1");
      const snapshot = buildCensusSnapshot({ snapshotId: id, scheduledFor: scheduledFor.toISOString(), capturedAt: now.toISOString(), reportPolicyVersion: this.reportPolicyVersion, componentTypes: useV21 ? V2_1_COMPONENT_TYPES : V2_COMPONENT_TYPES, bloodTypeOrder: this.bloodTypeOrder, rows: rows.rows.map((row) => ({ componentType: String(row.component_type) as CensusInventoryRow["componentType"], bloodType: String(row.blood_type) as CensusInventoryRow["bloodType"], inventoryStatus: String(row.inventory_status), count: Number(row.count), forecastEligibleCount: Number(row.forecast_eligible_count) })) });
      for (const group of snapshot.groups) for (const bloodType of group.bloodTypes) await client.query("INSERT INTO app.v2_census_counts(snapshot_id,component_type,blood_type,available_count,reserved_count,forecast_eligible_available_count) VALUES($1,$2,$3,$4,$5,$6)", [id, group.componentType, bloodType.bloodType, bloodType.availableCount, bloodType.reservedCount, bloodType.forecastEligibleAvailableCount]);
      await client.query("UPDATE app.v2_census_snapshots SET source_projection_digest=$2 WHERE snapshot_id=$1", [id, snapshot.sourceProjectionDigest]);
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
