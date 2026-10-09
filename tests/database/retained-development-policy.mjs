// FR-01 / FR-12: real migrated PostgreSQL accepts only the three approved policies.
// Run against the retained synthetic seed after resume. Every update is rolled back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';

test('component projection constraint accepts retained development and legacy policies, rejects unknown policy',async()=>{
  const pool=new Pool({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT??5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_APP_USER,password:process.env.POSTGRES_APP_PASSWORD,max:1});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const row=(await client.query("SELECT component_id,policy_version FROM app.v2_components WHERE policy_version='PERSISTENT_DEVELOPMENT_CORE_V1' ORDER BY component_id LIMIT 1")).rows[0];
    assert.ok(row,'A genuinely projected retained seed component is required');
    for(const policy of ['INTERVIEW_DERIVED_CORE_V2','INTERVIEW_DERIVED_CORE_V2_1','PERSISTENT_DEVELOPMENT_CORE_V1']){
      const result=await client.query('UPDATE app.v2_components SET policy_version=$2 WHERE component_id=$1',[row.component_id,policy]);
      assert.equal(result.rowCount,1);
    }
    await client.query('SAVEPOINT reject_unknown');
    await assert.rejects(client.query('UPDATE app.v2_components SET policy_version=$2 WHERE component_id=$1',[row.component_id,'UNAPPROVED_POLICY']),error=>error.code==='23514'&&error.constraint==='v2_components_policy');
    await client.query('ROLLBACK TO SAVEPOINT reject_unknown');
    await client.query('ROLLBACK');
    assert.deepEqual((await client.query('SELECT component_id,policy_version FROM app.v2_components WHERE component_id=$1',[row.component_id])).rows[0],row);
  }finally{
    await client.query('ROLLBACK');client.release();await pool.end();
  }
});
