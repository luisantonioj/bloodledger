// TC-T04/TC-G01/TC-G03/TC-T07/TC-E05 remediation (Proposed; SIMULATION_ONLY).
// Adds the staff-recorded DELAYED reservation state, the on-chain location summaries projected beside the reservation,
// and an access-controlled off-chain table for exact checkpoint points (SYNTHETIC_LOCATION_V2, purged after 30 days).
// It also registers USR_SERVICE_EXPIRY (PA-TC-03, Proposed) as a non-login INTERNAL actor that the scheduled expiry
// evaluator attributes its commands to: SUSPENDED status and an all-zero verifier mean it can never sign in. A database
// bootstrapped without INST_MEDIATRIX gets no actor, and the evaluator then stays idle.
// Existing rows and constraints otherwise stay unchanged.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_reservations
    DROP CONSTRAINT v2_reservations_status,
    ADD CONSTRAINT v2_reservations_status CHECK (status IN ('ACTIVE','COMPLETED','RESERVED','PREPARED','DISPATCHED','IN_TRANSIT','DELAYED','RECEIVED','RELEASED','CANCELLED','COMPROMISED')),
    ADD COLUMN delayed_from_status text,
    ADD COLUMN delay_reason_code text,
    ADD COLUMN delayed_at timestamptz,
    ADD COLUMN dispatch_location_summary jsonb,
    ADD COLUMN receipt_location_summary jsonb,
    ADD CONSTRAINT v2_reservations_delay CHECK ((status = 'DELAYED') = (delayed_from_status IS NOT NULL)),
    ADD CONSTRAINT v2_reservations_delay_from CHECK (delayed_from_status IS NULL OR delayed_from_status IN ('DISPATCHED','IN_TRANSIT'));

  CREATE TABLE app.v2_location_evidence (
    evidence_id text PRIMARY KEY CHECK (evidence_id ~ '^LOC_[A-Z0-9_-]{1,56}$'),
    reservation_id text NOT NULL REFERENCES app.v2_reservations(reservation_id),
    phase text NOT NULL CHECK (phase IN ('DISPATCH','RECEIPT')),
    institution_id text NOT NULL REFERENCES app.institutions(institution_id),
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_metres double precision NOT NULL CHECK (accuracy_metres > 0),
    source text NOT NULL CHECK (source IN ('DEVICE','FACILITY_FALLBACK')),
    fallback_reason text,
    facility_matched boolean NOT NULL,
    captured_at timestamptz NOT NULL,
    evidence_digest text NOT NULL CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
    policy_version text NOT NULL CHECK (policy_version = 'SYNTHETIC_LOCATION_V2'),
    delete_after timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    classification text NOT NULL DEFAULT 'SYNTHETIC_DATA' CHECK (classification = 'SYNTHETIC_DATA')
  );
  CREATE INDEX v2_location_evidence_reservation ON app.v2_location_evidence(reservation_id);
  CREATE INDEX v2_location_evidence_delete_after ON app.v2_location_evidence(delete_after);
  GRANT SELECT, INSERT, DELETE ON app.v2_location_evidence TO bloodledger_app;

  INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind)
  SELECT 'USR_SERVICE_EXPIRY','synth_service_expiry','Synthetic scheduled expiry evaluator',institution_id,'SCRYPT_V1',repeat('0',32),repeat('0',128),'SUSPENDED','INTERNAL'
  FROM app.institutions WHERE institution_id='INST_MEDIATRIX'
  ON CONFLICT(user_id) DO NOTHING;
`);
exports.down = () => { throw new Error('Retain recorded reservation delay and location evidence'); };
