import { HistoricalStore } from '../../../scripts/historical-inventory/store.mjs';
import historical from '../../../chaincode/build/compiled/src/historical-model.js';
import { sha256 } from '../build/src/hash.js';
const {makeHistoricalManifest,HISTORICAL_BLOOD_TYPES,HISTORICAL_COMPONENT_TYPES}=historical;
// Fabricated, schema-valid receipts exercise preservation. They are not Fabric evidence.
export async function seedPreservationFixture(client){
  const correlation='CORR_'+'A'.repeat(32);
  for(let i=0;i<9;i++){
    const hash=sha256({fixture:i}),donation=`DON_PRESERVE_${i}`,component=`COMP_PRESERVE_${i}`;
    await client.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,'INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$2,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')",[donation,hash]);
    await client.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,reservation_purpose,reservation_id,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES($1,$2,'INST_MEDIATRIX',$3,'PACKED_RED_BLOOD_CELLS','A_POSITIVE',now()-interval '1 day',now()+interval '29 days','INST_MEDIATRIX',$4,$5,$6,1,$7,$8,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')",[component,donation,hash,i<6?'AVAILABLE':i===6?'RESERVED':i===7?'IN_TRANSIT':'EXPIRED',i===6||i===7?'TRANSFER':null,i===6||i===7?'RES_PRESERVE':null,sha256({receipt:i}),correlation]);
  }
  await client.query("INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,ledger_transaction_id,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification) VALUES('CMD_PRESERVE','IDEM_PRESERVE',repeat('c',64),'COMPONENT','COMP_PRESERVE_0','RegisterInboundComponent','{\"actorUserId\":\"USR_SYNTH_REVIEW_ROLE01\",\"fixture\":true}','COMMITTED',now(),repeat('d',64),$1,'USR_SYNTH_REVIEW_ROLE01','INST_MEDIATRIX',now(),now(),'SIMULATION_ONLY')",[correlation]);
  await client.query("INSERT INTO app.v2_projection_receipts(command_id,ledger_transaction_id,command_payload_sha256,projected_at,projection_version) VALUES('CMD_PRESERVE',repeat('d',64),repeat('c',64),now(),'V2.1')");
  await client.query("INSERT INTO app.v2_alert_acknowledgements(component_id,actor_user_id,acknowledged_at,classification) VALUES('COMP_PRESERVE_8','USR_SYNTH_REVIEW_ROLE01',now(),'SIMULATION_ONLY')");
  const pairs=HISTORICAL_BLOOD_TYPES.flatMap(bloodType=>HISTORICAL_COMPONENT_TYPES.map(componentType=>({bloodType,componentType})));
  const manifest=makeHistoricalManifest({workbookSha256:'a'.repeat(64),businessDate:'2026-01-02',counts:pairs.map((p,i)=>({...p,available:i===0?30:24,reserved:i===0?36:0,closing:(i===0?66:24)}))});
  if(manifest.units.length!==522)throw new Error('FIXTURE_COUNT_MISMATCH');
  const store=new HistoricalStore(client);await store.enqueue(manifest,'FABRICATED_ACCOUNT_PRESERVATION_TEST','USR_SYNTH_HISTORICAL_IMPORT');
  while(true){
    const command=await store.next(manifest.snapshotId);if(!command)break;
    const tx=sha256({fixtureCommand:command.command_id});
    const asset=command.operation==='RegisterUnit'?{...manifest.units.find(u=>u.componentId===command.payload.componentId),snapshotId:manifest.snapshotId,transactionId:tx,committedAt:'2026-10-07T00:00:00.000Z'}:{snapshotId:manifest.snapshotId,manifest,status:'COMPLETE',expectedUnits:522,registeredUnits:522,transactionId:tx,committedAt:'2026-10-07T00:00:00.000Z'};
    const evidence={transactionId:tx,blockNumber:'42',validationStatus:'VALID',asset};
    await store.saveSubmission(command.command_id,tx,Buffer.from('FABRICATED_TEST_ENVELOPE'));await store.saveCommit(command.command_id,evidence);await store.project(command,evidence);await store.project(command,evidence);
  }
  return manifest.snapshotId;
}
