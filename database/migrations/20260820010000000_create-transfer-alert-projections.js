exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.transfer_requests (
      transfer_id varchar(60) PRIMARY KEY,
      idempotency_key varchar(64) NOT NULL UNIQUE,
      payload_sha256 char(64) NOT NULL,
      source_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      destination_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      blood_type varchar(32) NOT NULL,
      component varchar(32) NOT NULL,
      quantity integer NOT NULL,
      urgency varchar(16) NOT NULL,
      request_time timestamptz NOT NULL,
      status varchar(24) NOT NULL,
      reason_code varchar(64),
      actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      policy_version varchar(64) NOT NULL,
      inventory_policy_version varchar(64) NOT NULL,
      recommendation_digest char(64),
      dispatch_evidence_id varchar(60) REFERENCES app.location_evidence(evidence_id),
      receipt_evidence_id varchar(60) REFERENCES app.location_evidence(evidence_id),
      ledger_version integer NOT NULL,
      ledger_transaction_id varchar(128) NOT NULL UNIQUE,
      correlation_id varchar(42) NOT NULL,
      projected_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT transfer_requests_id CHECK (transfer_id ~ '^TRF_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT transfer_requests_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT transfer_requests_hash CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT transfer_requests_source CHECK (source_institution_id = 'INST_MEDIATRIX'),
      CONSTRAINT transfer_requests_distinct_institutions CHECK (source_institution_id <> destination_institution_id),
      CONSTRAINT transfer_requests_blood_type CHECK (blood_type IN ('A_POSITIVE', 'O_POSITIVE')),
      CONSTRAINT transfer_requests_component CHECK (component IN ('RED_BLOOD_CELLS', 'PLATELETS')),
      CONSTRAINT transfer_requests_quantity CHECK (quantity BETWEEN 1 AND 10),
      CONSTRAINT transfer_requests_urgency CHECK (urgency IN ('ROUTINE', 'URGENT', 'CRITICAL')),
      CONSTRAINT transfer_requests_status CHECK (status IN ('PENDING','APPROVED','REJECTED','DISPATCHED','IN_TRANSIT','DELAYED','RECEIVED','COMPROMISED','CANCELLED')),
      CONSTRAINT transfer_requests_reason CHECK (reason_code IS NULL OR reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
      CONSTRAINT transfer_requests_policy CHECK (policy_version = 'SYNTHETIC_TRANSFER_V1' AND inventory_policy_version = 'SYNTHETIC_INVENTORY_V1'),
      CONSTRAINT transfer_requests_recommendation CHECK (recommendation_digest IS NULL OR recommendation_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT transfer_requests_version CHECK (ledger_version >= 1),
      CONSTRAINT transfer_requests_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT transfer_requests_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE INDEX transfer_requests_scope_idx ON app.transfer_requests (destination_institution_id,status,request_time,transfer_id);
    CREATE INDEX transfer_requests_source_idx ON app.transfer_requests (source_institution_id,status,request_time,transfer_id);

    CREATE TABLE app.transfer_selected_units (
      transfer_id varchar(60) NOT NULL REFERENCES app.transfer_requests(transfer_id),
      unit_id varchar(61) NOT NULL REFERENCES app.inventory_projection(unit_id),
      fefo_position integer NOT NULL,
      PRIMARY KEY (transfer_id,unit_id),
      UNIQUE (transfer_id,fefo_position),
      CONSTRAINT transfer_selected_units_position CHECK (fefo_position >= 1)
    );

    CREATE TABLE app.transfer_events (
      event_id varchar(45) PRIMARY KEY,
      transfer_id varchar(60) NOT NULL REFERENCES app.transfer_requests(transfer_id),
      from_status varchar(24),
      to_status varchar(24) NOT NULL,
      actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      actor_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      event_time timestamptz NOT NULL,
      reason_code varchar(64),
      idempotency_key varchar(64) NOT NULL UNIQUE,
      correlation_id varchar(42) NOT NULL,
      ledger_transaction_id varchar(128) NOT NULL UNIQUE,
      ledger_version integer NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT transfer_events_id CHECK (event_id ~ '^TEVT_[0-9A-F]{40}$'),
      CONSTRAINT transfer_events_from CHECK (from_status IS NULL OR from_status IN ('PENDING','APPROVED','REJECTED','DISPATCHED','IN_TRANSIT','DELAYED','RECEIVED','COMPROMISED','CANCELLED')),
      CONSTRAINT transfer_events_to CHECK (to_status IN ('PENDING','APPROVED','REJECTED','DISPATCHED','IN_TRANSIT','DELAYED','RECEIVED','COMPROMISED','CANCELLED')),
      CONSTRAINT transfer_events_initial CHECK (from_status IS NOT NULL OR to_status = 'PENDING'),
      CONSTRAINT transfer_events_reason CHECK (reason_code IS NULL OR reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
      CONSTRAINT transfer_events_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT transfer_events_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT transfer_events_version CHECK (ledger_version >= 1),
      CONSTRAINT transfer_events_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.stock_thresholds (
      threshold_id varchar(45) PRIMARY KEY,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      blood_type varchar(32) NOT NULL,
      component varchar(32) NOT NULL,
      minimum_stock integer NOT NULL,
      safe_stock integer NOT NULL,
      owner_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      config_version varchar(64) NOT NULL,
      effective_at timestamptz NOT NULL,
      superseded_at timestamptz,
      classification varchar(32) NOT NULL,
      CONSTRAINT stock_thresholds_id CHECK (threshold_id ~ '^THRS_[0-9A-F]{40}$'),
      CONSTRAINT stock_thresholds_blood_type CHECK (blood_type IN ('A_POSITIVE','O_POSITIVE')),
      CONSTRAINT stock_thresholds_component CHECK (component IN ('RED_BLOOD_CELLS','PLATELETS')),
      CONSTRAINT stock_thresholds_values CHECK (minimum_stock >= 0 AND safe_stock >= minimum_stock),
      CONSTRAINT stock_thresholds_version CHECK (config_version ~ '^SYNTHETIC_[A-Z0-9_-]{1,54}$'),
      CONSTRAINT stock_thresholds_time CHECK (superseded_at IS NULL OR superseded_at > effective_at),
      CONSTRAINT stock_thresholds_classification CHECK (classification = 'SIMULATION_ONLY'),
      UNIQUE (institution_id,blood_type,component,config_version)
    );

    CREATE TABLE app.alerts (
      alert_id varchar(45) PRIMARY KEY,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      alert_type varchar(32) NOT NULL,
      severity varchar(16) NOT NULL,
      unit_id varchar(61) REFERENCES app.inventory_projection(unit_id),
      threshold_id varchar(45) REFERENCES app.stock_thresholds(threshold_id),
      inventory_status varchar(24),
      expires_at timestamptz,
      evaluated_at timestamptz NOT NULL,
      status varchar(16) NOT NULL,
      resolved_at timestamptz,
      policy_version varchar(64) NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT alerts_id CHECK (alert_id ~ '^ALRT_[0-9A-F]{40}$'),
      CONSTRAINT alerts_type CHECK (alert_type IN ('EXPIRY_WARNING','STOCK_SHORTAGE','STALE_PROJECTION','SYNC_FAILURE')),
      CONSTRAINT alerts_severity CHECK (severity IN ('INFORMATION','WARNING','CRITICAL')),
      CONSTRAINT alerts_status CHECK (status IN ('OPEN','RESOLVED')),
      CONSTRAINT alerts_inventory_status CHECK (inventory_status IS NULL OR inventory_status IN ('AVAILABLE','RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','COMPROMISED','EXPIRED')),
      CONSTRAINT alerts_resolution CHECK ((status='OPEN' AND resolved_at IS NULL) OR (status='RESOLVED' AND resolved_at IS NOT NULL AND resolved_at >= evaluated_at)),
      CONSTRAINT alerts_expiry_evidence CHECK (alert_type <> 'EXPIRY_WARNING' OR (unit_id IS NOT NULL AND expires_at IS NOT NULL AND inventory_status IS NOT NULL)),
      CONSTRAINT alerts_shortage_evidence CHECK (alert_type <> 'STOCK_SHORTAGE' OR threshold_id IS NOT NULL),
      CONSTRAINT alerts_policy CHECK (policy_version ~ '^SYNTHETIC_[A-Z0-9_-]{1,54}$'),
      CONSTRAINT alerts_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE INDEX alerts_scope_idx ON app.alerts (institution_id,status,severity,evaluated_at,alert_id);

    CREATE TABLE app.alert_acknowledgements (
      alert_id varchar(45) NOT NULL REFERENCES app.alerts(alert_id),
      user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      acknowledged_at timestamptz NOT NULL,
      correlation_id varchar(42) NOT NULL,
      PRIMARY KEY (alert_id,user_id),
      CONSTRAINT alert_acknowledgements_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$')
    );

    CREATE TABLE app.audit_events (
      audit_event_id varchar(45) PRIMARY KEY,
      institution_id varchar(64) REFERENCES app.institutions(institution_id),
      actor_user_id varchar(52) REFERENCES app.application_users(user_id),
      action_code varchar(64) NOT NULL,
      target_type varchar(32) NOT NULL,
      target_id varchar(128),
      outcome varchar(16) NOT NULL,
      safe_error_code varchar(64),
      correlation_id varchar(42) NOT NULL,
      ledger_transaction_id varchar(128),
      event_time timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT audit_events_id CHECK (audit_event_id ~ '^AUDT_[0-9A-F]{40}$'),
      CONSTRAINT audit_events_action CHECK (action_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
      CONSTRAINT audit_events_target CHECK (target_type IN ('SESSION','INVENTORY','TRANSFER','ALERT','REPORT','SYSTEM')),
      CONSTRAINT audit_events_outcome CHECK (outcome IN ('SUCCEEDED','DENIED','FAILED')),
      CONSTRAINT audit_events_error CHECK (safe_error_code IS NULL OR safe_error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
      CONSTRAINT audit_events_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT audit_events_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE INDEX audit_events_scope_idx ON app.audit_events (institution_id,event_time,audit_event_id);

    REVOKE ALL ON app.transfer_requests,app.transfer_selected_units,app.transfer_events,app.stock_thresholds,app.alerts,app.alert_acknowledgements,app.audit_events FROM PUBLIC;
    GRANT SELECT,INSERT ON app.transfer_requests,app.transfer_selected_units,app.transfer_events TO bloodledger_app;
    GRANT UPDATE (status,reason_code,recommendation_digest,dispatch_evidence_id,receipt_evidence_id,actor_user_id,ledger_version,ledger_transaction_id,correlation_id,projected_at) ON app.transfer_requests TO bloodledger_app;
    GRANT SELECT ON app.stock_thresholds TO bloodledger_app;
    GRANT SELECT,INSERT ON app.alerts,app.alert_acknowledgements TO bloodledger_app;
    GRANT UPDATE (status,resolved_at) ON app.alerts TO bloodledger_app;
    GRANT SELECT,INSERT ON app.audit_events TO bloodledger_app;
  `);
};

exports.down = false;
