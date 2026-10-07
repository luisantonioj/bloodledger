import { HistoricalFailure } from './ledger.mjs';
export async function runHistoricalCommand(store,ledger,snapshotId) {
  let command=await store.next(snapshotId); if(!command) return 'COMPLETE';
  if(command.status==='FAILED') throw new HistoricalFailure(command.safe_error_code??'HISTORICAL_COMMAND_FAILED',true);
  try {
    let evidence;
    if(command.status==='LEDGER_COMMITTED_PROJECTION_PENDING') {
      evidence={transactionId:command.transaction_id,asset:command.ledger_result,blockNumber:String(command.block_number),validationStatus:command.validation_status};
    } else {
      if(!command.transaction_id) {
        const prepared=await ledger.prepare(command);
        await store.saveSubmission(command.command_id,prepared.transactionId,prepared.bytes);
        command={...command,transaction_id:prepared.transactionId,signed_transaction:Buffer.from(prepared.bytes),status:'SUBMITTING'};
      }
      evidence=await ledger.inspect(command);
      if(!evidence) { await ledger.submitSaved(command);evidence=await ledger.inspect(command); }
      if(!evidence) throw new HistoricalFailure('HISTORICAL_COMMIT_UNCONFIRMED');
      await store.saveCommit(command.command_id,evidence);
    }
    if(evidence.validationStatus!=='VALID') throw new HistoricalFailure('HISTORICAL_TRANSACTION_INVALID',true);
    await store.project(command,evidence);return 'PROGRESSED';
  } catch(error) {
    const messages=[error.message,...(Array.isArray(error.details)?error.details.map(d=>d.message):[])].join(' ');
    const code=messages.match(/\bHISTORICAL_[A-Z_]+\b/)?.[0];
    if(!(error instanceof HistoricalFailure)&&code) error=new HistoricalFailure(code,true);
    if(error.terminal===true) await store.fail(command.command_id,error.code??'HISTORICAL_COMMAND_FAILED');
    throw error;
  }
}
