// TP-JOP-D16 / TP-STOCK-01 / FR-12: API component reads carry a read-time expiryState that projections never store.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storedComponent} from '../../scripts/development-data/stock-cli.mjs';
const row = (inventoryStatus, expiresAt = '2026-10-18T00:00:00Z') => ({componentId:'CMP_SYNTH_1',inventoryStatus,expiresAt,inventoryVersion:2});
test('TP-JOP-D16: the derived expiryState is removed so API rows equal stored projections',()=>{
 for (const [status,state] of [['AVAILABLE','CURRENT'],['AVAILABLE','LABEL_EXPIRED_PENDING_EVALUATION'],['RESERVED','CURRENT'],['RESERVED','LABEL_EXPIRED_PENDING_EVALUATION'],['IN_TRANSIT','CURRENT'],['IN_TRANSIT','LABEL_EXPIRED_NOT_IN_INVENTORY'],['EXPIRED','EXPIRED']]) {
  assert.deepEqual(storedComponent({...row(status),expiryState:state}),row(status));
 }
});
test('TP-JOP-D16: a missing, unknown or status-inconsistent expiryState still fails as evidence mismatch',()=>{
 for (const [status,state] of [['AVAILABLE',undefined],['AVAILABLE','STALE'],['AVAILABLE','EXPIRED'],['EXPIRED','CURRENT'],['IN_TRANSIT','LABEL_EXPIRED_PENDING_EVALUATION'],['RESERVED','LABEL_EXPIRED_NOT_IN_INVENTORY']]) {
  assert.throws(()=>storedComponent({...row(status),expiryState:state}),/STOCK_EVIDENCE_MISMATCH/);
 }
});
