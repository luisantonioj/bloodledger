// ADR-049 INBOUND_RECEIPT_LABEL_VERIFICATION_V1: server-issued receipt evidence from scanned in-transit labels.
// Stores only keyed-lookup digests and component IDs, never Donation No. values. Off-chain evidence that `receive`
// references; it registers no stock. Additive only; existing tables are unchanged.
exports.up = pgm => pgm.sql(`
  CREATE TABLE app.v2_receipt_verifications (
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
    policy_version varchar(48) NOT NULL,
    classification varchar(32) NOT NULL,
    UNIQUE (verified_by, idempotency_key),
    CONSTRAINT v2_receipt_evidence_id CHECK (evidence_id ~ '^RCV_[A-F0-9]{40}$'),
    CONSTRAINT v2_receipt_version CHECK (reservation_version >= 1),
    CONSTRAINT v2_receipt_components CHECK (jsonb_typeof(component_ids) = 'array' AND jsonb_array_length(component_ids) >= 1),
    CONSTRAINT v2_receipt_request_hash CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_receipt_digest CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_receipt_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
    CONSTRAINT v2_receipt_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
    CONSTRAINT v2_receipt_policy CHECK (policy_version = 'INBOUND_RECEIPT_LABEL_VERIFICATION_V1'),
    CONSTRAINT v2_receipt_classification CHECK (classification = 'SIMULATION_ONLY')
  );
  CREATE INDEX v2_receipt_reservation_idx ON app.v2_receipt_verifications(reservation_id, reservation_version);
  REVOKE ALL ON app.v2_receipt_verifications FROM PUBLIC;
  GRANT SELECT, INSERT ON app.v2_receipt_verifications TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain receipt evidence'); };
