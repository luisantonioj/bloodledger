exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_reconciliation_cases
      ADD COLUMN reservation_id varchar(64) REFERENCES app.v2_reservations(reservation_id);

    CREATE TABLE app.v2_transfer_requests (
      transfer_id varchar(60) PRIMARY KEY,
      command_id varchar(64) NOT NULL UNIQUE REFERENCES app.v2_commands(command_id),
      source_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      destination_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      blood_type varchar(32) NOT NULL,
      component_type varchar(32) NOT NULL,
      quantity integer NOT NULL,
      urgency varchar(16) NOT NULL,
      request_time timestamptz NOT NULL,
      status varchar(24) NOT NULL,
      ledger_version integer NOT NULL,
      ledger_transaction_id varchar(128) NOT NULL UNIQUE,
      correlation_id varchar(42) NOT NULL,
      classification varchar(32) NOT NULL,
      CONSTRAINT v2_transfer_projection_id CHECK (transfer_id ~ '^TRF_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT v2_transfer_projection_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT v2_transfer_projection_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      CONSTRAINT v2_transfer_projection_quantity CHECK (quantity >= 1),
      CONSTRAINT v2_transfer_projection_status CHECK (status IN ('PENDING','APPROVED','REJECTED','DISPATCHED','IN_TRANSIT','RECEIVED','COMPROMISED','CANCELLED')),
      CONSTRAINT v2_transfer_projection_version CHECK (ledger_version >= 1),
      CONSTRAINT v2_transfer_projection_distinct CHECK (source_institution_id <> destination_institution_id),
      CONSTRAINT v2_transfer_projection_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT v2_transfer_projection_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    REVOKE ALL ON app.v2_transfer_requests FROM PUBLIC;
    GRANT SELECT, INSERT, UPDATE ON app.v2_transfer_requests TO bloodledger_app;
  `);
};

exports.down = false;
