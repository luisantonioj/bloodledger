// TP-STOCK-01 / FR-12 / NFR-01: runtime inspection preserves migration privileges.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectMigrationEvidence} from '../../scripts/development-data/stock-cli.mjs';
test('FR-12: a runtime role without migration access reports missing evidence without querying protected rows',async()=>{
 const queries=[];const pool={query:async sql=>{queries.push(sql);assert.match(sql,/has_table_privilege/);return {rows:[{permitted:false}]};}};
 assert.deepEqual(await inspectMigrationEvidence(pool),{migrations:null,migrationEvidenceStatus:'REQUIRES_PRIVILEGED_READ'});assert.equal(queries.length,1);
});
test('TP-STOCK-01: an authorized metadata reader returns actual ordered migration names',async()=>{
 const queries=[];const pool={query:async sql=>{queries.push(sql);return queries.length===1?{rows:[{permitted:true}]}:{rows:[{name:'FIRST'},{name:'SECOND'}]};}};
 assert.deepEqual(await inspectMigrationEvidence(pool),{migrations:['FIRST','SECOND'],migrationEvidenceStatus:'VERIFIED'});assert.match(queries[1],/ORDER BY name/);
});
test('NFR-01: unexpected database inspection failure remains a failure',async()=>{
 await assert.rejects(inspectMigrationEvidence({query:async()=>{throw new Error('Database unavailable');}}),/Database unavailable/);
});
