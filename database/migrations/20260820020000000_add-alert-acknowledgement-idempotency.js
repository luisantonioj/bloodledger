exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.alert_acknowledgement_commands (
      idempotency_key varchar(64) PRIMARY KEY,
      payload_sha256 char(64) NOT NULL,
      alert_id varchar(45) NOT NULL,
      user_id varchar(52) NOT NULL,
      correlation_id varchar(42) NOT NULL,
      acknowledged_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      FOREIGN KEY (alert_id,user_id) REFERENCES app.alert_acknowledgements(alert_id,user_id),
      CONSTRAINT alert_ack_commands_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT alert_ack_commands_hash CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT alert_ack_commands_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
      CONSTRAINT alert_ack_commands_classification CHECK (classification = 'SIMULATION_ONLY')
    );
    REVOKE ALL ON app.alert_acknowledgement_commands FROM PUBLIC;
    GRANT SELECT,INSERT ON app.alert_acknowledgement_commands TO bloodledger_app;
  `);
};

exports.down = false;
