export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.synthetic_inventory_snapshots (
      snapshot_id varchar(48) PRIMARY KEY,
      workbook_sha256 char(64) NOT NULL CHECK (workbook_sha256 ~ '^[0-9a-f]{64}$'),
      manifest_sha256 char(64) NOT NULL UNIQUE CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
      source_business_date date NOT NULL,
      source_institution_id text NOT NULL CHECK (source_institution_id = 'SIM_INSTITUTION_01'),
      dataset_version text NOT NULL CHECK (dataset_version = 'SYNTHETIC_FORECAST_V5_RESEARCH_V1'),
      manifest jsonb NOT NULL,
      review_reference text NOT NULL,
      operator_user_id text NOT NULL CHECK (operator_user_id = 'USR_SYNTH_HISTORICAL_IMPORT'),
      status text NOT NULL CHECK (status IN ('INCOMPLETE','COMPLETE')),
      expected_units integer NOT NULL CHECK (expected_units >= 0),
      verified_units integer NOT NULL DEFAULT 0 CHECK (verified_units >= 0),
      ledger_transaction_id char(64), block_number bigint, validation_status text,
      created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
      classification text NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK (classification = 'SIMULATION_ONLY'),
      CHECK (status <> 'COMPLETE' OR (expected_units = verified_units AND validation_status = 'VALID' AND ledger_transaction_id IS NOT NULL AND block_number IS NOT NULL))
    );
    CREATE TABLE app.synthetic_inventory_counts (
      snapshot_id varchar(48) NOT NULL REFERENCES app.synthetic_inventory_snapshots(snapshot_id),
      series_key text NOT NULL, blood_type text NOT NULL, component_type text NOT NULL,
      available_units integer NOT NULL CHECK (available_units >= 0),
      reserved_units integer NOT NULL CHECK (reserved_units >= 0),
      closing_units integer NOT NULL CHECK (closing_units = available_units + reserved_units),
      PRIMARY KEY (snapshot_id, series_key)
    );
    CREATE TABLE app.synthetic_inventory_units (
      component_id varchar(48) PRIMARY KEY,
      snapshot_id varchar(48) NOT NULL,
      series_key text NOT NULL,
      snapshot_status text NOT NULL CHECK (snapshot_status IN ('AVAILABLE','RESERVED')),
      allocation_group_id varchar(48),
      original_reservation_purpose text CHECK (original_reservation_purpose IS NULL),
      collected_at timestamptz CHECK (collected_at IS NULL),
      expires_at timestamptz CHECK (expires_at IS NULL),
      donation_number text CHECK (donation_number IS NULL),
      ledger_transaction_id char(64) NOT NULL,
      block_number bigint NOT NULL,
      validation_status text NOT NULL CHECK (validation_status = 'VALID'),
      committed_at timestamptz NOT NULL,
      classification text NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK (classification = 'SIMULATION_ONLY'),
      provenance text NOT NULL DEFAULT 'CONSTRUCTED_AGGREGATE_REPRESENTATION' CHECK (provenance = 'CONSTRUCTED_AGGREGATE_REPRESENTATION'),
      FOREIGN KEY (snapshot_id,series_key) REFERENCES app.synthetic_inventory_counts(snapshot_id,series_key),
      CHECK ((snapshot_status='AVAILABLE' AND allocation_group_id IS NULL) OR (snapshot_status='RESERVED' AND allocation_group_id IS NOT NULL))
    );
    CREATE TABLE app.synthetic_inventory_import_commands (
      command_id text PRIMARY KEY,
      snapshot_id varchar(48) NOT NULL REFERENCES app.synthetic_inventory_snapshots(snapshot_id),
      step_index integer NOT NULL,
      operation text NOT NULL CHECK (operation IN ('BeginSnapshot','RegisterUnit','FinalizeSnapshot')),
      payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SUBMITTING','LEDGER_COMMITTED_PROJECTION_PENDING','COMMITTED','FAILED')),
      signed_transaction bytea, transaction_id char(64),
      ledger_result jsonb, block_number bigint, validation_status text,
      attempt_count integer NOT NULL DEFAULT 0, safe_error_code text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (snapshot_id,step_index),
      CHECK (status NOT IN ('LEDGER_COMMITTED_PROJECTION_PENDING','COMMITTED') OR (validation_status='VALID' AND ledger_result IS NOT NULL AND transaction_id IS NOT NULL AND block_number IS NOT NULL))
    );
    CREATE VIEW app.synthetic_inventory_completed_units AS
      SELECT u.*,s.source_business_date,s.workbook_sha256,s.manifest_sha256,s.source_institution_id
      FROM app.synthetic_inventory_units u JOIN app.synthetic_inventory_snapshots s USING(snapshot_id)
      WHERE s.status='COMPLETE';
    REVOKE ALL ON app.synthetic_inventory_snapshots, app.synthetic_inventory_counts,
      app.synthetic_inventory_units, app.synthetic_inventory_import_commands,
      app.synthetic_inventory_completed_units FROM PUBLIC;
    GRANT SELECT,INSERT,UPDATE ON app.synthetic_inventory_snapshots,app.synthetic_inventory_import_commands TO bloodledger_app;
    GRANT SELECT,INSERT ON app.synthetic_inventory_counts,app.synthetic_inventory_units TO bloodledger_app;
    GRANT SELECT ON app.synthetic_inventory_completed_units TO bloodledger_app;
  `);
};
export const down = () => { throw new Error('Historical ledger evidence is retained; disable the importer instead of dropping records'); };
