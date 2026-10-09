import { Pool } from 'pg';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { HistoricalLedger } from '../historical-inventory/ledger.mjs';
import { InstitutionClient } from './institution-client.mjs';
import { digest, canonical } from './scenario.mjs';
import { requireStock, INSTITUTION_OPERATOR_MODE } from './stock-plan.mjs';
import policy from '../../chaincode/policy/institution-core-v1.json' with { type: 'json' };
import accountPolicy from '../../services/api/policy/institution-accounts-v1.json' with { type: 'json' };

export async function privateJson(path) {
  requireStock(path && ((await stat(path)).mode & 0o077) === 0, 'STOCK_PRIVATE_FILE_REQUIRED');
  return JSON.parse(await readFile(path, 'utf8'));
}
export async function savePrivate(path, value) {
  requireStock(path, 'STOCK_OUTPUT_REQUIRED');
  const destination = resolve(path), rel = relative(process.cwd(), destination);
  requireStock(rel.startsWith('../') || rel.startsWith('build/'), 'STOCK_PRIVATE_OUTPUT_REQUIRED');
  await writeFile(destination, canonical(value) + '\n', { flag: 'wx', mode: 0o600 });
}
export async function openInstitutionRuntime(config, requireRecipient = false) {
  requireStock(config.authenticationMode === INSTITUTION_OPERATOR_MODE && config.classification === 'SIMULATION_ONLY' && config.scope === 'PERSISTENT_LOCAL_DEVELOPMENT', 'STOCK_CONFIG_INVALID');
  requireStock(['127.0.0.1','localhost','postgres'].includes(process.env.DEVELOPMENT_PG_HOST ?? '127.0.0.1') && process.env.POSTGRES_DB === 'bloodledger_dev' && process.env.POSTGRES_APP_USER === 'bloodledger_app', 'STOCK_LOCAL_TARGET_REQUIRED');
  const pool = new Pool({ host: process.env.DEVELOPMENT_PG_HOST ?? '127.0.0.1', port: Number(process.env.DEVELOPMENT_PG_PORT ?? 5432), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_APP_USER, password: process.env.POSTGRES_APP_PASSWORD, max: 4 });
  let ledger, client;
  try {
    requireStock((await pool.query("SELECT to_regclass('app.institution_account_migrations') AS name")).rows[0].name, 'STOCK_ACCOUNT_MIGRATION_REQUIRED');
    const managed = await pool.query("SELECT 1 FROM app.institution_account_migrations WHERE migration_id='INSTITUTION_ACCOUNTS_20261008_V1' AND status='APPLIED'");
    requireStock(managed.rows.length === 1, 'STOCK_ACCOUNT_MIGRATION_REQUIRED');
    const primary = (await pool.query("SELECT institution_id FROM app.application_users WHERE account_kind='PRIMARY' AND status='ACTIVE' ORDER BY institution_id")).rows.map(r => r.institution_id);
    requireStock(canonical(primary) === canonical(accountPolicy.accounts.map(a => a.institutionId).sort()), 'STOCK_SIX_PRIMARY_ACCOUNTS_REQUIRED');
    ledger = (await HistoricalLedger.connect()).useContract('InterviewCoreContract');
    requireStock(ledger.channel === 'bloodledger-dev', 'STOCK_CHANNEL_INVALID');
    const identity = (await pool.query('SELECT instance_id FROM app.development_target_identity WHERE singleton')).rows[0];
    const target = { genesisSha256: await ledger.genesisDigest(), database: process.env.POSTGRES_DB, instanceId: identity?.instance_id, volume: process.env.DEVELOPMENT_TARGET_VOLUME, volumeCreatedAt: process.env.DEVELOPMENT_TARGET_VOLUME_CREATED, channel: ledger.channel };
    requireStock(target.instanceId && target.volume && target.volumeCreatedAt, 'STOCK_TARGET_EVIDENCE_REQUIRED');
    const targetSha256 = digest(target), policySha256 = digest(JSON.stringify(policy));
    client = new InstitutionClient(config, process.env.DEVELOPMENT_API_URL ?? 'http://127.0.0.1:3000');
    const principals = {};
    for (const name of requireRecipient ? ['coordinator','recipient'] : ['coordinator']) {
      const session = await client.session(name), actorId = session.operator.operatorId, actor = policy.actors[actorId];
      requireStock(actor?.role === 'ROLE_02' && actor.institutionId === session.principal.institutionId && policy.institutionAccountActorIds.includes(actorId), 'STOCK_ACTOR_POLICY_INVALID');
      const installed = JSON.parse(Buffer.from(await ledger.contract.evaluateTransaction('ReadActorPolicy', JSON.stringify({ actorUserId: actorId, policyVersion: policy.policyVersion }))).toString('utf8'));
      requireStock(installed.policySha256 === policySha256 && installed.role === actor.role && installed.institutionId === actor.institutionId && installed.classification === 'SIMULATION_ONLY', 'STOCK_INSTALLED_POLICY_MISMATCH');
      principals[name] = { accountId: session.principal.accountId, userId: actorId, institutionId: actor.institutionId, roleId: session.operator.roleId, operatorVersion: session.operator.version };
    }
    return { pool, ledger, client, target, targetSha256, principals, policySha256, policyVersion: policy.policyVersion,
      async close() { await client.close(); ledger.close(); await pool.end(); } };
  } catch (error) { await client?.close(); ledger?.close(); await pool.end(); throw error; }
}
export async function institutionMaintenance(action, options, config) {
  requireStock(['inspect','census'].includes(action), 'STOCK_MAINTENANCE_ACTION_INVALID');
  const runtime = await openInstitutionRuntime(config);
  try {
    if (action === 'inspect') console.log(canonical({ target: runtime.target, targetSha256: runtime.targetSha256, principals: runtime.principals, policyVersion: runtime.policyVersion, policySha256: runtime.policySha256, classification: 'SIMULATION_ONLY' }));
    else {
      requireStock(config.targetSha256 === runtime.targetSha256, 'STOCK_TARGET_APPROVAL_REQUIRED');
      const scheduled = new Date(options['scheduled-for']);
      requireStock(Number.isFinite(scheduled.getTime()) && scheduled <= new Date(), 'STOCK_CENSUS_TIME_INVALID');
      const { PostgresMlInventorySnapshotStore } = await import('../../services/api/build/src/census-worker.js');
      const snapshot = await new PostgresMlInventorySnapshotStore(runtime.pool).capture(runtime.principals.coordinator.institutionId, scheduled, 'MANUAL', new Date());
      console.log(canonical({ snapshotId: snapshot.snapshotId, countCombinations: snapshot.groups.reduce((n,g) => n + g.bloodTypes.length,0), capturedAt: snapshot.capturedAt, classification: 'SIMULATION_ONLY' }));
    }
  } finally { await runtime.close(); }
}
