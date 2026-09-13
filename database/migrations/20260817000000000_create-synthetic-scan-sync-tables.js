exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.scan_events (
      event_id varchar(37) PRIMARY KEY,
      idempotency_key varchar(64) NOT NULL UNIQUE,
      payload_sha256 char(64) NOT NULL,
      correlation_id varchar(42) NOT NULL UNIQUE,
      institution_id varchar(64) NOT NULL,
      actor_user_id varchar(52) NOT NULL,
      unit_id varchar(61) NOT NULL,
      blood_type varchar(32) NOT NULL,
      component varchar(32) NOT NULL,
      collected_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      capture_method varchar(32) NOT NULL,
      capture_policy_version varchar(64) NOT NULL,
      ocr_engine varchar(32),
      ocr_engine_version varchar(16),
      unit_id_confidence smallint,
      blood_type_confidence smallint,
      component_confidence smallint,
      collected_at_confidence smallint,
      expires_at_confidence smallint,
      captured_at timestamptz NOT NULL,
      confirmed_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      status varchar(48) NOT NULL,
      attempt_count integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL,
      lease_owner varchar(64),
      lease_expires_at timestamptz,
      ledger_transaction_id varchar(128),
      ledger_committed_at timestamptz,
      safe_error_code varchar(64),
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT scan_events_id_format CHECK (event_id ~ '^SCAN_[0-9A-F]{32}$'),
      CONSTRAINT scan_events_idempotency_format CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT scan_events_hash_format CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT scan_events_correlation_format CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT scan_events_institution CHECK (institution_id = 'INST_MEDIATRIX'),
      CONSTRAINT scan_events_actor CHECK (actor_user_id ~ '^USR_[A-Z0-9_-]{1,48}$'),
      CONSTRAINT scan_events_unit CHECK (unit_id ~ '^UNIT_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT scan_events_blood_type CHECK (blood_type IN ('A_POSITIVE', 'O_POSITIVE')),
      CONSTRAINT scan_events_component CHECK (component IN ('RED_BLOOD_CELLS', 'PLATELETS')),
      CONSTRAINT scan_events_capture_method CHECK (capture_method IN (
        'OCR', 'CODE_128_FALLBACK', 'DATA_MATRIX_FALLBACK', 'SYNTHETIC_QR_FALLBACK'
      )),
      CONSTRAINT scan_events_capture_policy CHECK (capture_policy_version = 'SYNTHETIC_CAPTURE_V1'),
      CONSTRAINT scan_events_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT scan_events_eligibility CHECK (
        recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY'
      ),
      CONSTRAINT scan_events_status CHECK (status IN (
        'QUEUED', 'SUBMITTING', 'RETRY_WAIT',
        'LEDGER_COMMITTED_PROJECTION_PENDING', 'COMMITTED', 'FAILED', 'CONFLICT'
      )),
      CONSTRAINT scan_events_attempts CHECK (attempt_count >= 0),
      CONSTRAINT scan_events_version CHECK (version >= 1),
      CONSTRAINT scan_events_times CHECK (
        collected_at < expires_at
        AND captured_at >= collected_at
        AND confirmed_at >= captured_at
        AND received_at >= captured_at
      ),
      CONSTRAINT scan_events_ocr_evidence CHECK (
        (
          capture_method = 'OCR'
          AND ocr_engine = 'TESSERACT_JS'
          AND ocr_engine_version = '7.0.0'
          AND unit_id_confidence BETWEEN 90 AND 100
          AND blood_type_confidence BETWEEN 90 AND 100
          AND component_confidence BETWEEN 90 AND 100
          AND collected_at_confidence BETWEEN 90 AND 100
          AND expires_at_confidence BETWEEN 90 AND 100
        ) OR (
          capture_method <> 'OCR'
          AND ocr_engine IS NULL
          AND ocr_engine_version IS NULL
          AND unit_id_confidence IS NULL
          AND blood_type_confidence IS NULL
          AND component_confidence IS NULL
          AND collected_at_confidence IS NULL
          AND expires_at_confidence IS NULL
        )
      ),
      CONSTRAINT scan_events_lease CHECK (
        (status = 'SUBMITTING' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
        OR (status <> 'SUBMITTING' AND lease_owner IS NULL AND lease_expires_at IS NULL)
      ),
      CONSTRAINT scan_events_ledger CHECK (
        (status IN ('LEDGER_COMMITTED_PROJECTION_PENDING', 'COMMITTED')
          AND ledger_transaction_id IS NOT NULL AND ledger_committed_at IS NOT NULL)
        OR (status NOT IN ('LEDGER_COMMITTED_PROJECTION_PENDING', 'COMMITTED'))
      )
    );

    CREATE INDEX scan_events_claim_idx
      ON app.scan_events (institution_id, next_attempt_at, captured_at, event_id)
      WHERE status IN ('QUEUED', 'RETRY_WAIT');

    CREATE TABLE app.scan_event_attempts (
      event_id varchar(37) NOT NULL REFERENCES app.scan_events(event_id),
      attempt_number integer NOT NULL,
      outcome varchar(32) NOT NULL,
      safe_error_code varchar(64),
      started_at timestamptz NOT NULL,
      finished_at timestamptz NOT NULL,
      ledger_transaction_id varchar(128),
      PRIMARY KEY (event_id, attempt_number, outcome),
      CONSTRAINT scan_event_attempts_number CHECK (attempt_number >= 1),
      CONSTRAINT scan_event_attempts_outcome CHECK (outcome IN (
        'RETRY_SCHEDULED', 'LEDGER_COMMITTED', 'PROJECTION_COMMITTED',
        'PROJECTION_RETRY', 'FAILED', 'CONFLICT'
      )),
      CONSTRAINT scan_event_attempts_time CHECK (finished_at >= started_at)
    );

    CREATE TABLE app.inventory_projection (
      unit_id varchar(61) PRIMARY KEY,
      institution_id varchar(64) NOT NULL,
      blood_type varchar(32) NOT NULL,
      component varchar(32) NOT NULL,
      collected_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      inventory_status varchar(24) NOT NULL,
      policy_version varchar(64) NOT NULL,
      ledger_version integer NOT NULL,
      ledger_transaction_id varchar(128) NOT NULL UNIQUE,
      correlation_id varchar(42) NOT NULL,
      source_event_id varchar(37) NOT NULL UNIQUE REFERENCES app.scan_events(event_id),
      projected_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT inventory_projection_unit CHECK (unit_id ~ '^UNIT_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT inventory_projection_institution CHECK (institution_id = 'INST_MEDIATRIX'),
      CONSTRAINT inventory_projection_blood_type CHECK (blood_type IN ('A_POSITIVE', 'O_POSITIVE')),
      CONSTRAINT inventory_projection_component CHECK (component IN ('RED_BLOOD_CELLS', 'PLATELETS')),
      CONSTRAINT inventory_projection_status CHECK (inventory_status IN (
        'AVAILABLE', 'RESERVED', 'DISPATCHED', 'IN_TRANSIT',
        'RECEIVED', 'COMPROMISED', 'EXPIRED'
      )),
      CONSTRAINT inventory_projection_policy CHECK (policy_version = 'SYNTHETIC_INVENTORY_V1'),
      CONSTRAINT inventory_projection_version CHECK (ledger_version >= 1),
      CONSTRAINT inventory_projection_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    REVOKE ALL ON app.scan_events FROM PUBLIC;
    REVOKE ALL ON app.scan_event_attempts FROM PUBLIC;
    REVOKE ALL ON app.inventory_projection FROM PUBLIC;
    GRANT SELECT, INSERT ON app.scan_events TO bloodledger_app;
    GRANT UPDATE (
      status, attempt_count, next_attempt_at, lease_owner, lease_expires_at,
      ledger_transaction_id, ledger_committed_at, safe_error_code, version, updated_at
    ) ON app.scan_events TO bloodledger_app;
    GRANT SELECT, INSERT ON app.scan_event_attempts TO bloodledger_app;
    GRANT SELECT, INSERT ON app.inventory_projection TO bloodledger_app;
    GRANT UPDATE (
      institution_id, blood_type, component, collected_at, expires_at,
      inventory_status, policy_version, ledger_version, ledger_transaction_id,
      correlation_id, source_event_id, projected_at, classification
    ) ON app.inventory_projection TO bloodledger_app;
  `);
};

exports.down = false;
