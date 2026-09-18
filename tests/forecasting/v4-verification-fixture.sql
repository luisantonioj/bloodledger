-- Synthetic-only verification fixture. It contains no institutional, patient,
-- donor, OCR, or Donation No. values.
INSERT INTO app.institutions(institution_id, display_name, category, status, classification)
VALUES ('INST_MEDIATRIX', 'Synthetic Mediatrix Verification', 'HOSPITAL', 'ACTIVE', 'SIMULATION_ONLY')
ON CONFLICT (institution_id) DO NOTHING;

INSERT INTO app.institutions(institution_id, display_name, category, status, classification)
VALUES ('INST_METRO_LIPA', 'Synthetic Destination Verification', 'HOSPITAL', 'ACTIVE', 'SIMULATION_ONLY')
ON CONFLICT (institution_id) DO NOTHING;

INSERT INTO app.application_users(user_id, username, display_name, institution_id, password_algorithm, password_salt, password_verifier, status, classification)
VALUES ('USR_SYNTH_VERIFY', 'synth_verify_operator', 'Synthetic Verification Operator', 'INST_MEDIATRIX', 'SCRYPT_V1', repeat('0', 32), repeat('0', 128), 'ACTIVE', 'SIMULATION_ONLY')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO app.user_role_assignments(user_id, role_id, policy_version)
VALUES ('USR_SYNTH_VERIFY', 'ROLE-01', 'SYNTHETIC_WEB_ACCESS_V1')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO app.v2_donations(
  donation_id, issuer_institution_id, donation_number_ciphertext, donation_number_nonce,
  donation_number_auth_tag, donation_number_key_version, donation_number_lookup_hmac,
  created_by_user_id, created_at, updated_at, classification
)
SELECT 'DON_VERIFY_' || lpad(value::text, 3, '0'), 'INST_MEDIATRIX', 'synthetic-ciphertext', '0123456789abcdef',
  'fedcba9876543210', 'SYNTHETIC_V1', lpad(value::text, 64, '0'), 'USR_SYNTH_VERIFY',
  '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'SIMULATION_ONLY'
FROM generate_series(1, 30) AS series(value)
ON CONFLICT (donation_id) DO NOTHING;

INSERT INTO app.v2_components(
  component_id, donation_id, issuer_institution_id, donation_number_lookup_hmac,
  component_type, blood_type, collected_at, expires_at, institution_id, inventory_status,
  ledger_version, ledger_transaction_id, correlation_id, policy_version, created_at,
  updated_at, classification
)
SELECT 'COMP_VERIFY_' || lpad(value::text, 3, '0'), 'DON_VERIFY_' || lpad(value::text, 3, '0'),
  'INST_MEDIATRIX', lpad(value::text, 64, '0'), 'CRYOPRECIPITATE', 'A_POSITIVE',
  '2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z', 'INST_MEDIATRIX', 'AVAILABLE',
  1, 'TX_VERIFY_' || lpad(value::text, 3, '0'), 'CORR_' || lpad(value::text, 32, '0'),
  'INTERVIEW_DERIVED_CORE_V2_1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'SIMULATION_ONLY'
FROM generate_series(1, 30) AS series(value)
ON CONFLICT (component_id) DO NOTHING;
