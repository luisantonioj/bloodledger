#!/usr/bin/env node
// J5 / TP-03: live V2 custody rehearsal on a retained synthetic host through the
// real API, operator grants, durable queue, worker, Fabric and projection.
// SIMULATION_ONLY. Credentials and label data stay in the private config/labels
// files; the report holds only identifiers, statuses and timings.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { InstitutionClient } from '../../scripts/development-data/institution-client.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
for (const name of ['config', 'labels', 'report', 'run', 'expired-component']) if (!args[name]) throw new Error(`REHEARSAL_ARGUMENT_REQUIRED: --${name}`);
if (!/^[A-Z0-9]{1,10}$/.test(args.run)) throw new Error('REHEARSAL_RUN_ID_INVALID');
const apiUrl = args.api ?? 'http://127.0.0.1:3000';
const config = JSON.parse(await readFile(args.config, 'utf8'));
const labels = new Map(JSON.parse(await readFile(args.labels, 'utf8')).labels.map(label => [label.componentId, label]));
const client = new InstitutionClient(config, apiUrl);
const SOURCE = 'INST_MEDIATRIX', DESTINATION = 'INST_SYNTH_MEDIX';
const PACE_MS = 35_000; // Same per-institution spacing as the stock runner (30 grants / 15 minutes).
const steps = [];
const lastCommandAt = new Map();

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const corr = () => 'CORR_' + randomBytes(16).toString('hex').toUpperCase();
const key = step => `IDEM_J5_${args.run}_${step}`;
const generatedId = (prefix, idempotencyKey) => prefix + createHash('sha256').update(idempotencyKey, 'utf8').digest('hex').toUpperCase().slice(0, 40);
const id = (prefix, scenario) => `${prefix}_J5_${args.run}_${scenario}`;

async function command(account, step, path, payload) {
  const wait = PACE_MS - (Date.now() - (lastCommandAt.get(account) ?? 0));
  if (wait > 0) await pause(wait);
  lastCommandAt.set(account, Date.now());
  const started = Date.now();
  const result = await client.command(account, path, payload, key(step));
  const record = { step, account, path, commandId: result.commandId ?? null, accepted: result.status ?? null, replayed: result.replayed ?? null, startedAt: new Date(started).toISOString() };
  steps.push(record);
  if (!result.commandId) return { record, result };
  for (let attempt = 0; attempt < 90; attempt++) {
    const status = await client.read(account, `/api/v2/commands/${encodeURIComponent(result.commandId)}`);
    if (['COMMITTED', 'FAILED', 'CONFLICT'].includes(status.status)) {
      Object.assign(record, { status: status.status, safeErrorCode: status.safeErrorCode, settledMs: Date.now() - started });
      if (status.status !== 'COMMITTED') throw new Error(`REHEARSAL_COMMAND_NOT_COMMITTED: ${step} ${status.status} ${status.safeErrorCode}`);
      return { record, result };
    }
    await pause(2_000);
  }
  record.status = 'TIMEOUT';
  throw new Error(`REHEARSAL_COMMAND_TIMEOUT: ${step}`);
}

const reservation = reservationId => client.read('coordinator', `/api/v2/reservations/${reservationId}`);
async function fefo(bloodType, componentType, count = 1) {
  const eventMs = Date.now();
  const { components } = await client.read('coordinator', '/api/v2/components');
  return components
    .filter(c => c.institutionId === SOURCE && c.inventoryStatus === 'AVAILABLE' && c.bloodType === bloodType && c.componentType === componentType && Date.parse(c.expiresAt) > eventMs + 3_600_000)
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || a.componentId.localeCompare(b.componentId))
    .slice(0, count);
}
async function requestTransfer(step, scenario, bloodType, componentType) {
  const time = now();
  return command('recipient', step, '/api/v2/transfers', { bloodType, componentType, correlationId: corr(), destinationInstitutionId: DESTINATION, eventTime: time, quantity: 1, requestTime: time, sourceInstitutionId: SOURCE, transferId: id('TRF', scenario), urgency: 'ROUTINE' });
}
async function reserve(step, scenario, bloodType, componentType) {
  const [selected] = await fefo(bloodType, componentType);
  if (!selected) throw new Error('REHEARSAL_FEFO_STOCK_UNAVAILABLE');
  await command('coordinator', step, '/api/v2/reservations', { correlationId: corr(), eventTime: now(), expectedComponentVersions: [selected.inventoryVersion], reservationId: id('RES', scenario), selectedComponentIds: [selected.componentId], transferId: id('TRF', scenario) });
  return selected;
}
async function act(account, step, reservationId, action, extra = {}) {
  const { version } = await reservation(reservationId);
  return command(account, step, `/api/v2/reservations/${reservationId}/${action}`, { correlationId: corr(), eventTime: now(), expectedVersion: version, ...extra });
}
async function prepare(step, reservationId) {
  const time = now();
  return act('coordinator', step, reservationId, 'prepare', { preparedAt: time, preparedEvidenceDigest: createHash('sha256').update(`J5 synthetic preparation ${reservationId}`).digest('hex'), preparedEvidenceId: `EVD_J5_${args.run}_${reservationId.slice(-1)}` });
}

async function receive(step, componentId) {
  const label = labels.get(componentId);
  if (!label) throw new Error('REHEARSAL_RECEIPT_LABEL_UNAVAILABLE');
  const captured = now();
  return command('recipient', step, '/api/v2/inbound-captures', {
    captureMethod: 'OCR', capturePolicyVersion: 'INBOUND_OCR_V1', issuerInstitutionId: label.issuerInstitutionId, donationNumber: label.donationNumber,
    bloodType: label.bloodType, bloodTypeEvidence: { source: 'OCR_LABEL', confirmed: true }, componentType: label.componentType, componentEvidence: { source: 'OCR_LABEL', confirmed: true },
    collectedAt: label.collectedAt, expiresAt: label.expiresAt, capturedAt: captured, confirmedAt: captured, eventTime: captured, correlationId: corr(),
    ocrEvidence: { engine: label.engine, engineVersion: label.engineVersion, fieldConfidence: { donationNumber: label.ocr.donationNumber, bloodType: label.ocr.bloodType, collectedAt: label.ocr.collectedAt, expiresAt: label.ocr.expiresAt } },
  });
}

// --scenarios selects F,A,B,C,D,E (default all). A6 alone re-receives the existing scenario A
// reservation under --receipt-attempt, so a fixed receipt can resume without repeating A1-A5.
const selected = new Set((args.scenarios ?? 'F,A,B,C,D,E').split(','));
const receiptStep = `A6${args['receipt-attempt'] ? `R${args['receipt-attempt']}` : ''}`;
const summary = { classification: 'SIMULATION_ONLY', validation: 'JOPIA_SELF_VALIDATION', run: args.run, apiUrl, startedAt: now(), selected: [...selected], scenarios: {} };
try {
  // Pick a combination whose FEFO-first unit has a known synthetic label, so the destination can OCR-capture it on receipt.
  const { components } = await client.read('coordinator', '/api/v2/components');
  const combinations = [...new Set(components.filter(c => c.inventoryStatus === 'AVAILABLE' && c.institutionId === SOURCE).map(c => `${c.bloodType}|${c.componentType}`))];
  let combination;
  for (const candidate of combinations) { const [blood, type] = candidate.split('|'); const units = await fefo(blood, type, 3); if (units.length === 3 && labels.has(units[0].componentId)) { combination = [blood, type]; break; } }
  if (!combination) throw new Error('REHEARSAL_LABELLED_STOCK_UNAVAILABLE');
  const [bloodType, componentType] = combination;
  summary.combination = { bloodType, componentType };

  // F — J3 live negative: a stale command time is rejected before queuing.
  if (selected.has('F')) try {
    const stale = new Date(Date.now() - 3_600_000).toISOString();
    lastCommandAt.set('recipient', Date.now());
    await client.command('recipient', '/api/v2/transfers', { bloodType, componentType, correlationId: corr(), destinationInstitutionId: DESTINATION, eventTime: stale, quantity: 1, requestTime: stale, sourceInstitutionId: SOURCE, transferId: id('TRF', 'F'), urgency: 'ROUTINE' }, key('F1'));
    summary.scenarios.F = { result: 'FAIL', reason: 'stale command accepted' };
  } catch (error) {
    const queued = (await client.read('recipient', `/api/v2/commands?idempotencyKey=${key('F1')}`)).commands.length;
    summary.scenarios.F = { result: error.message === 'V2_COMMAND_TIME_OUT_OF_WINDOW' && queued === 0 ? 'PASS' : 'FAIL', code: error.message, queued };
  }

  // A — transfer request, FEFO reservation, prepare, dispatch, transit and OCR receipt.
  if (selected.has('A') || selected.has('A6')) {
    let componentA;
    if (selected.has('A')) {
      await requestTransfer('A1', 'A', bloodType, componentType);
      componentA = (await reserve('A2', 'A', bloodType, componentType)).componentId;
      await prepare('A3', id('RES', 'A'));
      await act('coordinator', 'A4', id('RES', 'A'), 'dispatch');
      await act('coordinator', 'A5', id('RES', 'A'), 'transit');
    } else {
      const existing = await reservation(id('RES', 'A'));
      if (existing.status !== 'IN_TRANSIT') throw new Error(`REHEARSAL_RECEIPT_NOT_IN_TRANSIT: ${existing.status}`);
      componentA = existing.components[0].componentId;
    }
    await receive(receiptStep, componentA);
    const received = await client.read('recipient', `/api/v2/components/${componentA}`).catch(() => null);
    summary.scenarios.A = { result: received?.institutionId === DESTINATION ? 'PASS' : 'FAIL', componentId: componentA, destinationView: received && { institutionId: received.institutionId, inventoryStatus: received.inventoryStatus, expiryState: received.expiryState }, reservation: await reservation(id('RES', 'A')).then(r => ({ status: r.status, version: r.version })).catch(() => ({ status: 'OUTSIDE_SOURCE_SCOPE' })) };
  }

  // B — local release: server FEFO reservation, prepare, completion.
  if (selected.has('B')) {
    const releaseKey = key('B1');
    await command('coordinator', 'B1', '/api/v2/local-releases', { bloodType, componentType, correlationId: corr(), eventTime: now(), quantity: 1, releaseId: id('REL', 'B') });
    const releaseReservation = generatedId('RES_', releaseKey);
    await prepare('B2', releaseReservation);
    await act('coordinator', 'B3', releaseReservation, 'local-release-complete');
    summary.scenarios.B = { result: 'PASS', reservationId: releaseReservation, final: await reservation(releaseReservation).then(r => ({ status: r.status, components: r.components.map(c => c.inventoryStatus) })) };

  }

  // C — cancel an active reservation; stock returns to AVAILABLE.
  if (selected.has('C')) {
    await requestTransfer('C1', 'C', bloodType, componentType);
    const unitC = await reserve('C2', 'C', bloodType, componentType);
    await act('coordinator', 'C3', id('RES', 'C'), 'cancel');
    const afterCancel = await client.read('coordinator', `/api/v2/components/${unitC.componentId}`);
    summary.scenarios.C = { result: afterCancel.inventoryStatus === 'AVAILABLE' ? 'PASS' : 'FAIL', componentId: unitC.componentId, inventoryStatus: afterCancel.inventoryStatus, final: await reservation(id('RES', 'C')).then(r => r.status) };

  }

  // D — compromise a dispatched reservation.
  if (selected.has('D')) {
    await requestTransfer('D1', 'D', bloodType, componentType);
    const unitD = await reserve('D2', 'D', bloodType, componentType);
    await prepare('D3', id('RES', 'D'));
    await act('coordinator', 'D4', id('RES', 'D'), 'dispatch');
    await act('coordinator', 'D5', id('RES', 'D'), 'compromise', { reasonCode: 'SYNTHETIC_REHEARSAL_DAMAGE' });
    summary.scenarios.D = { result: 'PASS', componentId: unitD.componentId, final: await reservation(id('RES', 'D')).then(r => ({ status: r.status, components: r.components.map(c => c.inventoryStatus) })) };

  }

  // E — J4: read state, server-timed expiry evaluation, then the expired alert acknowledgement.
  if (selected.has('E')) {
    const expired = args['expired-component'];
    const before = await client.read('coordinator', `/api/v2/components/${expired}`);
    await command('coordinator', 'E1', `/api/v2/components/${expired}/expiry`, { correlationId: corr(), expectedVersion: before.inventoryVersion });
    const after = await client.read('coordinator', `/api/v2/components/${expired}`);
    const alerts = await client.read('coordinator', '/api/v2/alerts');
    const alertId = `V2EXP_${expired}`;
    const listed = alerts.alerts?.some(alert => alert.alertId === alertId) ?? false;
    await command('coordinator', 'E2', `/api/v2/alerts/${alertId}/acknowledge`, { correlationId: corr() });
    summary.scenarios.E = { result: before.expiryState === 'LABEL_EXPIRED_PENDING_EVALUATION' && after.inventoryStatus === 'EXPIRED' && after.expiryState === 'EXPIRED' && listed ? 'PASS' : 'FAIL', before: { inventoryStatus: before.inventoryStatus, expiryState: before.expiryState }, after: { inventoryStatus: after.inventoryStatus, expiryState: after.expiryState }, alertListed: listed };
  }

  summary.result = Object.values(summary.scenarios).every(s => s.result === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  summary.result = 'FAIL';
  summary.error = error instanceof Error ? error.message : 'REHEARSAL_UNEXPECTED_FAILURE';
} finally {
  summary.finishedAt = now();
  summary.steps = steps;
  await client.close();
  await writeFile(args.report, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ result: summary.result, error: summary.error, scenarios: Object.fromEntries(Object.entries(summary.scenarios).map(([k, v]) => [k, v.result])), steps: steps.length }));
}
