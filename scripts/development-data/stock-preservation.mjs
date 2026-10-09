// Private row values are hashed in memory; evidence contains digests only.
import { digest } from './scenario.mjs';
import { assertPreserved, requireStock } from './stock-plan.mjs';
const transient = new Set(['application_sessions','operator_attempt_windows','operator_verifications','account_audit']);
export function ownedIds(execution) {
  return new Set([execution.runId, ...execution.operations.map(o => o.commandId), ...execution.operations.map(o => o.idempotencyKey),
    ...execution.labels.flatMap(l => [l.componentId,l.donationId, 'INCAP_' + digest(l.idempotencyKey).slice(0,40).toUpperCase()]),
    ...execution.reservations.flatMap(r => [r.reservationId,r.workflowId]), ...(execution.censusSnapshotId ? [execution.censusSnapshotId] : [])]);
}
const ownedFields = new Set(['run_id','command_id','idempotency_key','component_id','donation_id','capture_id','reservation_id','transfer_id','local_release_id','snapshot_id']);
export function fingerprintRows(rows, owned = new Set()) {
  return rows.filter(row => !Object.entries(row).some(([key,value]) => ownedFields.has(key) && owned.has(value))).map(row => digest(row)).sort();
}
export async function preservationSnapshot(pool, owned = new Set()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='app' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
    const fingerprints = {};
    for (const { table_name: name } of tables) {
      if (transient.has(name)) continue;
      requireStock(/^[a-z0-9_]+$/.test(name), 'STOCK_TABLE_INVALID');
      const rows = (await client.query(`SELECT to_jsonb(t) AS row FROM app.${name} t`)).rows.map(r => r.row);
      fingerprints[name] = digest(fingerprintRows(rows, owned));
    }
    await client.query('COMMIT'); return fingerprints;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function verifyPreservation(pool, execution) {
  const run = (await pool.query('SELECT census_snapshot_id FROM app.operational_stock_runs WHERE run_id=$1',[execution.runId])).rows[0];
  assertPreserved(execution.baselineFingerprints, await preservationSnapshot(pool, ownedIds({ ...execution, censusSnapshotId: run?.census_snapshot_id })));
}
