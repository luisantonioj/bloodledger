exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_commands DROP CONSTRAINT IF EXISTS v2_commands_resource;
    ALTER TABLE app.v2_commands ADD CONSTRAINT v2_commands_resource CHECK (resource_type IN ('COMPONENT','INBOUND_CAPTURE','TRANSFER','LOCAL_RELEASE','RECONCILIATION'));

    CREATE TABLE app.v2_issuer_policies (
      issuer_institution_id varchar(64) PRIMARY KEY REFERENCES app.institutions(institution_id),
      policy_version varchar(64) NOT NULL,
      rule_kind varchar(24) NOT NULL,
      number_pattern varchar(256) NOT NULL,
      enabled boolean NOT NULL DEFAULT false,
      classification varchar(32) NOT NULL,
      updated_at timestamptz NOT NULL,
      CONSTRAINT v2_issuer_policy_rule CHECK (rule_kind IN ('MEDIATRIX_MMYY_MONTH_SEQ','OPAQUE_BOUNDED')),
      CONSTRAINT v2_issuer_policy_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.v2_inbound_captures (
      capture_id varchar(64) PRIMARY KEY,
      command_id varchar(64) UNIQUE REFERENCES app.v2_commands(command_id),
      component_id varchar(64) REFERENCES app.v2_components(component_id),
      issuer_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      custody_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      donation_number_lookup_hmac char(64) NOT NULL,
      component_type varchar(32) NOT NULL,
      blood_type varchar(32) NOT NULL,
      capture_method varchar(8) NOT NULL,
      capture_policy_version varchar(64) NOT NULL,
      blood_type_evidence_source varchar(24) NOT NULL,
      component_evidence_source varchar(24) NOT NULL,
      ocr_engine varchar(64) NOT NULL,
      ocr_engine_version varchar(64) NOT NULL,
      donation_number_confidence smallint NOT NULL,
      blood_type_confidence smallint NOT NULL,
      collected_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      captured_at timestamptz NOT NULL,
      confirmed_at timestamptz NOT NULL,
      event_time timestamptz NOT NULL,
      status varchar(24) NOT NULL,
      resolution varchar(32) NOT NULL,
      safe_error_code varchar(64),
      correlation_id varchar(42) NOT NULL,
      classification varchar(32) NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CONSTRAINT v2_inbound_capture_id CHECK (capture_id ~ '^INCAP_[A-Z0-9_-]{1,57}$'),
      CONSTRAINT v2_inbound_capture_hmac CHECK (donation_number_lookup_hmac ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_inbound_capture_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS')),
      CONSTRAINT v2_inbound_capture_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT v2_inbound_capture_method CHECK (capture_method = 'OCR'),
      CONSTRAINT v2_inbound_capture_policy CHECK (capture_policy_version = 'INBOUND_OCR_V1'),
      CONSTRAINT v2_inbound_capture_evidence CHECK (blood_type_evidence_source IN ('OCR_LABEL','OPERATOR_CONFIRMED') AND component_evidence_source IN ('OCR_LABEL','BAG_TYPE','OPERATOR_CONFIRMED')),
      CONSTRAINT v2_inbound_capture_confidence CHECK (donation_number_confidence BETWEEN 90 AND 100 AND blood_type_confidence BETWEEN 90 AND 100),
      CONSTRAINT v2_inbound_capture_time CHECK (collected_at < expires_at AND confirmed_at >= captured_at),
      CONSTRAINT v2_inbound_capture_status CHECK (status IN ('QUEUED','COMMITTED','ALREADY_REGISTERED','CONFLICT','FAILED')),
      CONSTRAINT v2_inbound_capture_resolution CHECK (resolution IN ('REGISTERED','RECEIPT_RESOLVED','ALREADY_REGISTERED','CONFLICT','REJECTED')),
      CONSTRAINT v2_inbound_capture_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_inbound_capture_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    CREATE UNIQUE INDEX v2_inbound_capture_identity_idx ON app.v2_inbound_captures (issuer_institution_id, donation_number_lookup_hmac, component_type);
    CREATE INDEX v2_inbound_capture_status_idx ON app.v2_inbound_captures (custody_institution_id, status, created_at);

    ALTER TABLE app.v2_components ADD COLUMN inbound_capture_id varchar(64) REFERENCES app.v2_inbound_captures(capture_id);
    ALTER TABLE app.v2_components ADD COLUMN capture_method varchar(8);
    ALTER TABLE app.v2_components ADD COLUMN blood_type_evidence_source varchar(24);
    ALTER TABLE app.v2_components ADD COLUMN component_evidence_source varchar(24);
    ALTER TABLE app.v2_components ADD CONSTRAINT v2_components_capture_method CHECK (capture_method IS NULL OR capture_method = 'OCR');
    ALTER TABLE app.v2_components ADD CONSTRAINT v2_components_capture_evidence CHECK ((blood_type_evidence_source IS NULL OR blood_type_evidence_source IN ('OCR_LABEL','OPERATOR_CONFIRMED')) AND (component_evidence_source IS NULL OR component_evidence_source IN ('OCR_LABEL','BAG_TYPE','OPERATOR_CONFIRMED')));

    REVOKE ALL ON app.v2_issuer_policies,app.v2_inbound_captures FROM PUBLIC;
    GRANT SELECT,INSERT,UPDATE ON app.v2_issuer_policies,app.v2_inbound_captures TO bloodledger_app;
  `);
};

exports.down = false;
