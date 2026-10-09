// TP-STOCK-01 / NFR-02/05: separate immutable scenario journal, no stock inserts.
exports.up = pgm => pgm.sql(`
  CREATE TABLE app.operational_stock_runs (
    run_id varchar(64) PRIMARY KEY,
    scenario_sha256 char(64) NOT NULL,
    manifest_sha256 char(64) NOT NULL UNIQUE,
    target_sha256 char(64) NOT NULL,
    backup_sha256 char(64) NOT NULL,
    manifest jsonb NOT NULL,
    confirmed_at timestamptz NOT NULL,
    writer_lock boolean NOT NULL DEFAULT true,
    census_snapshot_id varchar(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    classification text NOT NULL CHECK (classification='SIMULATION_ONLY')
  );
  CREATE UNIQUE INDEX operational_stock_single_writer ON app.operational_stock_runs(writer_lock) WHERE writer_lock;
  CREATE TABLE app.operational_stock_commands (
    run_id varchar(64) NOT NULL REFERENCES app.operational_stock_runs(run_id),
    command_id varchar(64) PRIMARY KEY REFERENCES app.v2_commands(command_id),
    transaction_id char(64), signed_transaction bytea,
    block_number bigint, validation_status text CHECK (validation_status IS NULL OR validation_status='VALID'),
    committed_at timestamptz,
    CHECK ((transaction_id IS NULL) = (signed_transaction IS NULL)),
    CHECK ((block_number IS NULL) = (committed_at IS NULL))
  );
  REVOKE ALL ON app.operational_stock_runs,app.operational_stock_commands FROM PUBLIC;
  GRANT SELECT,INSERT ON app.operational_stock_runs TO bloodledger_app;
  GRANT UPDATE(writer_lock,census_snapshot_id) ON app.operational_stock_runs TO bloodledger_app;
  GRANT SELECT,INSERT ON app.operational_stock_commands TO bloodledger_app;
  GRANT UPDATE(transaction_id,signed_transaction,block_number,validation_status,committed_at) ON app.operational_stock_commands TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain stock and signed commitment evidence; disable population instead'); };
