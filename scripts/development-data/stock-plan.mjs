// TP-STOCK-01 / BR-INV-01–07: pure, versioned population planning.
import { createHmac } from 'node:crypto';
import { canonical, digest, id } from './scenario.mjs';

import { validateReviewedScenarioBytes } from './stock-review.mjs';
export { SCENARIO_FILE_SHA256, SCENARIO_SHA256 } from './stock-review.mjs';
export const PREVIEW_SCHEMA = 'OCR_OPERATIONAL_STOCK_PREVIEW_V1';
export const EXECUTION_SCHEMA = 'OCR_OPERATIONAL_STOCK_EXECUTION_V1';
export const INSTITUTION_OPERATOR_MODE = 'INSTITUTION_OPERATOR_V1';
export function requireStock(condition, code) { if (!condition) throw new Error(code); }
export function seal(value) { return { ...value, manifestSha256: digest(value) }; }
export function unseal(value, approved) {
  const { manifestSha256, ...unsigned } = value;
  requireStock(manifestSha256 === digest(unsigned) && manifestSha256 === approved, 'STOCK_MANIFEST_APPROVAL_INVALID');
  return unsigned;
}
export const validateScenarioBytes = validateReviewedScenarioBytes;
export function requirePopulationWindow(scenario, now) {
  const time = new Date(now).getTime();
  requireStock(Number.isFinite(time) && time >= Date.parse(scenario.populationNotBefore) && time < Date.parse(scenario.t0), 'STOCK_POPULATION_WINDOW_CLOSED');
}
export function verificationWindow(scenario, now) {
  return Date.parse(now) >= Date.parse(scenario.t0) && Date.parse(now) < Date.parse(scenario.verificationWindowEndExclusive);
}
export function allocateLabels(scenario, targetSha256, start, lookupKey) {
  requireStock(Number.isSafeInteger(start) && start >= 1 && start + scenario.units.length <= 10000, 'STOCK_LABEL_RANGE_INVALID');
  const runId = id('STOCK_', `${targetSha256}|${digest(scenario)}`);
  const collection = new Date(scenario.units[0].collectedAt).toISOString();
  return scenario.units.map((unit, index) => {
    const donationNumber = `MM${collection.slice(2,4)}-${collection.slice(5,7)}-${String(start + index).padStart(4,'0')}`;
    const lookupHmac = createHmac('sha256', lookupKey).update(donationNumber).digest('hex');
    const idempotencyKey = id('IDEM_', `${runId}|${unit.unitKey}|capture`);
    return { ...unit, name: unit.unitKey, donationNumber, lookupHmac, idempotencyKey,
      componentId: id('COMP_', idempotencyKey), donationId: `DON_${digest(`${unit.issuerInstitutionId}:${lookupHmac}`).slice(0,40).toUpperCase()}`,
      collectedAt: new Date(unit.collectedAt).toISOString(), expiresAt: new Date(unit.expiresAt).toISOString() };
  });
}
export function reservationPlan(scenario, labels, baseline, eventTime, runId) {
  const stock = [...baseline.map(c => ({ ...c })), ...labels.map(l => ({ ...l, institutionId: l.custodyInstitutionId, inventoryStatus: 'AVAILABLE', inventoryVersion: 1 }))];
  const ordered = [...scenario.reservations].sort((a,b) => a.bloodType.localeCompare(b.bloodType) || a.componentType.localeCompare(b.componentType) || (a.purpose === b.purpose ? a.reservationKey.localeCompare(b.reservationKey) : a.purpose === 'TRANSFER' ? -1 : 1));
  return ordered.map(reservation => {
    const intended = labels.filter(l => reservation.unitKeys.includes(l.unitKey)).map(l => l.componentId);
    const eligible = stock.filter(c => c.inventoryStatus === 'AVAILABLE' && c.institutionId === reservation.sourceInstitutionId && c.bloodType === reservation.bloodType && c.componentType === reservation.componentType && Date.parse(c.expiresAt) > Date.parse(eventTime))
      .sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || a.componentId.localeCompare(b.componentId));
    const selected = eligible.slice(0, reservation.quantity);
    requireStock(selected.length === reservation.quantity && selected.length === intended.length && selected.every(c => intended.includes(c.componentId)), 'STOCK_GLOBAL_FEFO_MEMBERSHIP_CONFLICT');
    selected.forEach(c => { c.inventoryStatus = 'RESERVED'; });
    const idempotencyKey = id('IDEM_', `${runId}|${reservation.reservationKey}|reserve`);
    return { ...reservation, selectedComponentIds: selected.map(c => c.componentId), expectedComponentVersions: selected.map(c => c.inventoryVersion),
      idempotencyKey, reservationId: reservation.purpose === 'LOCAL_RELEASE' ? id('RES_', idempotencyKey) : id('RES_', `${runId}|${reservation.reservationKey}`),
      workflowId: id(reservation.purpose === 'TRANSFER' ? 'TRF_' : 'REL_', `${runId}|${reservation.workflowKey}`) };
  });
}
export function operationsFor(execution) {
  const corr = key => 'CORR_' + digest(key).slice(0,32).toUpperCase();
  const operations = [];
  const add = (account, path, payload, key) => operations.push({ account, path, payload, idempotencyKey: key, commandId: id('CMD_', key), payloadSha256: digest(payload) });
  for (const label of execution.labels) {
    for (const field of ['donationNumber','bloodType','collectedAt','expiresAt']) requireStock(Number.isInteger(label.ocr[field]) && label.ocr[field] >= 90 && label.ocr[field] <= 100, 'STOCK_OCR_CONFIDENCE_INVALID');
    requireStock(Date.parse(label.capturedAt) <= Date.parse(execution.confirmedAt), 'STOCK_CONFIRMATION_TIME_INVALID');
    add('coordinator', '/api/v2/inbound-captures', { componentType: label.componentType, bloodType: label.bloodType, collectedAt: label.collectedAt, expiresAt: label.expiresAt,
      donationNumber: label.donationNumber, captureMethod: 'OCR', capturePolicyVersion: 'INBOUND_OCR_V1', issuerInstitutionId: label.issuerInstitutionId,
      bloodTypeEvidence: { source: 'OCR_LABEL', confirmed: true }, componentEvidence: { source: 'OCR_LABEL', confirmed: true },
      capturedAt: label.capturedAt, confirmedAt: execution.confirmedAt, eventTime: execution.confirmedAt, correlationId: corr(label.idempotencyKey),
      ocrEvidence: { engine: label.engine, engineVersion: label.engineVersion, fieldConfidence: Object.fromEntries(['donationNumber','bloodType','collectedAt','expiresAt'].map(k => [k,label.ocr[k]])) } }, label.idempotencyKey);
  }
  for (const reservation of execution.reservations) {
    const shared = { eventTime: execution.confirmedAt, correlationId: corr(reservation.idempotencyKey) };
    if (reservation.purpose === 'TRANSFER') {
      const key = id('IDEM_', `${execution.runId}|${reservation.workflowKey}|request`);
      add('recipient', '/api/v2/transfers', { transferId: reservation.workflowId, bloodType: reservation.bloodType, componentType: reservation.componentType, quantity: reservation.quantity,
        urgency: 'ROUTINE', sourceInstitutionId: reservation.sourceInstitutionId, destinationInstitutionId: reservation.destinationInstitutionId, requestTime: execution.confirmedAt, eventTime: execution.confirmedAt, correlationId: corr(key) }, key);
      add('coordinator', '/api/v2/reservations', { ...shared, reservationId: reservation.reservationId, transferId: reservation.workflowId, selectedComponentIds: reservation.selectedComponentIds, expectedComponentVersions: reservation.expectedComponentVersions }, reservation.idempotencyKey);
    } else {
      add('coordinator', '/api/v2/local-releases', { ...shared, releaseId: reservation.workflowId, bloodType: reservation.bloodType, componentType: reservation.componentType, quantity: reservation.quantity }, reservation.idempotencyKey);
    }
  }
  requireStock(new Set(operations.map(o => o.commandId)).size === operations.length, 'STOCK_COMMAND_COLLISION');
  return operations;
}
export function freezePreview(preview, approved, now) {
  const unsigned = unseal(preview, approved);
  requireStock(unsigned.schemaVersion === PREVIEW_SCHEMA, 'STOCK_PREVIEW_SCHEMA_INVALID');
  requirePopulationWindow(unsigned.scenario, now);
  const execution = { ...unsigned, schemaVersion: EXECUTION_SCHEMA, previewSha256: approved, confirmedAt: new Date(now).toISOString() };
  execution.operations = operationsFor(execution);
  return seal(execution);
}
export function assertPreserved(expected, actual) {
  requireStock(canonical(expected) === canonical(actual), 'STOCK_BASELINE_PRESERVATION_FAILED');
}
export function verifyOperationalCensus(snapshot, components) {
  const seen = new Set();
  for (const group of snapshot.groups) for (const row of group.bloodTypes) {
    const key = `${group.componentType}|${row.bloodType}`;
    requireStock(!seen.has(key),'STOCK_CENSUS_DUPLICATE_SERIES'); seen.add(key);
    const members = components.filter(c=>c.componentType === group.componentType && c.bloodType === row.bloodType);
    const available = members.filter(c=>c.inventoryStatus === 'AVAILABLE');
    const reserved = members.filter(c=>c.inventoryStatus === 'RESERVED');
    requireStock(row.availableCount === available.length && row.reservedCount === reserved.length && row.reportableCount === available.length+reserved.length && row.forecastEligibleAvailableCount === available.filter(c=>Date.parse(c.expiresAt)>Date.parse(snapshot.capturedAt)).length,'STOCK_CENSUS_COUNTS_MISMATCH');
  }
  requireStock(seen.size === 40,'STOCK_CENSUS_COVERAGE_INVALID');
}

export function verifyCapturedCensus(scenario, snapshot) {
  requireStock(snapshot && snapshot.scheduledFor === new Date(scenario.t0).toISOString() && verificationWindow(scenario,snapshot.capturedAt), 'STOCK_PERSISTED_CENSUS_WINDOW_INVALID');
  requireStock(Date.parse(snapshot.capturedAt) <= Date.now(), 'STOCK_PERSISTED_CENSUS_FUTURE_INVALID');
}
