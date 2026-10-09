exports.up = pgm => pgm.sql(`
  CREATE TABLE app.v2_alert_acknowledgement_commands (
    idempotency_key varchar(64) PRIMARY KEY CHECK(idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
    component_id varchar(64) NOT NULL REFERENCES app.v2_components(component_id),
    actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
    actor_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    correlation_id varchar(42) NOT NULL CHECK(correlation_id ~ '^CORR_[0-9A-F]{32}$'),
    acknowledged_at timestamptz NOT NULL,
    classification text NOT NULL CHECK(classification='SIMULATION_ONLY')
  );
  REVOKE ALL ON app.v2_alert_acknowledgement_commands FROM PUBLIC;
  GRANT SELECT,INSERT ON app.v2_alert_acknowledgement_commands TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain acknowledgement audit evidence'); };
