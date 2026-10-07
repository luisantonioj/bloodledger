import { createPrivateKey } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import historical from '../../chaincode/build/compiled/src/historical-model.js';
const {canonical}=historical;
const require=createRequire(import.meta.url);
const {common,peer}=createRequire(require.resolve('@hyperledger/fabric-gateway'))('@hyperledger/fabric-protos');
export class HistoricalFailure extends Error { constructor(code,terminal=false) { super(code); this.code=code;this.terminal=terminal; } }
function assert(condition,code) { if(!condition) throw new HistoricalFailure(code,true); }
const text=bytes=>Buffer.from(bytes).toString('utf8');
function header(envelope) {
  const payload=common.Payload.deserializeBinary(envelope.getPayload_asU8());
  const channelHeader=common.ChannelHeader.deserializeBinary(payload.getHeader().getChannelHeader_asU8());
  return {payload,channelHeader};
}
export function decodeHistoricalEvidence(transactionBytes,blockBytes,expected) {
  const processed=peer.ProcessedTransaction.deserializeBinary(transactionBytes);
  assert(processed.getValidationcode()===0,'HISTORICAL_TRANSACTION_INVALID');
  const envelope=processed.getTransactionenvelope(); assert(envelope,'HISTORICAL_ENVELOPE_MISSING');
  const {payload,channelHeader}=header(envelope);
  assert(channelHeader.getTxId()===expected.transactionId&&channelHeader.getChannelId()===expected.channel,'HISTORICAL_TRANSACTION_MISMATCH');
  const transaction=peer.Transaction.deserializeBinary(payload.getData_asU8());
  assert(transaction.getActionsList().length===1,'HISTORICAL_ACTION_INVALID');
  const actionPayload=peer.ChaincodeActionPayload.deserializeBinary(transaction.getActionsList()[0].getPayload_asU8());
  const proposal=peer.ChaincodeProposalPayload.deserializeBinary(actionPayload.getChaincodeProposalPayload_asU8());
  const invocation=peer.ChaincodeInvocationSpec.deserializeBinary(proposal.getInput_asU8());
  const spec=invocation.getChaincodeSpec(); const args=spec.getInput().getArgsList_asU8().map(text);
  assert(spec.getChaincodeId().getName()===expected.chaincode&&args.length===2&&args[0]===`HistoricalInventoryContract:${expected.operation}`,'HISTORICAL_OPERATION_MISMATCH');
  assert(canonical(JSON.parse(args[1]))===canonical(expected.payload),'HISTORICAL_PAYLOAD_MISMATCH');
  const responsePayload=peer.ProposalResponsePayload.deserializeBinary(actionPayload.getAction().getProposalResponsePayload_asU8());
  const action=peer.ChaincodeAction.deserializeBinary(responsePayload.getExtension_asU8());
  assert(action.getResponse().getStatus()===200,'HISTORICAL_RESPONSE_INVALID');
  const asset=JSON.parse(text(action.getResponse().getPayload_asU8()));
  assert(asset.transactionId===expected.transactionId,'HISTORICAL_ASSET_TRANSACTION_MISMATCH');
  const block=common.Block.deserializeBinary(blockBytes);
  const entries=block.getData().getDataList_asU8();
  const index=entries.findIndex(bytes=>header(common.Envelope.deserializeBinary(bytes)).channelHeader.getTxId()===expected.transactionId);
  const flags=block.getMetadata().getMetadataList_asU8()[common.BlockMetadataIndex.TRANSACTIONS_FILTER];
  assert(index>=0&&flags&&flags[index]===0,'HISTORICAL_BLOCK_VALIDATION_MISMATCH');
  assert(Buffer.from(entries[index]).equals(Buffer.from(envelope.serializeBinary())),'HISTORICAL_BLOCK_ENVELOPE_MISMATCH');
  const number=block.getHeader().getNumber();
  assert(Number.isSafeInteger(number)&&number>=0,'HISTORICAL_BLOCK_NUMBER_INVALID');
  return {transactionId:expected.transactionId,blockNumber:String(number),validationStatus:'VALID',asset};
}
async function oneFile(directory) { const names=await readdir(directory); if(names.length!==1) throw new HistoricalFailure('HISTORICAL_IDENTITY_FILES_INVALID'); return join(directory,names[0]); }
export class HistoricalLedger {
  constructor(gateway,client,channel,chaincode,signer) { this.gateway=gateway; this.client=client;this.channel=channel;this.chaincode=chaincode;this.signer=signer; this.contract=gateway.getNetwork(channel).getContract(chaincode,'HistoricalInventoryContract');this.qscc=gateway.getNetwork(channel).getContract('qscc'); }
  static async connect(environment=process.env) {
    const root=resolve(environment.BLOODLEDGER_REPOSITORY_ROOT??process.cwd());
    const org=environment.FABRIC_ORGANIZATION_ROOT??join(root,'network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local');
    const msp=environment.FABRIC_API_MSP_ROOT??join(org,'users/ApiGateway@mediatrix.bloodledger.local/msp');
    const endpoint=environment.FABRIC_PEER_ENDPOINT??'127.0.0.1:7051';
    if(!['127.0.0.1:7051','localhost:7051','peer0-mediatrix:7051'].includes(endpoint)) throw new HistoricalFailure('HISTORICAL_LOCAL_TARGET_REQUIRED',true);
    const key=createPrivateKey(await readFile(await oneFile(join(msp,'keystore'))));
    const signer=signers.newPrivateKeySigner(key);
    const credentials=await readFile(await oneFile(join(msp,'signcerts')));
    const tlsRoot=await readFile(environment.FABRIC_TLS_ROOT??join(org,'peers/peer0.mediatrix.bloodledger.local/tls/ca.crt'));
    const client=new grpc.Client(endpoint,grpc.credentials.createSsl(tlsRoot),{'grpc.ssl_target_name_override':'peer0.mediatrix.bloodledger.local'});
    const gateway=connect({client,identity:{mspId:'MediatrixMSP',credentials},signer,hash:hash.sha256,evaluateOptions:()=>({deadline:Date.now()+15_000}),endorseOptions:()=>({deadline:Date.now()+30_000}),submitOptions:()=>({deadline:Date.now()+15_000}),commitStatusOptions:()=>({deadline:Date.now()+30_000})});
    return new HistoricalLedger(gateway,client,environment.FABRIC_CHANNEL??'bloodledger-dev',environment.FABRIC_CHAINCODE??'bloodledger-inventory',signer);
  }
  close() { this.gateway.close();this.client.close(); }
  async prepare(command) {
    const proposal=this.contract.newProposal(command.operation,{arguments:[JSON.stringify(command.payload)]});
    const transaction=await proposal.endorse();
    const signature=await this.signer(transaction.getDigest());
    const signed=this.gateway.newSignedTransaction(transaction.getBytes(),signature);
    return {transactionId:signed.getTransactionId(),bytes:signed.getBytes()};
  }
  async inspect(command) {
    let bytes;
    try { bytes=await this.qscc.evaluateTransaction('GetTransactionByID',this.channel,command.transaction_id); }
    catch(error) {
      // Only an explicit ledger-index not-found permits resubmitting the identical envelope.
      const messages=[error.message,...(error.details??[]).map(detail=>detail.message)].join(' ');
      if(/Entry not found in index|transaction .* not found|no such transaction/i.test(messages)) return null;
      throw new HistoricalFailure('HISTORICAL_LEDGER_QUERY_UNAVAILABLE');
    }
    const block=await this.qscc.evaluateTransaction('GetBlockByTxID',this.channel,command.transaction_id);
    return decodeHistoricalEvidence(bytes,block,{transactionId:command.transaction_id,channel:this.channel,chaincode:this.chaincode,operation:command.operation,payload:command.payload});
  }
  async submitSaved(command) {
    const transaction=this.gateway.newTransaction(command.signed_transaction);
    assert(transaction.getTransactionId()===command.transaction_id,'HISTORICAL_SAVED_TRANSACTION_MISMATCH');
    const submitted=await transaction.submit(); const status=await submitted.getStatus();
    if(!status.successful||status.code!==0) throw new HistoricalFailure('HISTORICAL_TRANSACTION_INVALID',true);
  }
  async readSnapshot(id) { return JSON.parse(text(await this.contract.evaluateTransaction('ReadSnapshot',id))); }
  async readUnit(snapshotId,id) { return JSON.parse(text(await this.contract.evaluateTransaction('ReadUnit',snapshotId,id))); }
}
