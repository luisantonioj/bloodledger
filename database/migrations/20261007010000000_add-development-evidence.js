exports.up = pgm => pgm.sql(`
  CREATE TABLE app.development_target_identity (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), instance_id text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text));
  INSERT INTO app.development_target_identity(singleton) VALUES(true);
  REVOKE ALL ON app.development_target_identity FROM PUBLIC;
  GRANT SELECT ON app.development_target_identity TO bloodledger_app;
  CREATE TABLE app.development_seed_runs (
    seed_id text PRIMARY KEY, manifest_sha256 char(64) NOT NULL UNIQUE,
    manifest jsonb NOT NULL, target_sha256 char(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), classification text NOT NULL CHECK(classification='SIMULATION_ONLY')
  );
  CREATE TABLE app.development_seed_commands (
    seed_id text NOT NULL REFERENCES app.development_seed_runs(seed_id),
    command_id varchar(64) PRIMARY KEY REFERENCES app.v2_commands(command_id),
    transaction_id char(64), signed_transaction bytea,
    block_number bigint, validation_status text CHECK(validation_status IS NULL OR validation_status='VALID'),
    CHECK ((transaction_id IS NULL) = (signed_transaction IS NULL))
  );
  CREATE TABLE app.v2_alert_acknowledgements (
    component_id varchar(64) NOT NULL REFERENCES app.v2_components(component_id),
    actor_user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
    acknowledged_at timestamptz NOT NULL,
    classification text NOT NULL CHECK(classification='SIMULATION_ONLY'),
    PRIMARY KEY(component_id,actor_user_id)
  );
  REVOKE ALL ON app.development_seed_runs,app.development_seed_commands,app.v2_alert_acknowledgements FROM PUBLIC;
  GRANT SELECT,INSERT ON app.development_seed_runs TO bloodledger_app;
  GRANT SELECT,INSERT,UPDATE ON app.development_seed_commands TO bloodledger_app;
  GRANT SELECT,INSERT ON app.v2_alert_acknowledgements TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain development commitment evidence; disable seed processing instead'); };
