exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.v2_donations (
      donation_id varchar(64) PRIMARY KEY,
      issuer_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      donation_number_ciphertext text NOT NULL,
      donation_number_nonce varchar(64) NOT NULL,
      donation_number_auth_tag varchar(64) NOT NULL,
      donation_number_key_version varchar(32) NOT NULL,
      donation_number_lookup_hmac char(64) NOT NULL,
      created_by_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      version integer NOT NULL DEFAULT 1,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_donations_id CHECK (donation_id ~ '^DON_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_donations_ciphertext CHECK (length(donation_number_ciphertext) BETWEEN 1 AND 4096),
      CONSTRAINT v2_donations_nonce CHECK (length(donation_number_nonce) BETWEEN 16 AND 128),
      CONSTRAINT v2_donations_tag CHECK (length(donation_number_auth_tag) BETWEEN 16 AND 128),
      CONSTRAINT v2_donations_key CHECK (donation_number_key_version ~ '^[A-Za-z0-9_-]{1,31}$'),
      CONSTRAINT v2_donations_hmac CHECK (donation_number_lookup_hmac ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_donations_version CHECK (version >= 1),
      CONSTRAINT v2_donations_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE UNIQUE INDEX v2_donations_issuer_lookup_idx
      ON app.v2_donations (issuer_institution_id, donation_number_lookup_hmac);

    CREATE TABLE app.v2_components (
      component_id varchar(64) PRIMARY KEY,
      donation_id varchar(64) NOT NULL REFERENCES app.v2_donations(donation_id),
      issuer_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      donation_number_lookup_hmac char(64) NOT NULL,
      component_type varchar(32) NOT NULL,
      blood_type varchar(32) NOT NULL,
      collected_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      inventory_status varchar(32) NOT NULL,
      reservation_purpose varchar(24),
      reservation_id varchar(64),
      release_prepared_at timestamptz,
      release_prepared_by varchar(52) REFERENCES app.application_users(user_id),
      ledger_version integer NOT NULL DEFAULT 0,
      ledger_transaction_id varchar(128),
      correlation_id varchar(42) NOT NULL,
      policy_version varchar(64) NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_components_id CHECK (component_id ~ '^COMP_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_components_hmac CHECK (donation_number_lookup_hmac ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_components_type CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS')),
      CONSTRAINT v2_components_blood_type CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT v2_components_time CHECK (collected_at < expires_at AND updated_at >= created_at),
      CONSTRAINT v2_components_status CHECK (inventory_status IN ('AVAILABLE','RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','RELEASED','COMPROMISED','EXPIRED','RECONCILIATION_HOLD')),
      CONSTRAINT v2_components_reservation CHECK ((inventory_status IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED') AND reservation_purpose IS NOT NULL AND reservation_id IS NOT NULL) OR (inventory_status NOT IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED') AND reservation_purpose IS NULL AND reservation_id IS NULL)),
      CONSTRAINT v2_components_preparation CHECK (release_prepared_at IS NULL OR (release_prepared_by IS NOT NULL AND inventory_status IN ('RESERVED','DISPATCHED','IN_TRANSIT'))),
      CONSTRAINT v2_components_ledger_version CHECK (ledger_version >= 0),
      CONSTRAINT v2_components_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_components_policy CHECK (policy_version = 'INTERVIEW_DERIVED_CORE_V2'),
      CONSTRAINT v2_components_classification CHECK (classification = 'SIMULATION_ONLY'),
      UNIQUE (issuer_institution_id, donation_number_lookup_hmac, component_type)
    );
    CREATE INDEX v2_components_fefo_idx
      ON app.v2_components (institution_id, blood_type, component_type, expires_at, component_id)
      WHERE inventory_status = 'AVAILABLE';

    CREATE OR REPLACE FUNCTION app.v2_enforce_donation_component_shape()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM app.v2_components existing
        WHERE existing.donation_id = NEW.donation_id
          AND existing.component_id <> NEW.component_id
          AND ((existing.component_type = 'WHOLE_BLOOD') <> (NEW.component_type = 'WHOLE_BLOOD'))
      ) THEN
        RAISE EXCEPTION 'V2_DONATION_COMPONENT_SHAPE_CONFLICT';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER v2_components_shape_trigger
      BEFORE INSERT OR UPDATE OF donation_id,component_type ON app.v2_components
      FOR EACH ROW EXECUTE FUNCTION app.v2_enforce_donation_component_shape();

    CREATE TABLE app.v2_commands (
      command_id varchar(64) PRIMARY KEY,
      idempotency_key varchar(64) NOT NULL UNIQUE,
      payload_sha256 char(64) NOT NULL,
      resource_type varchar(24) NOT NULL,
      resource_id varchar(64) NOT NULL,
      operation varchar(64) NOT NULL,
      payload jsonb NOT NULL,
      status varchar(48) NOT NULL,
      attempt_count integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL,
      lease_owner varchar(64),
      lease_expires_at timestamptz,
      ledger_transaction_id varchar(128),
      ledger_committed_at timestamptz,
      safe_error_code varchar(64),
      correlation_id varchar(42) NOT NULL,
      actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      actor_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      accepted_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      version integer NOT NULL DEFAULT 1,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_commands_id CHECK (command_id ~ '^CMD_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_commands_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT v2_commands_hash CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_commands_resource CHECK (resource_type IN ('COMPONENT','TRANSFER','LOCAL_RELEASE','RECONCILIATION')),
      CONSTRAINT v2_commands_status CHECK (status IN ('QUEUED','SUBMITTING','LEDGER_COMMITTED_PROJECTION_PENDING','COMMITTED','RETRY_WAIT','FAILED','CONFLICT')),
      CONSTRAINT v2_commands_attempts CHECK (attempt_count >= 0),
      CONSTRAINT v2_commands_lease CHECK ((status = 'SUBMITTING' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'SUBMITTING' AND lease_owner IS NULL AND lease_expires_at IS NULL)),
      CONSTRAINT v2_commands_hash2 CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_commands_version CHECK (version >= 1),
      CONSTRAINT v2_commands_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE INDEX v2_commands_claim_idx ON app.v2_commands (next_attempt_at, accepted_at, command_id)
      WHERE status IN ('QUEUED','RETRY_WAIT');

    CREATE TABLE app.v2_command_attempts (
      command_id varchar(64) NOT NULL REFERENCES app.v2_commands(command_id),
      attempt_number integer NOT NULL,
      outcome varchar(32) NOT NULL,
      safe_error_code varchar(64),
      started_at timestamptz NOT NULL,
      finished_at timestamptz NOT NULL,
      ledger_transaction_id varchar(128),
      PRIMARY KEY (command_id, attempt_number, outcome),
      CONSTRAINT v2_command_attempt_number CHECK (attempt_number >= 1),
      CONSTRAINT v2_command_attempt_outcome CHECK (outcome IN ('RETRY_SCHEDULED','LEDGER_COMMITTED','PROJECTION_COMMITTED','PROJECTION_RETRY','FAILED','CONFLICT')),
      CONSTRAINT v2_command_attempt_time CHECK (finished_at >= started_at)
    );

    CREATE TABLE app.v2_reservations (
      reservation_id varchar(64) PRIMARY KEY,
      purpose varchar(24) NOT NULL,
      transfer_id varchar(60),
      local_release_id varchar(64),
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      status varchar(24) NOT NULL,
      prepared_at timestamptz,
      prepared_by varchar(52) REFERENCES app.application_users(user_id),
      completed_at timestamptz,
      completed_by varchar(52) REFERENCES app.application_users(user_id),
      reason_code varchar(64),
      correlation_id varchar(42) NOT NULL,
      version integer NOT NULL DEFAULT 1,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_reservations_id CHECK (reservation_id ~ '^RES_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_reservations_purpose CHECK (purpose IN ('TRANSFER','LOCAL_RELEASE')),
      CONSTRAINT v2_reservations_status CHECK (status IN ('RESERVED','PREPARED','DISPATCHED','IN_TRANSIT','RECEIVED','RELEASED','CANCELLED','COMPROMISED')),
      CONSTRAINT v2_reservations_target CHECK ((purpose = 'TRANSFER' AND transfer_id IS NOT NULL AND local_release_id IS NULL) OR (purpose = 'LOCAL_RELEASE' AND local_release_id IS NOT NULL AND transfer_id IS NULL)),
      CONSTRAINT v2_reservations_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_reservations_version CHECK (version >= 1),
      CONSTRAINT v2_reservations_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE UNIQUE INDEX v2_reservations_transfer_idx ON app.v2_reservations (transfer_id) WHERE transfer_id IS NOT NULL;
    CREATE UNIQUE INDEX v2_reservations_local_release_idx ON app.v2_reservations (local_release_id) WHERE local_release_id IS NOT NULL;

    CREATE TABLE app.v2_release_preparations (
      preparation_id varchar(64) PRIMARY KEY,
      reservation_id varchar(64) NOT NULL REFERENCES app.v2_reservations(reservation_id),
      actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      actor_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      prepared_at timestamptz NOT NULL,
      component_count integer NOT NULL,
      reason_code varchar(64) NOT NULL,
      correlation_id varchar(42) NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_preparations_id CHECK (preparation_id ~ '^PREP_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_preparations_count CHECK (component_count >= 1),
      CONSTRAINT v2_preparations_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_preparations_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.v2_reconciliation_cases (
      case_id varchar(64) PRIMARY KEY,
      component_id varchar(64) NOT NULL REFERENCES app.v2_components(component_id),
      observed_status varchar(32) NOT NULL,
      previous_status varchar(32) NOT NULL,
      status varchar(24) NOT NULL,
      opened_by varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      opened_at timestamptz NOT NULL,
      resolved_by varchar(52) REFERENCES app.application_users(user_id),
      resolved_at timestamptz,
      resolution_code varchar(64),
      expected_component_version integer NOT NULL,
      correlation_id varchar(42) NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_reconciliation_id CHECK (case_id ~ '^RECON_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_reconciliation_status CHECK (status IN ('OPEN','RESOLVED','ESCALATED')),
      CONSTRAINT v2_reconciliation_observed CHECK (observed_status IN ('MISSING','FOUND','STATUS_MISMATCH')),
      CONSTRAINT v2_reconciliation_previous CHECK (previous_status IN ('AVAILABLE','RESERVED')),
      CONSTRAINT v2_reconciliation_version CHECK (expected_component_version >= 1),
      CONSTRAINT v2_reconciliation_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_reconciliation_resolution CHECK ((status = 'OPEN' AND resolved_at IS NULL AND resolved_by IS NULL) OR (status <> 'OPEN' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)),
      CONSTRAINT v2_reconciliation_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.v2_census_snapshots (
      snapshot_id varchar(64) PRIMARY KEY,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      scheduled_for timestamptz NOT NULL,
      captured_at timestamptz NOT NULL,
      timezone varchar(64) NOT NULL,
      report_policy_version varchar(64) NOT NULL,
      trigger_type varchar(16) NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_census_id CHECK (snapshot_id ~ '^CENSUS_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_census_timezone CHECK (timezone = 'Asia/Manila'),
      CONSTRAINT v2_census_trigger CHECK (trigger_type IN ('SCHEDULED','MANUAL')),
      CONSTRAINT v2_census_policy CHECK (report_policy_version ~ '^INTERVIEW_[A-Z0-9_-]{1,54}$'),
      CONSTRAINT v2_census_classification CHECK (classification = 'SIMULATION_ONLY'),
      UNIQUE (institution_id, scheduled_for, report_policy_version)
    );

    CREATE TABLE app.v2_census_counts (
      snapshot_id varchar(64) NOT NULL REFERENCES app.v2_census_snapshots(snapshot_id),
      component_type varchar(32) NOT NULL,
      blood_type varchar(32) NOT NULL,
      available_count integer NOT NULL,
      reserved_count integer NOT NULL,
      reportable_count integer GENERATED ALWAYS AS (available_count + reserved_count) STORED,
      PRIMARY KEY (snapshot_id, component_type, blood_type),
      CONSTRAINT v2_census_count_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS')),
      CONSTRAINT v2_census_count_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT v2_census_count_nonnegative CHECK (available_count >= 0 AND reserved_count >= 0)
    );

    CREATE TABLE app.v2_algorithm_runs (
      run_id varchar(64) PRIMARY KEY,
      algorithm_name varchar(16) NOT NULL,
      algorithm_version varchar(64) NOT NULL,
      source_surplus_evidence_id varchar(64),
      input_sha256 char(64) NOT NULL,
      config_sha256 char(64) NOT NULL,
      recommendation_digest char(64),
      evaluation_time timestamptz NOT NULL,
      evidence jsonb NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      CONSTRAINT v2_algorithm_id CHECK (run_id ~ '^ARUN_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_algorithm_name CHECK (algorithm_name IN ('RPS','BROA')),
      CONSTRAINT v2_algorithm_hash CHECK (input_sha256 ~ '^[0-9a-f]{64}$' AND config_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_algorithm_digest CHECK (recommendation_digest IS NULL OR recommendation_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_algorithm_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT v2_algorithm_eligibility CHECK (recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY')
    );

    CREATE TABLE app.v2_source_surplus_evidence (
      evidence_id varchar(64) PRIMARY KEY,
      source_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      blood_type varchar(32) NOT NULL,
      component_type varchar(32) NOT NULL,
      surplus_quantity integer NOT NULL,
      as_of timestamptz NOT NULL,
      horizon_date date NOT NULL,
      forecast_status varchar(16) NOT NULL,
      model_version varchar(64) NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      CONSTRAINT v2_surplus_id CHECK (evidence_id ~ '^SURP_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_surplus_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT v2_surplus_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS')),
      CONSTRAINT v2_surplus_quantity CHECK (surplus_quantity >= 0),
      CONSTRAINT v2_surplus_status CHECK (forecast_status IN ('AVAILABLE','STALE','UNAVAILABLE')),
      CONSTRAINT v2_surplus_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT v2_surplus_eligibility CHECK (recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY')
    );

    REVOKE ALL ON app.v2_donations,app.v2_components,app.v2_commands,app.v2_command_attempts,app.v2_reservations,app.v2_release_preparations,app.v2_reconciliation_cases,app.v2_census_snapshots,app.v2_census_counts,app.v2_algorithm_runs,app.v2_source_surplus_evidence FROM PUBLIC;
    GRANT SELECT,INSERT ON app.v2_donations,app.v2_components,app.v2_commands,app.v2_command_attempts,app.v2_reservations,app.v2_release_preparations,app.v2_reconciliation_cases,app.v2_census_snapshots,app.v2_census_counts,app.v2_algorithm_runs,app.v2_source_surplus_evidence TO bloodledger_app;
    GRANT UPDATE ON app.v2_donations,app.v2_components,app.v2_commands,app.v2_reservations,app.v2_reconciliation_cases TO bloodledger_app;
  `);
};

exports.down = false;
