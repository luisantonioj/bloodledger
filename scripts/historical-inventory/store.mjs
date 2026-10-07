export class HistoricalStore {
  constructor(client) { this.client = client; }
  async lock(snapshotId) {
    const result=await this.client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[`historical:${snapshotId}`]);
    if(!result.rows[0].acquired) throw new Error('HISTORICAL_IMPORT_ALREADY_RUNNING');
  }
  async enqueue(manifest,reviewReference,operator) {
    const c=this.client;
    await c.query('BEGIN');
    try {
      await c.query(`INSERT INTO app.synthetic_inventory_snapshots(snapshot_id,workbook_sha256,manifest_sha256,source_business_date,source_institution_id,dataset_version,manifest,review_reference,operator_user_id,status,expected_units) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'INCOMPLETE',$10) ON CONFLICT(snapshot_id) DO NOTHING`,[manifest.snapshotId,manifest.workbookSha256,manifest.manifestSha256,manifest.businessDate,manifest.sourceInstitutionId,manifest.datasetVersion,manifest,reviewReference,operator,manifest.units.length]);
      const existing=(await c.query('SELECT manifest_sha256,operator_user_id,review_reference FROM app.synthetic_inventory_snapshots WHERE snapshot_id=$1',[manifest.snapshotId])).rows[0];
      if(existing.manifest_sha256!==manifest.manifestSha256||existing.operator_user_id!==operator||existing.review_reference!==reviewReference) throw new Error('HISTORICAL_IMPORT_CONFLICT');
      for(const row of manifest.counts) await c.query('INSERT INTO app.synthetic_inventory_counts VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[manifest.snapshotId,`${row.bloodType}/${row.componentType}`,row.bloodType,row.componentType,row.available,row.reserved,row.closing]);
      const requests=[{operation:'BeginSnapshot',payload:{manifest,actorUserId:operator,reviewReference,approvedManifestSha256:manifest.manifestSha256}},...manifest.units.map(unit=>({operation:'RegisterUnit',payload:{snapshotId:manifest.snapshotId,componentId:unit.componentId,actorUserId:operator}})),{operation:'FinalizeSnapshot',payload:{snapshotId:manifest.snapshotId,actorUserId:operator}}];
      for(let i=0;i<requests.length;i++) await c.query('INSERT INTO app.synthetic_inventory_import_commands(command_id,snapshot_id,step_index,operation,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[`${manifest.snapshotId}:${i}`,manifest.snapshotId,i,requests[i].operation,requests[i].payload]);
      await c.query('COMMIT');
    } catch(error) { await c.query('ROLLBACK'); throw error; }
  }
  async next(snapshotId) { return (await this.client.query("SELECT * FROM app.synthetic_inventory_import_commands WHERE snapshot_id=$1 AND status<>'COMMITTED' ORDER BY step_index LIMIT 1",[snapshotId])).rows[0]; }
  async saveSubmission(commandId,transactionId,bytes) {
    await this.client.query("UPDATE app.synthetic_inventory_import_commands SET status='SUBMITTING',transaction_id=$2,signed_transaction=$3,attempt_count=attempt_count+1,updated_at=now() WHERE command_id=$1 AND transaction_id IS NULL",[commandId,transactionId,Buffer.from(bytes)]);
  }
  async saveCommit(commandId,evidence) {
    await this.client.query("UPDATE app.synthetic_inventory_import_commands SET status='LEDGER_COMMITTED_PROJECTION_PENDING',transaction_id=$2,ledger_result=$3,block_number=$4,validation_status='VALID',updated_at=now() WHERE command_id=$1",[commandId,evidence.transactionId,evidence.asset,evidence.blockNumber]);
  }
  async fail(commandId,code) { await this.client.query("UPDATE app.synthetic_inventory_import_commands SET status='FAILED',safe_error_code=$2,updated_at=now() WHERE command_id=$1",[commandId,code]); }
  async project(command,evidence) {
    const c=this.client; await c.query('BEGIN');
    try {
      if(command.operation==='RegisterUnit') {
        const unit=evidence.asset;
        await c.query(`INSERT INTO app.synthetic_inventory_units(component_id,snapshot_id,series_key,snapshot_status,allocation_group_id,ledger_transaction_id,block_number,validation_status,committed_at) VALUES($1,$2,$3,$4,$5,$6,$7,'VALID',$8) ON CONFLICT(component_id) DO NOTHING`,[unit.componentId,command.snapshot_id,unit.seriesKey,unit.snapshotStatus,unit.allocationGroupId,evidence.transactionId,evidence.blockNumber,unit.committedAt]);
        const row=(await c.query('SELECT ledger_transaction_id,snapshot_status FROM app.synthetic_inventory_units WHERE component_id=$1',[unit.componentId])).rows[0];
        if(row.ledger_transaction_id!==evidence.transactionId||row.snapshot_status!==unit.snapshotStatus) throw new Error('HISTORICAL_PROJECTION_CONFLICT');
      }
      if(command.operation==='FinalizeSnapshot') {
        const actual=(await c.query('SELECT count(*)::integer AS n FROM app.synthetic_inventory_units WHERE snapshot_id=$1',[command.snapshot_id])).rows[0].n;
        if(actual!==evidence.asset.expectedUnits || evidence.asset.status!=='COMPLETE') throw new Error('HISTORICAL_PROJECTION_INCOMPLETE');
        await c.query("UPDATE app.synthetic_inventory_snapshots SET status='COMPLETE',verified_units=$2,ledger_transaction_id=$3,block_number=$4,validation_status='VALID',completed_at=now() WHERE snapshot_id=$1",[command.snapshot_id,actual,evidence.transactionId,evidence.blockNumber]);
      }
      await c.query("UPDATE app.synthetic_inventory_import_commands SET status='COMMITTED',safe_error_code=NULL,updated_at=now() WHERE command_id=$1",[command.command_id]);
      await c.query('COMMIT');
    } catch(error) { await c.query('ROLLBACK'); throw error; }
  }
}
