// ADR-047 OUTBOUND_LABEL_VERIFICATION_V1: server-issued preparation evidence from scanned outbound labels.
// Stores only keyed-lookup digests and component IDs, never Donation No. values. Off-chain evidence.
exports.up = pgm => pgm.sql(`
  CREATE TABLE app.v2_outbound_verifications (
    evidence_id varchar(60) PRIMARY KEY,
    reservation_id varchar(64) NOT NULL REFERENCES app.v2_reservations(reservation_id),
    reservation_version integer NOT NULL,
    institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    component_ids jsonb NOT NULL,
    request_sha256 char(64) NOT NULL,
    evidence_digest char(64) NOT NULL,
    verified_by varchar(52) NOT NULL REFERENCES app.application_users(user_id),
    verified_at timestamptz NOT NULL,
    idempotency_key varchar(64) NOT NULL,
    correlation_id varchar(42) NOT NULL,
    policy_version varchar(40) NOT NULL,
    classification varchar(32) NOT NULL,
    UNIQUE (verified_by, idempotency_key),
    CONSTRAINT v2_outbound_evidence_id CHECK (evidence_id ~ '^EVD_[A-F0-9]{40}$'),
    CONSTRAINT v2_outbound_version CHECK (reservation_version >= 1),
    CONSTRAINT v2_outbound_components CHECK (jsonb_typeof(component_ids) = 'array' AND jsonb_array_length(component_ids) >= 1),
    CONSTRAINT v2_outbound_request_hash CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_outbound_digest CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_outbound_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
    CONSTRAINT v2_outbound_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
    CONSTRAINT v2_outbound_policy CHECK (policy_version = 'OUTBOUND_LABEL_VERIFICATION_V1'),
    CONSTRAINT v2_outbound_classification CHECK (classification = 'SIMULATION_ONLY')
  );
  CREATE INDEX v2_outbound_reservation_idx ON app.v2_outbound_verifications(reservation_id, reservation_version);
  REVOKE ALL ON app.v2_outbound_verifications FROM PUBLIC;
  GRANT SELECT, INSERT ON app.v2_outbound_verifications TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain outbound preparation evidence'); };
