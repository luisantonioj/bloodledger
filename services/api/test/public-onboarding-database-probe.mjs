// PA-ACCOUNT-03 / ADR-048 SYNTHETIC_PUBLIC_APPLICATION_V1 end-to-end probe on the disposable accounts
// database: public submission, sample claims, PRC review/activation, profile linkage, deregistration and
// reuse, concurrency, retention and rate limits. Synthetic catalog only; no retained host is touched.
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { sha256 } from '../build/src/hash.js';

export async function probePublicOnboarding({ admin, app, sessions, pins, origin }) {
  const PRC = 'USR_OP_655989F204F82E3BE56E4A6E95F4A625';
  let assertions = 0, sequence = 0;
  const check = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const key = () => `IDEM_PUBLIC_${++sequence}_${randomBytes(4).toString('hex').toUpperCase()}`;
  const correlationId = () => `CORR_${randomBytes(16).toString('hex').toUpperCase()}`;
  const password = () => randomBytes(18).toString('base64url');
  const cookie = r => String(r.headers['set-cookie']).split(';')[0];
  // Disposable database only: clear persistent throttle windows between phases.
  const resetWindows = () => admin.query('DELETE FROM app.operator_attempt_windows');
  const select = async (category, exclude) => app.inject({ method: 'GET', url: `/api/v2/onboarding/sample-facilities/selection?category=${category}${exclude ? `&exclude=${exclude}` : ''}` });
  const availability = async (category) => Object.fromEntries((await app.inject({ method: 'GET', url: `/api/v2/onboarding/sample-facilities?category=${category}` })).json().samples.map(s => [s.sampleId, s.availability]));
  const body = (selection, applicantPassword = password()) => ({ schemaVersion: 'PUBLIC_APPLICATION_V1', category: selection.fill.category, sample: selection.sample, facility: selection.fill.facility,
    qualification: { ...selection.fill.qualification, capabilityDeclarations: { proceduresDocumented: true, personnelEquipmentContinuity: true, verificationConsent: true } },
    primaryAccount: { ...selection.fill.primaryAccount, password: applicantPassword }, documents: selection.fill.documents,
    declaration: { syntheticDataOnly: true, accuracyAttested: true }, correlationId: correlationId() });
  const submit = (payload, idempotencyKey = key(), headers = { origin }) => app.inject({ method: 'POST', url: '/api/v2/onboarding/public-applications', headers: { ...headers, 'idempotency-key': idempotencyKey }, payload });
  async function selectSample(category, sampleId) {
    await resetWindows();
    for (let attempt = 0; attempt < 60; attempt++) { const r = (await select(category)).json(); if (!sampleId || r.sample?.sampleId === sampleId) return r; }
    throw new Error(`SAMPLE_NOT_SELECTED_${sampleId}`);
  }
  async function prc(path, payload) {
    const idempotencyKey = key();
    const grant = await app.inject({ method: 'POST', url: '/api/v2/auth/operator-verifications', headers: { origin, cookie: sessions.PRC }, payload: { operatorId: PRC, pin: pins[PRC], action: `POST ${path}`, payload, idempotencyKey } });
    check(grant.statusCode, 200, grant.body);
    return app.inject({ method: 'POST', url: path, headers: { origin, cookie: sessions.PRC, 'operator-verification': grant.json().verificationId, 'idempotency-key': idempotencyKey }, payload });
  }
  const decide = (id, action, payload) => prc(`/api/v2/onboarding/applications/${id}/${action}`, { correlationId: correlationId(), ...payload });
  async function register(applicationId, loginEmail) {
    check((await decide(applicationId, 'review', { expectedVersion: 1, verificationReference: 'SYNTHETIC_MANUAL_REVIEW', verificationOutcome: 'CONFIRMED' })).statusCode, 200);
    check((await decide(applicationId, 'approve', { expectedVersion: 2, reasonCode: 'REVIEW_COMPLETE' })).statusCode, 200);
    const credentials = { loginEmail, password: password(), operatorPin: String(randomInt(0, 100000000)).padStart(8, '0') };
    const activation = await decide(applicationId, 'activate', { expectedVersion: 3, reasonCode: 'REVIEW_COMPLETE', ...credentials });
    check(activation.statusCode, 200, activation.body);
    return credentials;
  }
  const institutionAction = (institutionId, action, expectedVersion) => prc(`/api/v2/onboarding/institutions/${institutionId}/${action}`, { expectedVersion, correlationId: correlationId(), reasonCode: 'INSTITUTION_REQUEST' });
  const login = (username, pass) => app.inject({ method: 'POST', url: '/api/v1/auth/session', headers: { origin }, payload: { username, password: pass } });
  const before = (await admin.query('SELECT (SELECT count(*) FROM app.institutions)::int institutions,(SELECT count(*) FROM app.application_users)::int users')).rows[0];
  await resetWindows();

  // Filling is read-only: repeated Fill Up writes no application, claim, user or institution.
  const fills = [];
  for (let n = 0; n < 8; n++) { const r = await select('BLOOD_BANK', fills.at(-1)?.sample.sampleId); check(r.statusCode, 200); check(r.headers['cache-control'], 'no-store'); fills.push(r.json()); }
  check(fills.every((f, i) => i === 0 || f.sample.sampleId !== fills[i - 1].sample.sampleId), true, 'consecutive Fill Up selects another sample');
  check((await admin.query('SELECT count(*)::int n FROM app.onboarding_sample_claims')).rows[0].n, 0);
  check((await admin.query("SELECT count(*)::int n FROM app.onboarding_applications WHERE schema_version='PUBLIC_APPLICATION_V1'")).rows[0].n, 0);
  check(JSON.stringify(fills).includes('"password"'), false);

  // Public submission needs no prior account, invitation or session, but still requires same origin.
  const bank = await selectSample('BLOOD_BANK', 'SAMPLE_BANK_01'), applicantPassword = password(), bankBody = body(bank, applicantPassword), bankKey = key();
  check((await submit(bankBody, bankKey, {})).json().error.code, 'ORIGIN_FORBIDDEN');
  check((await submit({ ...bankBody, category: 'PRC' })).json().error.code, 'ONB_CATEGORY_UNSUPPORTED');
  const unknown = await submit({ ...bankBody, invitationSecret: 'f'.repeat(64) });
  check(unknown.statusCode, 400); check(unknown.json().error.details[0].field, 'invitationSecret');
  check((await submit({ ...bankBody, declaration: { syntheticDataOnly: true, accuracyAttested: false } })).statusCode, 400);
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'ELIGIBLE', 'failed submissions do not consume a sample');
  const accepted = await submit(bankBody, bankKey);
  check(accepted.statusCode, 200, accepted.body); check(accepted.json().status, 'SUBMITTED'); check(accepted.json().sample.sampleId, 'SAMPLE_BANK_01');
  const applicationId = accepted.json().applicationId;
  const replay = await submit(bankBody, bankKey); check(replay.json().applicationId, applicationId); check(replay.json().replayed, true);
  check((await submit({ ...bankBody, facility: { ...bankBody.facility, streetAddress: '2 Synthetic Changed Street' } }, bankKey)).json().error.code, 'ONB_IDEMPOTENCY_CONFLICT');
  check((await submit(bankBody, bankKey.replace('IDEM_', 'IDEM_X'))).json().error.code, 'ONB_SAMPLE_UNAVAILABLE', 'pending sample is not duplicated');
  check((await submit({ ...bankBody, sample: null })).json().error.code, 'ONB_SAMPLE_IDENTITY_RESERVED', 'manual editing cannot bypass sample identity');
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'APPLICATION_IN_PROGRESS');
  for (let n = 0; n < 15; n++) check((await select('BLOOD_BANK')).json().sample.sampleId !== 'SAMPLE_BANK_01', true);
  const stored = (await admin.query('SELECT invitation_id,detail,password_verifier FROM app.onboarding_applications WHERE application_id=$1', [applicationId])).rows[0];
  check(stored.invitation_id, null); check(JSON.stringify(stored.detail).includes(applicantPassword), false);
  check(stored.detail.facility.officialPhone, bankBody.facility.officialPhone); check(stored.detail.qualification.headOfFacilityLicenseReference, bankBody.qualification.headOfFacilityLicenseReference);

  // Concurrent applicants filling the same sample: exactly one claim.
  const twin = await selectSample('BLOOD_BANK', 'SAMPLE_BANK_02');
  const race = await Promise.all([submit(body(twin)), submit(body(twin))]);
  check(race.filter(r => r.statusCode === 200).length, 1);
  check(race.find(r => r.statusCode !== 200).json().error.code, 'ONB_SAMPLE_UNAVAILABLE');
  check((await admin.query("SELECT count(*)::int n FROM app.onboarding_sample_claims WHERE sample_id='SAMPLE_BANK_02' AND status='ACTIVE'")).rows[0].n, 1);

  // Applicant scope: own detail without credentials; no PRC list access.
  const applicant = await app.inject({ method: 'POST', url: '/api/v2/onboarding/applicant/session', headers: { origin }, payload: { applicationId, password: applicantPassword } });
  check(applicant.statusCode, 200);
  const own = await app.inject({ method: 'GET', url: '/api/v2/onboarding/applicant/application', headers: { cookie: cookie(applicant) } });
  check(own.statusCode, 200); check(own.json().detail.facility.displayName, bankBody.facility.displayName); check(own.body.includes(applicantPassword), false); check(own.body.includes('verifier'), false);
  check((await app.inject({ method: 'GET', url: `/api/v2/onboarding/applications/${applicationId}`, headers: { cookie: cookie(applicant) } })).statusCode, 401);
  check((await app.inject({ method: 'GET', url: '/api/v2/onboarding/applicant/application' })).statusCode, 401);

  // PRC review reads: unchanged complete list, cursor pages and detail; DOH denied.
  const list = (await app.inject({ method: 'GET', url: '/api/v2/onboarding/applications', headers: { cookie: sessions.PRC } })).json();
  check('nextCursor' in list, false); check(list.applications.find(a => a.application_id === applicationId).schema_version, 'PUBLIC_APPLICATION_V1');
  const page = (await app.inject({ method: 'GET', url: '/api/v2/onboarding/applications?limit=1', headers: { cookie: sessions.PRC } })).json();
  check(page.applications.length, 1); check(page.nextCursor.startsWith('ONBA_'), true);
  const next = (await app.inject({ method: 'GET', url: `/api/v2/onboarding/applications?limit=1&cursor=${page.nextCursor}`, headers: { cookie: sessions.PRC } })).json();
  check(next.applications[0].application_id !== page.applications[0].application_id, true);
  check((await app.inject({ method: 'GET', url: '/api/v2/onboarding/applications?limit=1&cursor=ONBA_bad', headers: { cookie: sessions.PRC } })).json().error.code, 'ONB_CURSOR_INVALID');
  const detail = await app.inject({ method: 'GET', url: `/api/v2/onboarding/applications/${applicationId}`, headers: { cookie: sessions.PRC } });
  check(detail.json().application.claim_status, 'ACTIVE'); check(detail.body.includes('password'), false);
  check((await app.inject({ method: 'GET', url: `/api/v2/onboarding/applications/${applicationId}`, headers: { cookie: sessions.DOH } })).statusCode, 403);

  // Activation keeps PRC review and the requested login identifier; the sample becomes REGISTERED.
  check((await decide(applicationId, 'review', { expectedVersion: 1, verificationReference: 'SYNTHETIC_MANUAL_REVIEW', verificationOutcome: 'CONFIRMED' })).statusCode, 200);
  check((await decide(applicationId, 'approve', { expectedVersion: 2, reasonCode: 'REVIEW_COMPLETE' })).statusCode, 200);
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'APPLICATION_IN_PROGRESS', 'approval alone is not registration');
  // An ambiguous retry after PRC acted still replays the original submission result.
  const lateReplay = await submit(bankBody, bankKey);
  check(lateReplay.statusCode, 200); check(lateReplay.json().replayed, true); check(lateReplay.json().applicationId, applicationId);
  check(lateReplay.json().status, 'SUBMITTED', 'replay returns the original status'); check(lateReplay.json().version, 1);
  const wrong = await decide(applicationId, 'activate', { expectedVersion: 3, reasonCode: 'REVIEW_COMPLETE', loginEmail: 'bloodbank@elsewhere.bloodledger', password: password(), operatorPin: '12345678' });
  check(wrong.json().error.code, 'ONB_LOGIN_EMAIL_MISMATCH');
  const credentials = { loginEmail: bankBody.primaryAccount.requestedLoginEmail, password: password(), operatorPin: String(randomInt(0, 100000000)).padStart(8, '0') };
  check((await decide(applicationId, 'activate', { expectedVersion: 3, reasonCode: 'REVIEW_COMPLETE', ...credentials })).statusCode, 200);
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'REGISTERED');
  const accountLogin = await login(credentials.loginEmail, credentials.password); check(accountLogin.statusCode, 200);
  check(accountLogin.json().principal.roleId, 'ROLE-06'); check(accountLogin.json().principal.permissions.includes('inventory:write'), false);
  const institutionId = accountLogin.json().principal.institutionId;
  const profile = await app.inject({ method: 'GET', url: `/api/v2/onboarding/institutions/${institutionId}`, headers: { cookie: cookie(accountLogin) } });
  check(profile.json().facilityProfile.facility.legalName, bankBody.facility.legalName); check(profile.json().facilityProfile.loginEmail, credentials.loginEmail);
  check(profile.json().application.applicationId, applicationId); check(profile.json().application.deregisteredAt, null);
  check(profile.body.includes(credentials.password) || profile.body.includes(credentials.operatorPin) || profile.body.includes(applicantPassword), false);
  check('applicantReference' in profile.json().facilityProfile, false);
  check('capabilityDeclarations' in profile.json().facilityProfile.qualification, false, 'declarations are not retained in the durable profile');
  check(profile.json().facilityProfile.qualification.authorityReference, bankBody.qualification.authorityReference);

  // Suspension is not deletion; deregistration requires suspension and no retained custody.
  check((await institutionAction(institutionId, 'deregister', 1)).json().error.code, 'ONB_TRANSITION_INVALID');
  check((await institutionAction(institutionId, 'suspend', 1)).statusCode, 200);
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'REGISTERED', 'suspension does not release a sample');
  const hash = sha256({ publicProbe: institutionId });
  await admin.query("INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES('DON_PUBLIC_PROBE','INST_MEDIATRIX','FABRICATED_TEST_CIPHERTEXT',repeat('a',32),repeat('b',32),'TEST_ONLY',$1,'USR_SYNTH_REVIEW_ROLE01',now(),now(),'SIMULATION_ONLY')", [hash]);
  await admin.query("INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification) VALUES('COMP_PUBLIC_PROBE','DON_PUBLIC_PROBE','INST_MEDIATRIX',$1,'PACKED_RED_BLOOD_CELLS','A_POSITIVE',now()-interval '1 day',now()+interval '29 days',$2,'AVAILABLE',1,$3,$4,'PERSISTENT_DEVELOPMENT_CORE_V1',now(),now(),'SIMULATION_ONLY')", [hash, institutionId, sha256({ receipt: hash }), correlationId()]);
  check((await institutionAction(institutionId, 'deregister', 2)).json().error.code, 'ONB_RETAINED_OBLIGATIONS_BLOCK_DEREGISTRATION');
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'REGISTERED', 'failed deletion does not release a sample');
  await admin.query("UPDATE app.v2_components SET inventory_status='EXPIRED' WHERE component_id='COMP_PUBLIC_PROBE'");
  const deregistered = await institutionAction(institutionId, 'deregister', 2);
  check(deregistered.statusCode, 200, deregistered.body); check(deregistered.json().status, 'DEREGISTERED');
  check((await admin.query("SELECT count(*)::int n FROM app.v2_components WHERE component_id='COMP_PUBLIC_PROBE' AND institution_id=$1", [institutionId])).rows[0].n, 1, 'domain history is retained');
  check((await login(credentials.loginEmail, credentials.password)).statusCode, 401);
  check((await institutionAction(institutionId, 'reactivate', 3)).json().error.code, 'ONB_TRANSITION_INVALID');
  check((await admin.query("SELECT count(*)::int n FROM app.institution_operators WHERE institution_id=$1 AND status='ACTIVE'", [institutionId])).rows[0].n, 0);
  check((await admin.query("SELECT release_reason FROM app.onboarding_sample_claims WHERE application_id=$1", [applicationId])).rows[0].release_reason, 'DEREGISTERED');
  check((await availability('BLOOD_BANK')).SAMPLE_BANK_01, 'ELIGIBLE', 'actual deregistration restores the sample');
  check((await institutionAction('INST_SYNTH_DOH', 'deregister', 1)).json().error.code, 'ONB_NOT_AUTHORIZED');

  // A later registration is a new instance with a new institution and login identifier.
  const reuse = await selectSample('BLOOD_BANK', 'SAMPLE_BANK_01');
  check(reuse.sample.instance, 2); check(reuse.fill.primaryAccount.requestedLoginEmail, 'bloodbank@sbank01-i2.bloodledger');
  check((await submit({ ...bankBody, correlationId: correlationId() })).json().error.code, 'ONB_SAMPLE_STALE', 'stale instance is rejected');
  const second = await submit(body(reuse)); check(second.statusCode, 200, second.body);
  const secondCredentials = await register(second.json().applicationId, reuse.fill.primaryAccount.requestedLoginEmail);
  const secondLogin = await login(secondCredentials.loginEmail, secondCredentials.password); check(secondLogin.statusCode, 200);
  check(secondLogin.json().principal.institutionId !== institutionId, true);
  check((await admin.query("SELECT previous_application_id FROM app.onboarding_applications WHERE application_id=$1", [second.json().applicationId])).rows[0].previous_application_id, applicationId);

  // Withdrawal and rejection release the claim; exhaustion is explicit and manual entry remains.
  await resetWindows();
  const requestors = [];
  for (let n = 0; n < 5; n++) { const s = (await select('REQUESTOR')).json(); const r = await submit(body(s)); check(r.statusCode, 200, r.body); requestors.push({ selection: s, id: r.json().applicationId }); }
  const exhausted = (await select('REQUESTOR')).json(); check(exhausted.status, 'EXHAUSTED'); check(exhausted.sample, null); check(exhausted.eligibleCount, 0);
  const manual = body(requestors[0].selection); manual.sample = null;
  Object.assign(manual.facility, { displayName: 'Synthetic Manual Requestor Hospital', legalName: 'Synthetic Manual Requestor Hospital Inc', officialEmail: 'office@manualreq.bloodledger', facilityLicenseReference: 'SYNTH-HF-LTO-MANUAL' });
  manual.qualification.authorityReference = 'SYNTH-BS-ATO-MANUAL'; manual.primaryAccount.requestedLoginEmail = 'facility@manualreq.bloodledger';
  check((await submit(manual)).statusCode, 200, 'manual application remains possible when the pool is exhausted');
  check((await submit({ ...manual, correlationId: correlationId() })).json().error.code, 'ONB_DUPLICATE_APPLICATION');
  const rejected = requestors[1];
  const pass = password(), wBody = body((await select('BLOOD_BANK')).json(), pass); const w = await submit(wBody); check(w.statusCode, 200);
  const wSession = cookie(await app.inject({ method: 'POST', url: '/api/v2/onboarding/applicant/session', headers: { origin }, payload: { applicationId: w.json().applicationId, password: pass } }));
  check((await app.inject({ method: 'POST', url: '/api/v2/onboarding/applicant/withdraw', headers: { origin, cookie: wSession, 'idempotency-key': key() }, payload: { expectedVersion: 1, correlationId: correlationId(), reasonCode: 'APPLICANT_WITHDRAWAL' } })).statusCode, 200);
  check((await availability('BLOOD_BANK'))[wBody.sample.sampleId], 'ELIGIBLE', 'withdrawal releases the sample');
  check((await decide(rejected.id, 'review', { expectedVersion: 1, verificationReference: 'SYNTHETIC_MANUAL_REVIEW', verificationOutcome: 'CONFIRMED' })).statusCode, 200);
  check((await decide(rejected.id, 'reject', { expectedVersion: 2, reasonCode: 'INCOMPLETE_EVIDENCE' })).statusCode, 200);
  const afterReject = (await select('REQUESTOR')).json(); check(afterReject.status, 'SELECTED'); check(afterReject.sample.sampleId, rejected.selection.sample.sampleId);

  // ADR-039 anchor: approval (not activation) closes the application and starts the 30-day purge.
  const lateSelection = (await select('BLOOD_BANK')).json(), late = await submit(body(lateSelection)); check(late.statusCode, 200, late.body);
  const lateId = late.json().applicationId;
  check((await decide(lateId, 'review', { expectedVersion: 1, verificationReference: 'SYNTHETIC_MANUAL_REVIEW', verificationOutcome: 'CONFIRMED' })).statusCode, 200);
  check((await decide(lateId, 'approve', { expectedVersion: 2, reasonCode: 'REVIEW_COMPLETE' })).statusCode, 200);
  const anchor = (await admin.query('SELECT closed_at,purge_after,purge_after-closed_at=interval \'30 days\' thirty FROM app.onboarding_applications WHERE application_id=$1', [lateId])).rows[0];
  check(anchor.closed_at !== null, true, 'approval sets closed_at'); check(anchor.thirty, true);
  await admin.query("UPDATE app.onboarding_applications SET closed_at=CURRENT_TIMESTAMP-interval '31 days',purge_after=CURRENT_TIMESTAMP-interval '1 day' WHERE application_id=$1", [lateId]);
  await admin.query('SELECT app.purge_closed_synthetic_onboarding(CURRENT_TIMESTAMP)');
  const purgedActivation = await decide(lateId, 'activate', { expectedVersion: 3, reasonCode: 'REVIEW_COMPLETE', loginEmail: lateSelection.fill.primaryAccount.requestedLoginEmail, password: password(), operatorPin: String(randomInt(0, 100000000)).padStart(8, '0') });
  check(purgedActivation.json().error.code, 'ONB_APPLICATION_DETAIL_PURGED');
  check((await availability('BLOOD_BANK'))[lateSelection.sample.sampleId], 'ELIGIBLE', 'an approval that lapsed before activation releases its sample');
  check((await admin.query('SELECT release_reason FROM app.onboarding_sample_claims WHERE application_id=$1', [lateId])).rows[0].release_reason, 'APPROVAL_LAPSED');
  check((await decide(lateId, 'activate', { expectedVersion: 3, reasonCode: 'REVIEW_COMPLETE', loginEmail: 'x', password: 'y', operatorPin: 'z' })).json().error.code, 'ONB_APPLICATION_DETAIL_PURGED');

  // Retention: applicant detail purges 30 days after closure; deregistered profiles 30 days after deregistration.
  await admin.query("UPDATE app.onboarding_applications SET closed_at=CURRENT_TIMESTAMP-interval '31 days',purge_after=CURRENT_TIMESTAMP-interval '1 day' WHERE application_id=$1", [applicationId]);
  await admin.query("UPDATE app.institution_profiles SET deregistered_at=CURRENT_TIMESTAMP-interval '31 days',purge_after=CURRENT_TIMESTAMP-interval '1 day' WHERE institution_id=$1", [institutionId]);
  await admin.query('SELECT app.purge_closed_synthetic_onboarding(CURRENT_TIMESTAMP)');
  check((await admin.query('SELECT profile FROM app.institution_profiles WHERE institution_id=$1', [institutionId])).rows[0].profile, null);
  check((await admin.query("SELECT count(*)::int n FROM app.onboarding_sample_claims WHERE application_id=$1", [applicationId])).rows[0].n, 1, 'minimal linkage remains');
  const retained = (await app.inject({ method: 'GET', url: `/api/v2/onboarding/institutions/${institutionId}`, headers: { cookie: sessions.PRC } })).json();
  check(retained.facilityProfile, null); check(retained.application.applicationId, applicationId);

  // Fixtures, audit hygiene, rate limits and no directory enumeration.
  const fixture = await app.inject({ method: 'GET', url: '/api/v2/onboarding/document-fixtures/SYNTH_DOC_BSF_LTO_V1' });
  check(fixture.headers['content-type'], 'text/plain; charset=utf-8'); check(fixture.body.includes('SIMULATION_ONLY'), true);
  check((await app.inject({ method: 'GET', url: '/api/v2/onboarding/document-fixtures/SYNTH_DOC_UNKNOWN' })).statusCode, 404);
  check((await app.inject({ method: 'GET', url: '/api/v2/onboarding/institutions' })).statusCode, 401);
  const catalogBody = (await app.inject({ method: 'GET', url: '/api/v2/onboarding/sample-facilities' })).body;
  check(/INST_|ONB_[0-9A-F]|USR_|@/.test(catalogBody), false);
  const audits = JSON.stringify((await admin.query("SELECT * FROM app.account_audit WHERE action IN ('SUBMIT_PUBLIC_APPLICATION','ACTIVATE','DEREGISTER')")).rows);
  check(audits.includes(applicantPassword) || audits.includes(credentials.password) || audits.includes(credentials.operatorPin), false);
  check(audits.includes('DEREGISTER'), true);
  await resetWindows();
  const limited = [];
  for (let n = 0; n < 21; n++) limited.push(await submit({ schemaVersion: 'PUBLIC_APPLICATION_V1' }));
  check(limited[19].statusCode, 400); check(limited[20].statusCode, 429); check(limited[20].json().error.code, 'ONB_PUBLIC_RATE_LIMITED'); check(Number(limited[20].headers['retry-after']) > 0, true);
  await resetWindows();
  const after = (await admin.query('SELECT (SELECT count(*) FROM app.institutions)::int institutions')).rows[0];
  check(after.institutions - before.institutions, 2, 'only the two PRC-activated applications created institutions');
  console.log(`Public onboarding probe passed with ${assertions} assertions: PA-ACCOUNT-03 public submission, sample claims, activation, profile linkage, deregistration reuse, concurrency, retention and rate limits. Synthetic catalog; disposable database only.`);
  return assertions;
}
