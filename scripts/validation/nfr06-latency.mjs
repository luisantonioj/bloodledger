#!/usr/bin/env node
// TC-S01 / NFR-06: black-box end-to-end latency of one confirmed synthetic OCR capture,
// from API submission to ledger commitment and to dashboard visibility, on a running local stack.
// It writes one synthetic component to the ledger. Run it only on a stack you are allowed to change.
// Credentials come from the environment and are never logged:
//   BL_BASE_URL (default http://localhost:3000), BL_ORIGIN (default BL_BASE_URL),
//   BL_USERNAME, BL_PASSWORD, BL_OPERATOR_ID, BL_OPERATOR_PIN, BL_CONTRACT_VERSION (default V2.1)
// Usage: node scripts/validation/nfr06-latency.mjs [--runs 5] [--budget-ms 5000] [--out <file outside the repo>]
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(part => part.trim().split(/\s+/)));
const runs = Number(args.runs ?? 1), budgetMs = Number(args['budget-ms'] ?? 5000), timeoutMs = Number(args['timeout-ms'] ?? 60000);
const base = process.env.BL_BASE_URL ?? 'http://localhost:3000', origin = process.env.BL_ORIGIN ?? base;
const contractVersion = process.env.BL_CONTRACT_VERSION ?? 'V2.1';
for (const name of ['BL_USERNAME', 'BL_PASSWORD', 'BL_OPERATOR_ID', 'BL_OPERATOR_PIN']) if (!process.env[name]) { console.error(`Missing ${name}`); process.exit(2); }
if (!Number.isInteger(runs) || runs < 1 || runs > 20) { console.error('--runs must be 1..20'); process.exit(2); }

let cookie = '';
async function call(method, path, body, headers = {}) {
  const response = await fetch(base + path, { method, headers: { origin, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text(); let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${json?.error?.code ?? ''}`.trim());
  return json;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let institutionId = '';
const available = dashboard => dashboard.inventory.filter(row => row.institutionId === institutionId)
  .filter(row => row.bloodType === 'O_POSITIVE' && row.component === 'PACKED_RED_BLOOD_CELLS' && row.inventoryStatus === 'AVAILABLE').reduce((sum, row) => sum + row.confirmedCount, 0);

async function once(index) {
  const now = new Date().toISOString(), idempotencyKey = 'IDEM_NFR06_' + randomUUID().replaceAll('-', '').toUpperCase();
  const capture = {
    captureMethod: 'OCR', capturePolicyVersion: 'INBOUND_OCR_V1', issuerInstitutionId: 'INST_MEDIATRIX',
    donationNumber: `MM26-10-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    bloodType: 'O_POSITIVE', bloodTypeEvidence: { source: 'OCR_LABEL', confirmed: true }, componentType: 'PACKED_RED_BLOOD_CELLS', componentEvidence: { source: 'OCR_LABEL', confirmed: true },
    collectedAt: new Date(Date.now() - 86400000).toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    capturedAt: now, confirmedAt: now, eventTime: now, correlationId: 'CORR_' + randomUUID().replaceAll('-', '').toUpperCase(),
    ocrEvidence: { engine: 'synthetic-nfr06', engineVersion: '1', fieldConfidence: { donationNumber: 99, bloodType: 99, collectedAt: 99, expiresAt: 99 } },
  };
  const before = available(await call('GET', '/api/v2/dashboard'));
  const verification = await call('POST', '/api/v2/auth/operator-verifications', { operatorId: process.env.BL_OPERATOR_ID, pin: process.env.BL_OPERATOR_PIN, action: 'POST /api/v2/inbound-captures', payload: capture, idempotencyKey });
  const t0 = performance.now();
  const accepted = await call('POST', '/api/v2/inbound-captures', capture, { 'idempotency-key': idempotencyKey, 'x-bloodledger-contract-version': contractVersion, 'Operator-Verification': verification.verificationId });
  const tAccepted = performance.now(), statuses = [];
  let tCommitted = null, tVisible = null, last = null;
  while (performance.now() - t0 < timeoutMs && (tCommitted === null || tVisible === null)) {
    if (tCommitted === null) {
      const command = await call('GET', accepted.statusUrl);
      if (command.status !== last) { statuses.push({ status: command.status, atMs: Math.round(performance.now() - t0) }); last = command.status; }
      if (command.status === 'COMMITTED') tCommitted = performance.now();
      if (['FAILED', 'CONFLICT'].includes(command.status)) throw new Error('Command ended ' + command.status);
    }
    if (tVisible === null && available(await call('GET', '/api/v2/dashboard')) > before) tVisible = performance.now();
    await pause(100);
  }
  const ms = value => value === null ? null : Math.round(value - t0);
  return { run: index + 1, commandId: accepted.commandId, acceptedMs: ms(tAccepted), committedMs: ms(tCommitted), dashboardVisibleMs: ms(tVisible), visibleAfterCommitMs: tVisible === null || tCommitted === null ? null : Math.max(0, Math.round(tVisible - tCommitted)), statuses,
    // NFR-06 budget applies from ledger commitment to dashboard visibility; submission-to-visible is reported separately.
    withinBudget: tVisible !== null && tCommitted !== null && tVisible - tCommitted <= budgetMs };
}

institutionId = (await call('POST', '/api/v1/auth/session', { username: process.env.BL_USERNAME, password: process.env.BL_PASSWORD })).principal.institutionId;
const results = [];
for (let i = 0; i < runs; i++) { results.push(await once(i)); if (i < runs - 1) await pause(35000); }
const visible = results.map(r => r.dashboardVisibleMs).filter(v => v !== null).sort((a, b) => a - b);
const report = {
  schemaVersion: 'NFR06_LATENCY_V1', testCase: 'TC-S01', measuredAt: new Date().toISOString(), baseUrl: base, contractVersion, budgetMs, runs: results,
  summary: { completed: visible.length, maxVisibleAfterCommitMs: Math.max(...results.map(r => r.visibleAfterCommitMs ?? Infinity)), medianVisibleMs: visible.length ? visible[Math.floor((visible.length - 1) / 2)] : null, maxVisibleMs: visible.at(-1) ?? null, allWithinBudget: results.every(r => r.withinBudget) },
  classification: 'SIMULATION_ONLY', note: 'Synthetic capture on a local single-peer stack; not a production or clinical latency claim.',
};
const output = JSON.stringify(report, null, 2);
if (args.out) await writeFile(args.out, output + '\n'); else console.log(output);
process.exit(report.summary.allWithinBudget ? 0 : 1);
