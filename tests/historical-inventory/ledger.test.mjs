import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {decodeHistoricalEvidence} from '../../scripts/historical-inventory/ledger.mjs';
const require=createRequire(import.meta.url);
const {common,peer}=createRequire(require.resolve('@hyperledger/fabric-gateway'))('@hyperledger/fabric-protos');
function fixture(validation=0,blockValidation=0,contract='HistoricalInventoryContract') {
  const expected={transactionId:'a'.repeat(64),channel:'bloodledger-dev',chaincode:'bloodledger-inventory',contract,operation:contract==='InterviewCoreContract'?'RegisterInboundComponent':'RegisterUnit',payload:{actorUserId:'USR_SYNTH_HISTORICAL_IMPORT',snapshotId:'TEST',componentId:'TEST'}};
  const spec=new peer.ChaincodeSpec(),id=new peer.ChaincodeID(),input=new peer.ChaincodeInput();id.setName(expected.chaincode);spec.setChaincodeId(id);
  input.setArgsList([Buffer.from(`${contract}:${expected.operation}`),Buffer.from(JSON.stringify(expected.payload))]);spec.setInput(input);
  const invocation=new peer.ChaincodeInvocationSpec();invocation.setChaincodeSpec(spec);
  const proposal=new peer.ChaincodeProposalPayload();proposal.setInput(invocation.serializeBinary());
  const response=new peer.Response();response.setStatus(200);response.setPayload(Buffer.from(JSON.stringify({...(contract==='InterviewCoreContract'?{lastTransactionId:expected.transactionId}:{transactionId:expected.transactionId}),componentId:'TEST'})));
  const action=new peer.ChaincodeAction();action.setResponse(response);
  const responsePayload=new peer.ProposalResponsePayload();responsePayload.setExtension$(action.serializeBinary());
  const endorsed=new peer.ChaincodeEndorsedAction();endorsed.setProposalResponsePayload(responsePayload.serializeBinary());
  const actionPayload=new peer.ChaincodeActionPayload();actionPayload.setChaincodeProposalPayload(proposal.serializeBinary());actionPayload.setAction(endorsed);
  const transactionAction=new peer.TransactionAction();transactionAction.setPayload(actionPayload.serializeBinary());
  const transaction=new peer.Transaction();transaction.setActionsList([transactionAction]);
  const channelHeader=new common.ChannelHeader();channelHeader.setChannelId(expected.channel);channelHeader.setTxId(expected.transactionId);
  const header=new common.Header();header.setChannelHeader(channelHeader.serializeBinary());
  const payload=new common.Payload();payload.setHeader(header);payload.setData(transaction.serializeBinary());
  const envelope=new common.Envelope();envelope.setPayload(payload.serializeBinary());
  const processed=new peer.ProcessedTransaction();processed.setTransactionenvelope(envelope);processed.setValidationcode(validation);
  const block=new common.Block(),blockHeader=new common.BlockHeader(),blockData=new common.BlockData(),metadata=new common.BlockMetadata();
  blockHeader.setNumber(42);blockData.setDataList([envelope.serializeBinary()]);metadata.setMetadataList([new Uint8Array(),new Uint8Array(),new Uint8Array([blockValidation])]);
  block.setHeader(blockHeader);block.setData(blockData);block.setMetadata(metadata);
  return {expected,tx:processed.serializeBinary(),block:block.serializeBinary()};
}
test('NFR-02 binary ledger proof validates transaction ID, channel, operation, payload and block status',()=>{const f=fixture();const evidence=decodeHistoricalEvidence(f.tx,f.block,f.expected);assert.equal(evidence.blockNumber,'42');assert.equal(evidence.validationStatus,'VALID');assert.equal(evidence.asset.componentId,'TEST');});
test('NFR-02 inclusion without valid status or matching transaction evidence is rejected',()=>{
  for(const [validation,blockValidation] of [[11,0],[0,11]]){const f=fixture(validation,blockValidation);assert.throws(()=>decodeHistoricalEvidence(f.tx,f.block,f.expected),/INVALID|MISMATCH/);}
  const f=fixture();for(const key of ['transactionId','channel','chaincode','operation'])assert.throws(()=>decodeHistoricalEvidence(f.tx,f.block,{...f.expected,[key]:'wrong'}),/MISMATCH/);
  assert.throws(()=>decodeHistoricalEvidence(f.tx,f.block,{...f.expected,payload:{...f.expected.payload,componentId:'WRONG'}}),/MISMATCH/);
});

test("NFR-02 V2 receipts pin the InterviewCore namespace and actual lastTransactionId",()=>{const f=fixture(0,0,"InterviewCoreContract");assert.equal(decodeHistoricalEvidence(f.tx,f.block,f.expected).validationStatus,"VALID");assert.throws(()=>decodeHistoricalEvidence(f.tx,f.block,{...f.expected,contract:"HistoricalInventoryContract"}),/OPERATION_MISMATCH/);});
