// TP-STOCK-01 / TP-JOP-D19 / BR-INV-01–07: a successor scenario reviews the live baseline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countStates, expectedCombinedCounts, requireBaselineShape } from '../../scripts/development-data/stock-cli.mjs';
import { LEGACY_SCENARIO_REVIEW } from '../../scripts/development-data/stock-review.mjs';
import { reservationPlan } from '../../scripts/development-data/stock-plan.mjs';

const unit = (inventoryStatus, extra = {}) => ({ inventoryStatus, ...extra });
const legacyNine = [...Array(6)].map(() => unit('AVAILABLE')).concat([unit('RESERVED'), unit('IN_TRANSIT'), unit('EXPIRED')]);
const mixed = [...legacyNine, unit('COMPROMISED'), unit('RELEASED'), unit('RECONCILIATION_HOLD')];
const successor = { ...LEGACY_SCENARIO_REVIEW, scenarioVersion: 'SYNTHETIC_OPERATIONAL_STOCK_522_V4' };

test('TP-STOCK-01: the V1 review still requires exactly the reviewed nine-unit baseline', () => {
  assert.doesNotThrow(() => requireBaselineShape(legacyNine, 9, LEGACY_SCENARIO_REVIEW));
  assert.throws(() => requireBaselineShape(mixed, 12, LEGACY_SCENARIO_REVIEW), /STOCK_REVIEWED_NINE_COMPONENT_BASELINE_REQUIRED/);
  assert.throws(() => requireBaselineShape(legacyNine, 11, LEGACY_SCENARIO_REVIEW), /STOCK_UNREVIEWED_GLOBAL_STOCK/);
});

test('TP-JOP-D19: a successor review accepts a mixed-state, multi-institution baseline', () => {
  assert.doesNotThrow(() => requireBaselineShape(mixed, mixed.length + 2, successor));
});

test('TP-JOP-D19: combined totals are the sealed baseline plus 486 available and 36 reserved', () => {
  assert.deepEqual(expectedCombinedCounts(legacyNine), { AVAILABLE: 492, EXPIRED: 1, IN_TRANSIT: 1, RESERVED: 37, total: 531 });
  const combined = expectedCombinedCounts(mixed);
  assert.equal(combined.total, 534);
  assert.equal(combined.COMPROMISED, 1);
  assert.equal(combined.AVAILABLE, 492);
});

test('NFR-05: malformed inventory states still fail closed', () => {
  assert.throws(() => countStates([unit(undefined)]), /STOCK_UNREVIEWED_COMPONENT_STATE/);
  assert.throws(() => countStates([unit('total')]), /STOCK_UNREVIEWED_COMPONENT_STATE/);
});

test('BR-INV-01: label-expired baseline stock cannot displace successor FEFO members', () => {
  const eventTime = '2026-10-20T03:00:00.000Z';
  const old = { componentId: 'COMP_OLD', institutionId: 'INST_MEDIATRIX', bloodType: 'A_POSITIVE', componentType: 'PRBC', inventoryStatus: 'AVAILABLE', inventoryVersion: 1, expiresAt: '2026-10-17T00:00:00.000Z' };
  const fresh = { unitKey: 'U1', componentId: 'COMP_NEW', custodyInstitutionId: 'INST_MEDIATRIX', bloodType: 'A_POSITIVE', componentType: 'PRBC', expiresAt: '2026-10-22T22:00:00.000Z' };
  const scenario = { reservations: [{ reservationKey: 'R1', workflowKey: 'W1', purpose: 'LOCAL_RELEASE', bloodType: 'A_POSITIVE', componentType: 'PRBC', quantity: 1, sourceInstitutionId: 'INST_MEDIATRIX', destinationInstitutionId: null, unitKeys: ['U1'] }] };
  const [plan] = reservationPlan(scenario, [fresh], [old], eventTime, 'STOCK_TEST');
  assert.deepEqual(plan.selectedComponentIds, ['COMP_NEW']);
});

test('TP-JOP-D19: terminal off-ledger failures do not block quiescence; live commands still do', async () => {
  const { QUIESCENCE_SQL, requireQuiescent } = await import('../../scripts/development-data/stock-cli.mjs');
  assert.match(QUIESCENCE_SQL, /status IN \('FAILED','CONFLICT'\) AND ledger_transaction_id IS NULL/);
  await assert.doesNotReject(requireQuiescent({ query: async () => ({ rows: [] }) }));
  await assert.rejects(requireQuiescent({ query: async () => ({ rows: [{ command_id: 'CMD_QUEUED' }] }) }), /STOCK_UNRELATED_PENDING_COMMANDS/);
});
