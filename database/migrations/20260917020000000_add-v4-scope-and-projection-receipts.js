exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.forecast_runs
      ADD COLUMN institution_id varchar(64) NOT NULL DEFAULT 'INST_MEDIATRIX',
      ADD CONSTRAINT forecast_runs_institution CHECK (institution_id ~ '^INST_[A-Z0-9_-]{1,59}$');

    ALTER TABLE app.v2_commands
      ADD COLUMN ledger_result jsonb;

    CREATE TABLE app.v2_projection_receipts (
      command_id varchar(64) PRIMARY KEY REFERENCES app.v2_commands(command_id),
      ledger_transaction_id varchar(128) NOT NULL,
      command_payload_sha256 char(64) NOT NULL,
      projected_at timestamptz NOT NULL,
      projection_version varchar(32) NOT NULL,
      CONSTRAINT v2_projection_receipt_hash CHECK (command_payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v2_projection_receipt_version CHECK (projection_version = 'V2.1'),
      CONSTRAINT v2_projection_receipt_transaction CHECK (length(ledger_transaction_id) > 0)
    );
    REVOKE ALL ON app.v2_projection_receipts FROM PUBLIC;
    GRANT SELECT, INSERT ON app.v2_projection_receipts TO bloodledger_app;

    DROP INDEX IF EXISTS app.v2_commands_claim_idx;
    CREATE INDEX v2_commands_claim_idx ON app.v2_commands (next_attempt_at, accepted_at, command_id)
      WHERE status IN ('QUEUED','RETRY_WAIT','LEDGER_COMMITTED_PROJECTION_PENDING');
  `);
};

exports.down = false;
