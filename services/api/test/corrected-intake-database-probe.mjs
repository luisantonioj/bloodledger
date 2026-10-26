// PA-OCR-03 INBOUND_OCR_CORRECTED_V1 probe on the disposable accounts database. Synthetic data only.
// A corrected capture keeps no confidence for corrected fields, its per-field provenance is insert-only, and the
// database refuses provenance that claims an OCR read below 90 or a V1 capture without confidences.
import assert from 'node:assert/strict';
import { PostgresV2ProjectionReader } from '../build/src/database-v2.js';

export async function probeCorrectedIntake({ admin, runtime }) {
  let assertions = 0;
  const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const rejects = async (promise, pattern, message) => { await assert.rejects(promise, pattern, message); assertions++; };
  const digest = (char) => char.repeat(64);
  const now = new Date().toISOString();
  const base = { issuerInstitutionId: 'INST_MEDIATRIX', custodyInstitutionId: 'INST_MEDIATRIX', donationNoLookupHmac: digest('a'), componentType: 'PLATELETS', bloodType: 'A_POSITIVE',
    bloodTypeEvidenceSource: 'OPERATOR_CONFIRMED', componentEvidenceSource: 'OCR_LABEL', ocrEngine: 'synthetic-ocr', ocrEngineVersion: '1', collectedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-22T00:00:00.000Z',
    capturedAt: now, confirmedAt: now, eventTime: now, correlationId: 'CORR_' + 'E'.repeat(32) };
  const provenance = [
    { field: 'donationNumber', source: 'OCR_LABEL', ocrValueDigest: digest('1'), ocrConfidence: 96, correctionReason: null, finalValueDigest: digest('1') },
    { field: 'bloodType', source: 'OPERATOR_CORRECTED', ocrValueDigest: digest('2'), ocrConfidence: 93, correctionReason: 'OCR_MISREAD', finalValueDigest: digest('3') },
    { field: 'componentType', source: 'OCR_LABEL', ocrValueDigest: digest('4'), ocrConfidence: 97, correctionReason: null, finalValueDigest: digest('4') },
    { field: 'collectedAt', source: 'OCR_LABEL', ocrValueDigest: digest('5'), ocrConfidence: 95, correctionReason: null, finalValueDigest: digest('5') },
    { field: 'expiresAt', source: 'OPERATOR_CORRECTED', ocrValueDigest: null, ocrConfidence: null, correctionReason: 'OCR_NOT_READ', finalValueDigest: digest('6') },
  ];
  const reader = new PostgresV2ProjectionReader(runtime);
  await reader.recordInboundCapture('INCAP_CORRECTED_PROBE', { ...base, capturePolicyVersion: 'INBOUND_OCR_CORRECTED_V1', donationNumberConfidence: 96, bloodTypeConfidence: null, fieldProvenance: provenance }, now);
  const row = (await admin.query("SELECT capture_policy_version, donation_number_confidence, blood_type_confidence, blood_type_evidence_source FROM app.v2_inbound_captures WHERE capture_id='INCAP_CORRECTED_PROBE'")).rows[0];
  check(row, { capture_policy_version: 'INBOUND_OCR_CORRECTED_V1', donation_number_confidence: 96, blood_type_confidence: null, blood_type_evidence_source: 'OPERATOR_CONFIRMED' }, 'a corrected field keeps no confidence');
  const fields = (await admin.query("SELECT field_name, source, correction_reason, ocr_confidence FROM app.v2_capture_field_provenance WHERE capture_id='INCAP_CORRECTED_PROBE' ORDER BY field_name")).rows;
  check(fields.length, 5);
  check(fields.find((entry) => entry.field_name === 'bloodType'), { field_name: 'bloodType', source: 'OPERATOR_CORRECTED', correction_reason: 'OCR_MISREAD', ocr_confidence: 93 }, 'the original OCR score is kept separately');
  // A repeated record writes nothing new.
  await reader.recordInboundCapture('INCAP_CORRECTED_PROBE', { ...base, capturePolicyVersion: 'INBOUND_OCR_CORRECTED_V1', donationNumberConfidence: 96, bloodTypeConfidence: null, fieldProvenance: provenance }, now);
  check(Number((await admin.query("SELECT count(*) FROM app.v2_capture_field_provenance WHERE capture_id='INCAP_CORRECTED_PROBE'")).rows[0].count), 5);

  // Provenance is immutable, even for the owner.
  await rejects(admin.query("UPDATE app.v2_capture_field_provenance SET ocr_confidence=99 WHERE capture_id='INCAP_CORRECTED_PROBE'"), /V2_CAPTURE_PROVENANCE_IMMUTABLE/);
  await rejects(admin.query("DELETE FROM app.v2_capture_field_provenance WHERE capture_id='INCAP_CORRECTED_PROBE'"), /V2_CAPTURE_PROVENANCE_IMMUTABLE/);
  const grants = (await admin.query("SELECT has_table_privilege('bloodledger_app','app.v2_capture_field_provenance','SELECT,INSERT') AS read_insert, has_table_privilege('bloodledger_app','app.v2_capture_field_provenance','UPDATE') AS update, has_table_privilege('bloodledger_app','app.v2_capture_field_provenance','DELETE') AS delete")).rows[0];
  check(grants, { read_insert: true, update: false, delete: false });

  // The database refuses an OCR-sourced field below 90, a correction without a reason, and a V1 capture without confidences.
  await runtime.query("INSERT INTO app.v2_inbound_captures(capture_id,issuer_institution_id,custody_institution_id,donation_number_lookup_hmac,component_type,blood_type,capture_method,capture_policy_version,blood_type_evidence_source,component_evidence_source,ocr_engine,ocr_engine_version,donation_number_confidence,blood_type_confidence,collected_at,expires_at,captured_at,confirmed_at,event_time,status,resolution,correlation_id,classification,created_at,updated_at) VALUES('INCAP_CORRECTED_PROBE2','INST_MEDIATRIX','INST_MEDIATRIX',$1,'PLATELETS','A_POSITIVE','OCR','INBOUND_OCR_CORRECTED_V1','OCR_LABEL','OCR_LABEL','synthetic-ocr','1',NULL,NULL,$2,$3,$4,$4,$4,'QUEUED','REGISTERED',$5,'SIMULATION_ONLY',$4,$4)", [digest('b'), base.collectedAt, base.expiresAt, now, base.correlationId]);
  const insert = (values) => runtime.query("INSERT INTO app.v2_capture_field_provenance(capture_id,field_name,source,ocr_value_digest,ocr_confidence,correction_reason,final_value_digest,recorded_at,classification) VALUES('INCAP_CORRECTED_PROBE2',$1,$2,$3,$4,$5,$6,now(),'SIMULATION_ONLY')", values);
  await rejects(insert(['bloodType', 'OCR_LABEL', digest('7'), 80, null, digest('7')]), /v2_capture_field_rule/, 'an OCR-sourced field needs >= 90');
  await rejects(insert(['bloodType', 'OCR_LABEL', digest('7'), 95, null, digest('8')]), /v2_capture_field_rule/, 'an OCR-sourced field equals its read');
  await rejects(insert(['bloodType', 'OPERATOR_CORRECTED', digest('7'), 95, null, digest('8')]), /v2_capture_field_rule/, 'a correction needs a reason');
  await rejects(insert(['componentType', 'OCR_LABEL', digest('7'), null, null, digest('7')]), /v2_capture_field_rule/, 'an OCR-sourced field needs its score');
  await rejects(insert(['collectedAt', 'OCR_LABEL', null, 95, null, digest('9')]), /v2_capture_field_rule/, 'an OCR-sourced field needs its read digest');
  await rejects(runtime.query("INSERT INTO app.v2_inbound_captures(capture_id,issuer_institution_id,custody_institution_id,donation_number_lookup_hmac,component_type,blood_type,capture_method,capture_policy_version,blood_type_evidence_source,component_evidence_source,ocr_engine,ocr_engine_version,donation_number_confidence,blood_type_confidence,collected_at,expires_at,captured_at,confirmed_at,event_time,status,resolution,correlation_id,classification,created_at,updated_at) VALUES('INCAP_CORRECTED_PROBE3','INST_MEDIATRIX','INST_MEDIATRIX',$1,'PLATELETS','A_POSITIVE','OCR','INBOUND_OCR_V1','OCR_LABEL','OCR_LABEL','synthetic-ocr','1',NULL,95,$2,$3,$4,$4,$4,'QUEUED','REGISTERED',$5,'SIMULATION_ONLY',$4,$4)", [digest('c'), base.collectedAt, base.expiresAt, now, base.correlationId]), /v2_inbound_capture_confidence/, 'V1 still requires both confidences');
  return assertions;
}
