import { createHash } from 'node:crypto';
export const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const id = (prefix, value) => prefix + digest(value).slice(0,40).toUpperCase();
export function scenarios(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('SEED_DATE_INVALID');
  const base = Date.parse(date+'T00:00:00.000Z'); const time = hours => new Date(base+hours*3600000).toISOString();
  const types = ['WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'];
  return [...types.map((componentType,index) => ({name:'AVAILABLE_'+index,componentType,bloodType:'A_POSITIVE',collectedAt:time(-24),expiresAt:time(240),donationNumber:`MM${date.slice(2,4)}-${date.slice(5,7)}-${String(8000+Number(date.slice(8))*10+index).padStart(4,'0')}`})),
    {name:'RESERVED',componentType:'PLATELETS',bloodType:'B_POSITIVE',collectedAt:time(-24),expiresAt:time(240),donationNumber:`MM${date.slice(2,4)}-${date.slice(5,7)}-${String(8400+Number(date.slice(8))).padStart(4,'0')}`},
    {name:'IN_TRANSIT',componentType:'PACKED_RED_BLOOD_CELLS',bloodType:'O_POSITIVE',collectedAt:time(-24),expiresAt:time(240),donationNumber:`MM${date.slice(2,4)}-${date.slice(5,7)}-${String(8500+Number(date.slice(8))).padStart(4,'0')}`},
    {name:'EXPIRED',componentType:'FRESH_FROZEN_PLASMA',bloodType:'AB_POSITIVE',collectedAt:time(-48),expiresAt:time(-1),donationNumber:`MM${date.slice(2,4)}-${date.slice(5,7)}-${String(8600+Number(date.slice(8))).padStart(4,'0')}`},
    {name:'IMMINENT_EXPIRY_NO_WARNING_POLICY',componentType:'WHOLE_BLOOD',bloodType:'AB_POSITIVE',collectedAt:time(-24),expiresAt:time(23),donationNumber:`MM${date.slice(2,4)}-${date.slice(5,7)}-${String(8700+Number(date.slice(8))).padStart(4,'0')}`}];
}
export function ledgerCommand(command) {
  const operations = { REGISTER_INBOUND_COMPONENT:'RegisterInboundComponent', SUBMIT_TRANSFER:'SubmitTransferRequest', RESERVE_COMPONENTS:'ReserveComponents', RESERVE_LOCAL_RELEASE:'ReserveComponents', PREPARE_RESERVATION:'PrepareReservation', DISPATCH_RESERVATION:'DispatchReservation', START_RESERVATION_TRANSIT:'StartReservationTransit', EVALUATE_COMPONENT_EXPIRY:'EvaluateComponentExpiry' };
  if (!operations[command.operation]) throw new Error('SEED_OPERATION_UNSUPPORTED');
  let payload = {...command.payload};
  if (command.operation==='REGISTER_INBOUND_COMPONENT') {
    for (const key of ['captureId','donationNoCiphertext','donationNoNonce','donationNoAuthTag','donationNoEncryptionKeyVersion','capturedAt','confirmedAt','ocrEngine','ocrEngineVersion','donationNumberConfidence','bloodTypeConfidence']) delete payload[key];
    payload.donationNoDigest=payload.donationNoLookupHmac;delete payload.donationNoLookupHmac;
  }
  if(command.operation==='RESERVE_COMPONENTS') delete payload.transferId;
  if(command.operation==='RESERVE_LOCAL_RELEASE') delete payload.localReleaseId;
  return { operation:operations[command.operation],payload:{...payload,idempotencyKey:command.idempotencyKey,policyVersion:payload.policyVersion??'INTERVIEW_DERIVED_CORE_V2_1'} };
}
export async function processSavedCommand({command, saved, ledger, saveSubmission, saveCommit, project, complete, afterSubmit = async () => undefined}) {
  const request = ledgerCommand(command);
  let submission = saved;
  if (!submission.transaction_id) {
    const prepared = await ledger.prepare(request);
    await saveSubmission(prepared);
    submission = {transaction_id:prepared.transactionId,signed_transaction:prepared.bytes};
  }
  const checked = {...request,...submission};
  let evidence = await ledger.inspect(checked);
  if (!evidence) {
    if(command.ledgerTransactionId) throw new Error('SEED_SAVED_COMMITMENT_NOT_FOUND');
    await ledger.submitSaved(checked);
    await afterSubmit();
    evidence = await ledger.inspect(checked);
  }
  if(!evidence || evidence.validationStatus!=='VALID') throw new Error('SEED_VALID_EVIDENCE_REQUIRED');
  if(command.ledgerTransactionId && command.ledgerTransactionId!==evidence.transactionId) throw new Error('SEED_COMMITMENT_CONFLICT');
  await saveCommit(evidence);
  await project(evidence);
  await complete();
  return evidence;
}
