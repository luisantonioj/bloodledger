// TP-STOCK-01 / FR-02, FR-12–14: independently read saved local Fabric commitments.
// No command submission, projection writes or raw signed-envelope output.
import { createRequire } from 'node:module';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { HistoricalLedger } from '../../scripts/historical-inventory/ledger.mjs';
import { ledgerCommand } from '../../scripts/development-data/scenario.mjs';
import { EXECUTION_SCHEMA, SCENARIO_SHA256, unseal } from '../../scripts/development-data/stock-plan.mjs';
import { PostgresV2CommandStore } from '../../services/api/build/src/v2-command.js';

const root = process.env.BLOODLEDGER_REPOSITORY_ROOT;
const { Pool } = createRequire(root + '/package.json')('pg');
const manifestPath = process.env.BLOODLEDGER_STOCK_EXECUTION_PATH;
const reportPath = process.env.BLOODLEDGER_STOCK_EVIDENCE_REPORT_PATH;
assert.ok(manifestPath && reportPath, 'Private execution and report paths are required');
assert.equal((await stat(manifestPath)).mode & 0o077, 0, 'Private execution permissions are required');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
unseal(manifest, process.env.BLOODLEDGER_STOCK_EXECUTION_SHA256);
assert.equal(manifest.schemaVersion, EXECUTION_SCHEMA);
assert.equal(manifest.scenarioSha256, SCENARIO_SHA256);
assert.equal(manifest.operations.length, 559);
const pool = new Pool({ host: 'postgres', database: process.env.POSTGRES_DB, user: process.env.POSTGRES_APP_USER, password: process.env.POSTGRES_APP_PASSWORD });
let ledger;
try {
  ledger = (await HistoricalLedger.connect()).useContract('InterviewCoreContract');
  const store = new PostgresV2CommandStore(pool);
  const receipts = [];
  for (const operation of manifest.operations) {
    const principal = manifest.principals[operation.account];
    const command = await store.get(operation.commandId, principal.institutionId, principal.userId);
    const saved = (await pool.query('SELECT * FROM app.operational_stock_commands WHERE command_id=$1 AND run_id=$2', [operation.commandId, manifest.runId])).rows[0];
    assert.ok(command && saved?.transaction_id && saved.signed_transaction, 'Saved submission evidence is required');
    assert.equal(command.status, 'COMMITTED');
    assert.equal(command.idempotencyKey, operation.idempotencyKey);
    assert.equal(command.actorUserId, principal.userId);
    assert.equal(command.actorInstitutionId, principal.institutionId);
    const evidence = await ledger.inspect({ ...ledgerCommand(command), ...saved });
    assert.equal(evidence?.validationStatus, 'VALID');
    assert.equal(evidence.transactionId, saved.transaction_id);
    assert.equal(String(evidence.blockNumber), String(saved.block_number));
    receipts.push({ commandId: operation.commandId, transactionId: evidence.transactionId, blockNumber: evidence.blockNumber, validationStatus: evidence.validationStatus,
      signedEnvelopeSha256: createHash('sha256').update(saved.signed_transaction).digest('hex'), savedStatus: command.status });
  }
  assert.equal(new Set(receipts.map(receipt => receipt.transactionId)).size, 559);
  const result = { classification: 'SIMULATION_ONLY', hostValidation: 'JOPIA_SELF_VALIDATION', source: 'INDEPENDENT_LOCAL_QSCC_TRANSACTION_AND_BLOCK_READ',
    executionSha256: manifest.manifestSha256, observedAt: new Date().toISOString(), receipts };
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ classification: result.classification, source: result.source, executionSha256: result.executionSha256,
    observedAt: result.observedAt, validTransactions: receipts.length, states: [...new Set(receipts.map(receipt => receipt.savedStatus))], evidenceFile: reportPath }));
} finally {
  ledger?.close();
  await pool.end();
}
