import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { HistoricalStore } from '../../scripts/historical-inventory/store.mjs';
import { verifySnapshot } from '../../scripts/historical-inventory/cli.mjs';
import historical from '../../chaincode/build/compiled/src/historical-model.js';
const {makeHistoricalManifest,HISTORICAL_BLOOD_TYPES,HISTORICAL_COMPONENT_TYPES}=historical;
const client=new Client({host:'127.0.0.1',database:'historical_test',user:'postgres'});
await client.connect();
try {
  await client.query('CREATE ROLE bloodledger_app; CREATE SCHEMA app; CREATE TABLE app.inventory_projection(unit_id text PRIMARY KEY); INSERT INTO app.inventory_projection VALUES(\'PRESERVED_SYNTHETIC_UNIT\')');
  const migration=await import('../../database/migrations/20261007000000000_create-historical-synthetic-inventory.js');
  await migration.up({sql:sql=>client.query(sql)});
  const manifest=makeHistoricalManifest({workbookSha256:'a'.repeat(64),businessDate:'2026-01-02',counts:HISTORICAL_BLOOD_TYPES.flatMap(bloodType=>HISTORICAL_COMPONENT_TYPES.map(componentType=>({bloodType,componentType,available:1,reserved:1,closing:2})))});
  const store=new HistoricalStore(client);await store.lock(manifest.snapshotId);await store.enqueue(manifest,'FABRICATED_TEST_REVIEW','USR_SYNTH_HISTORICAL_IMPORT');await store.enqueue(manifest,'FABRICATED_TEST_REVIEW','USR_SYNTH_HISTORICAL_IMPORT');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM app.synthetic_inventory_import_commands')).rows[0].n,42);
  await assert.rejects(store.enqueue(manifest,'CHANGED_REVIEW','USR_SYNTH_HISTORICAL_IMPORT'),/CONFLICT/);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM app.synthetic_inventory_completed_units')).rows[0].n,0);
  const snapshotAsset={snapshotId:manifest.snapshotId,manifest,status:'COMPLETE',expectedUnits:40,registeredUnits:40,transactionId:'f'.repeat(64),committedAt:'2026-10-07T00:00:00.000Z'};
  const receipts=new Map();const assets=new Map();
  while(true) {
    const command=await store.next(manifest.snapshotId);if(!command)break;
    const tx=(command.step_index+1).toString(16).padStart(64,'0');
    const asset=command.operation==='RegisterUnit'?{...manifest.units.find(u=>u.componentId===command.payload.componentId),snapshotId:manifest.snapshotId,transactionId:tx,committedAt:'2026-10-07T00:00:00.000Z'}:{...snapshotAsset,transactionId:tx};
    const evidence={transactionId:tx,blockNumber:'42',validationStatus:'VALID',asset};receipts.set(command.command_id,evidence);assets.set(asset.componentId,asset);
    await store.saveSubmission(command.command_id,tx,Buffer.from('TEST_ENVELOPE'));await store.saveCommit(command.command_id,evidence);await store.project(command,evidence);await store.project(command,evidence);
  }
  const ledger={readSnapshot:async()=>snapshotAsset,inspect:async c=>receipts.get(c.command_id),readUnit:async(s,id)=>assets.get(id)};
  const report=await verifySnapshot(client,ledger,manifest);assert.equal(report.generatedUnits,40);assert.equal(report.directlyVerifiedTransactions,42);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM app.inventory_projection')).rows[0].n,1);
  await client.query("UPDATE app.synthetic_inventory_counts SET available_units=0,reserved_units=2 WHERE series_key=(SELECT series_key FROM app.synthetic_inventory_counts LIMIT 1)");
  await assert.rejects(verifySnapshot(client,ledger,manifest),/RECONCILIATION/);
  const privileges=await client.query("SELECT has_table_privilege('bloodledger_app','app.synthetic_inventory_units','DELETE') AS can_delete");assert.equal(privileges.rows[0].can_delete,false);
  console.log('Historical PostgreSQL migration, duplicate, replay, reconciliation, completed view, privileges and preservation: PASS (fabricated fixture; no live Fabric verification)');
} finally { await client.end(); }
