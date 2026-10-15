// PA-DEF-06 / ADR-044 SYNTHETIC_PRC_SUPPLY_V1 end-to-end probe on the disposable accounts database:
// real login, PIN-bound operator verification, routes, SQL constraints and audit. Synthetic data only.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PostgresPrcSupply } from '../build/src/prc-supply.js';

export async function probePrcSupply({ admin, runtime, app, sessions, pins, origin }) {
  const BANK_02 = 'USR_SYNTH_REVIEW_ROLE02', BANK_01 = 'USR_SYNTH_REVIEW_ROLE01', MEDIX_02 = 'USR_OP_BA806C9407FF05B6F3ECDA4D9CF4FCD9';
  const PRC = 'USR_OP_655989F204F82E3BE56E4A6E95F4A625', METROLIPA_03 = 'USR_OP_442D31C531892E2145033E6F18136B58';
  let assertions = 0, sequence = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const key = () => `IDEM_PRC_PROBE_${++sequence}_${randomBytes(4).toString('hex').toUpperCase()}`;
  const correlationId = () => `CORR_${randomBytes(16).toString('hex').toUpperCase()}`;
  const requiredBy = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const verify = (cookie, operatorId, path, payload, idempotencyKey) => app.inject({ method: 'POST', url: '/api/v2/auth/operator-verifications', headers: { origin, cookie }, payload: { operatorId, pin: pins[operatorId], action: `POST ${path}`, payload, idempotencyKey } });
  async function act(cookie, operatorId, path, payload, idempotencyKey = key()) {
    const grant = await verify(cookie, operatorId, path, payload, idempotencyKey);
    if (grant.statusCode !== 200) return { grant, response: undefined, idempotencyKey };
    const send = () => app.inject({ method: 'POST', url: path, headers: { origin, cookie, 'idempotency-key': idempotencyKey, 'operator-verification': grant.json().verificationId }, payload });
    return { grant, response: await send(), retry: send, idempotencyKey };
  }
  const read = (cookie, url) => app.inject({ method: 'GET', url, headers: { cookie } });
  const before = (await admin.query("SELECT (SELECT count(*) FROM app.v2_components)::int AS components,(SELECT count(*) FROM app.v2_commands)::int AS commands")).rows[0];
  const mediatrix = sessions.INST_MEDIATRIX, medix = sessions.INST_SYNTH_MEDIX, prc = sessions.PRC;

  // Submission: blood-bank ROLE-02 only, exact body, required-by window, idempotent replay.
  const body = { bloodType: 'O_NEGATIVE', componentType: 'PACKED_RED_BLOOD_CELLS', requestedQuantity: 3, urgency: 'URGENT', requiredBy: requiredBy(48), correlationId: correlationId() };
  const submitted = await act(mediatrix, BANK_02, '/api/v2/prc-supply-requests', body);
  check(submitted.response.statusCode, 200, submitted.response.body);
  const first = submitted.response.json();
  check(first.status, 'SUBMITTED'); check(first.version, 1); check(first.prcReference, null); check(first.ledger.status, 'NOT_APPLICABLE'); check(first.replayed, false);
  check(first.requestingInstitution.institutionId, 'INST_MEDIATRIX'); check(first.policyVersion, 'SYNTHETIC_PRC_SUPPLY_V1');
  const replay = await submitted.retry();
  check(replay.statusCode, 200); check(replay.json().requestId, first.requestId); check(replay.json().replayed, true);
  check((await admin.query('SELECT count(*)::int n FROM app.prc_supply_requests')).rows[0].n, 1);
  check((await verify(mediatrix, BANK_01, '/api/v2/prc-supply-requests', body, key())).statusCode, 403);
  check((await verify(sessions.REQUESTOR, METROLIPA_03, '/api/v2/prc-supply-requests', body, key())).statusCode, 403);
  const late = await act(mediatrix, BANK_02, '/api/v2/prc-supply-requests', { ...body, requiredBy: requiredBy(0.5), correlationId: correlationId() });
  check(late.response.statusCode, 400); check(late.response.json().error.code, 'PRC_SUPPLY_REQUIRED_BY_OUT_OF_WINDOW');
  const tooMany = await act(mediatrix, BANK_02, '/api/v2/prc-supply-requests', { ...body, requestedQuantity: 11, correlationId: correlationId() });
  check(tooMany.response.statusCode, 400);
  const withNote = await act(mediatrix, BANK_02, '/api/v2/prc-supply-requests', { ...body, note: 'free text is not collected', correlationId: correlationId() });
  check(withNote.response.statusCode, 400);

  // Read scope: requester sees its own; another bank sees nothing; PRC sees all; DOH and requesters are refused.
  check((await read(mediatrix, '/api/v2/prc-supply-requests')).json().rows.length, 1);
  check((await read(medix, '/api/v2/prc-supply-requests')).json().rows.length, 0);
  check((await read(medix, `/api/v2/prc-supply-requests/${first.requestId}`)).statusCode, 404);
  const prcList = (await read(prc, '/api/v2/prc-supply-requests')).json();
  check(prcList.scope, 'PRC_ALL'); check(prcList.rows[0].requestId, first.requestId);
  check((await read(sessions.DOH, '/api/v2/prc-supply-requests')).statusCode, 403);
  check((await read(sessions.REQUESTOR, '/api/v2/prc-supply-requests')).statusCode, 403);

  // PRC acknowledgement records the PRC-entered reference; a bank operator cannot respond.
  const ackPath = `/api/v2/prc-supply-requests/${first.requestId}/acknowledge`;
  check((await verify(mediatrix, BANK_02, ackPath, { expectedVersion: 1, correlationId: correlationId(), prcReference: 'PRC-SIM-0001' }, key())).statusCode, 403);
  const acknowledged = await act(prc, PRC, ackPath, { expectedVersion: 1, correlationId: correlationId(), prcReference: 'PRC-SIM-0001' });
  check(acknowledged.response.statusCode, 200, acknowledged.response.body);
  check(acknowledged.response.json().status, 'ACKNOWLEDGED'); check(acknowledged.response.json().prcReference, 'PRC-SIM-0001'); check(acknowledged.response.json().referenceProvenance, 'PRC_RECORDED_IN_SYSTEM'); check(acknowledged.response.json().version, 2);
  const lateCancel = await act(mediatrix, BANK_02, `/api/v2/prc-supply-requests/${first.requestId}/cancel`, { expectedVersion: 2, correlationId: correlationId() });
  check(lateCancel.response.statusCode, 409); check(lateCancel.response.json().error.code, 'PRC_SUPPLY_TRANSITION_INVALID');

  // A reference is unique; PRC can decline a submitted request with a reason code.
  const second = (await act(medix, MEDIX_02, '/api/v2/prc-supply-requests', { ...body, bloodType: 'A_POSITIVE', componentType: 'PLATELETS', requestedQuantity: 2, urgency: 'ROUTINE', correlationId: correlationId() })).response.json();
  const duplicate = await act(prc, PRC, `/api/v2/prc-supply-requests/${second.requestId}/acknowledge`, { expectedVersion: 1, correlationId: correlationId(), prcReference: 'PRC-SIM-0001' });
  check(duplicate.response.statusCode, 409); check(duplicate.response.json().error.code, 'PRC_SUPPLY_REFERENCE_CONFLICT');
  const declined = await act(prc, PRC, `/api/v2/prc-supply-requests/${second.requestId}/decline`, { expectedVersion: 1, correlationId: correlationId(), reasonCode: 'NO_STOCK' });
  check(declined.response.json().status, 'DECLINED'); check(declined.response.json().declineReason, 'NO_STOCK'); check(declined.response.json().prcReference, null);

  // Fulfilment: stale version and over-fulfilment are refused; partial fulfilment is recorded.
  const fulfilPath = `/api/v2/prc-supply-requests/${first.requestId}/fulfil`;
  const stale = await act(prc, PRC, fulfilPath, { expectedVersion: 1, correlationId: correlationId(), fulfilledQuantity: 2 });
  check(stale.response.statusCode, 409); check(stale.response.json().error.code, 'PRC_SUPPLY_VERSION_CONFLICT');
  check((await act(prc, PRC, fulfilPath, { expectedVersion: 2, correlationId: correlationId(), fulfilledQuantity: 4 })).response.statusCode, 400);
  const fulfilled = await act(prc, PRC, fulfilPath, { expectedVersion: 2, correlationId: correlationId(), fulfilledQuantity: 2 });
  check(fulfilled.response.json().status, 'FULFILLED'); check(fulfilled.response.json().fulfilledQuantity, 2); check(fulfilled.response.json().requestedQuantity, 3);

  // The requester can cancel only while SUBMITTED.
  const third = (await act(mediatrix, BANK_02, '/api/v2/prc-supply-requests', { ...body, correlationId: correlationId() })).response.json();
  const cancelled = await act(mediatrix, BANK_02, `/api/v2/prc-supply-requests/${third.requestId}/cancel`, { expectedVersion: 1, correlationId: correlationId() });
  check(cancelled.response.json().status, 'CANCELLED');

  // The detail carries the audited trail; PRC actions show to the requester with synthetic actor names.
  const detail = (await read(mediatrix, `/api/v2/prc-supply-requests/${first.requestId}`)).json();
  assert.deepEqual(detail.history.map((entry) => [entry.action, entry.resultingStatus]), [['PRC_SUPPLY_SUBMIT', 'SUBMITTED'], ['PRC_SUPPLY_ACKNOWLEDGE', 'ACKNOWLEDGED'], ['PRC_SUPPLY_FULFIL', 'FULFILLED']]); assertions++;
  check(detail.history[1].actor.institutionId, 'INST_SYNTH_PRC');
  assert.ok(detail.history.every((entry) => entry.actor.displayName === null || entry.actor.displayName.startsWith('Synthetic'))); assertions++;
  assert.doesNotMatch(JSON.stringify(detail), /pin|password|payload_sha256|idempotency/i); assertions++;

  // Off-chain only: no inventory, ledger command or custody change.
  const after = (await admin.query("SELECT (SELECT count(*) FROM app.v2_components)::int AS components,(SELECT count(*) FROM app.v2_commands)::int AS commands")).rows[0];
  assert.deepEqual(after, before); assertions++;
  const paged = (await read(prc, '/api/v2/prc-supply-requests?limit=1')).json();
  check(paged.rows.length, 1); assert.ok(paged.nextCursor); assertions++;
  const page2 = (await read(prc, `/api/v2/prc-supply-requests?limit=5&cursor=${encodeURIComponent(paged.nextCursor)}`)).json();
  check(page2.rows.length, 2);
  // Returned times keep milliseconds, so (time, id) cursors never skip rows within one second.
  assert.ok([...paged.rows, ...page2.rows].some((row) => !row.submittedAt.endsWith('.000Z'))); assertions++;
  // ADR-045 Activity History V2: opt-in PRC coordination for the requesting bank only; V1 unchanged.
  const activityV1 = (await read(mediatrix, '/api/v2/activity-history?limit=100')).json();
  check(activityV1.policyVersion, 'ACTIVITY_HISTORY_READ_V1');
  check(activityV1.rows.filter((row) => row.eventSource === 'PRC_SUPPLY_COORDINATION').length, 0);
  const prcEvents = async (cookie) => {
    const events = []; let cursor = null;
    do {
      const page = (await read(cookie, `/api/v2/activity-history?contract=ACTIVITY_HISTORY_READ_V2&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).json();
      check(page.policyVersion, 'ACTIVITY_HISTORY_READ_V2');
      events.push(...page.rows.filter((row) => row.eventSource === 'PRC_SUPPLY_COORDINATION')); cursor = page.nextCursor;
    } while (cursor);
    return events;
  };
  const mediatrixEvents = await prcEvents(mediatrix), medixEvents = await prcEvents(medix);
  // Mediatrix: first (submit, acknowledge, fulfil) + third (submit, cancel); Medix: second (submit, decline).
  check(mediatrixEvents.length, 5); check(medixEvents.length, 2);
  check(new Set(mediatrixEvents.map((row) => row.eventId)).size, 5);
  assert.ok(mediatrixEvents.every((row) => [first.requestId, third.requestId].includes(row.links.prcSupplyRequestId))); assertions++;
  assert.ok(medixEvents.every((row) => row.links.prcSupplyRequestId === second.requestId)); assertions++;
  const ackEvent = mediatrixEvents.find((row) => row.activityCode === 'PRC_SUPPLY_ACKNOWLEDGE');
  check(ackEvent.actor.institutionId, 'INST_SYNTH_PRC'); check(ackEvent.eventStatus, 'OFF_CHAIN_RECORDED'); check(ackEvent.ledger.status, 'NOT_APPLICABLE');
  check(ackEvent.coordination.resultingStatus, 'ACKNOWLEDGED');
  check(medixEvents.find((row) => row.activityCode === 'PRC_SUPPLY_DECLINE').coordination.reasonCode, 'NO_STOCK');
  check((await read(mediatrix, '/api/v2/activity-history?contract=ACTIVITY_HISTORY_READ_V9')).statusCode, 400);
  // Delayed replay (Lat, 2026-10-15): an accepted submission replays after its required-by falls inside
  // the 1 h window; a changed body still conflicts and a genuinely new submission is still refused.
  // The service is called with a controlled clock; authorization is the same requester rule.
  const service = new PostgresPrcSupply(runtime);
  const requester = { userId: BANK_02, displayName: 'Synthetic Operator', institutionId: 'INST_MEDIATRIX', institutionDisplayName: 'Synthetic Mediatrix', institutionCategory: 'HOSPITAL', roleId: 'ROLE-02', roleDisplayName: 'Verified operator', permissions: [], classification: 'SIMULATION_ONLY', accountCategory: 'BLOOD_BANK', operatorId: BANK_02 };
  const t0 = new Date(Date.now() + 365 * 24 * 3_600_000), later = new Date(t0.getTime() + 61 * 60_000);
  const delayedBody = { bloodType: 'B_NEGATIVE', componentType: 'WHOLE_BLOOD', requestedQuantity: 1, urgency: 'CRITICAL', requiredBy: new Date(t0.getTime() + 2 * 3_600_000).toISOString(), correlationId: correlationId() };
  const delayedKey = key();
  const original = await service.submit(requester, delayedBody, delayedKey, t0);
  check(original.replayed, false);
  const delayedReplay = await service.submit(requester, delayedBody, delayedKey, later);
  check(delayedReplay.replayed, true); check(delayedReplay.requestId, original.requestId); check(delayedReplay.status, 'SUBMITTED');
  await assert.rejects(service.submit(requester, { ...delayedBody, requestedQuantity: 2 }, delayedKey, later), (error) => error.code === 'PRC_SUPPLY_IDEMPOTENCY_CONFLICT'); assertions++;
  await assert.rejects(service.submit(requester, { ...delayedBody, correlationId: correlationId() }, key(), later), (error) => error.code === 'PRC_SUPPLY_REQUIRED_BY_OUT_OF_WINDOW'); assertions++;
  check((await admin.query('SELECT count(*)::int n FROM app.prc_supply_requests WHERE request_id=$1', [original.requestId])).rows[0].n, 1);
  console.log(`PRC supply probe passed with ${assertions} assertions`);
}
