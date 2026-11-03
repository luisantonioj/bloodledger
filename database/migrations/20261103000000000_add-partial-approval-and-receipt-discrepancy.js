// PA-REV-01/02 (ADR-053, Proposed): partial-quantity approval and receipt discrepancy records, off-chain only.
// Reservations gain the requested and approved quantities and an optional partial-approval reason; rows accepted
// before this migration keep NULL. Discrepancies store counts and keyed digests, never label values. Additive only.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_reservations
    ADD COLUMN requested_quantity integer,
    ADD COLUMN approved_quantity integer,
    ADD COLUMN partial_reason_code varchar(64),
    ADD COLUMN partial_policy_version varchar(48),
    ADD CONSTRAINT v2_reservation_quantities CHECK (
      (requested_quantity IS NULL OR requested_quantity >= 1) AND (approved_quantity IS NULL OR approved_quantity >= 1)
      AND (requested_quantity IS NULL OR approved_quantity IS NULL OR approved_quantity <= requested_quantity)),
    ADD CONSTRAINT v2_reservation_partial_reason CHECK (
      (partial_reason_code IS NULL AND partial_policy_version IS NULL)
      OR (partial_reason_code IN ('INSUFFICIENT_ELIGIBLE_STOCK','LOCAL_RESERVE_PROTECTED','OTHER_OPERATIONAL')
        AND partial_policy_version = 'SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1'
        AND approved_quantity < requested_quantity));
  CREATE TABLE app.v2_receipt_discrepancies (
    discrepancy_id varchar(60) PRIMARY KEY,
    reservation_id varchar(64) NOT NULL REFERENCES app.v2_reservations(reservation_id),
    reservation_version integer NOT NULL,
    institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    expected_units integer NOT NULL,
    matched_units integer NOT NULL,
    unmatched_labels integer NOT NULL,
    missing_units integer NOT NULL,
    request_sha256 char(64) NOT NULL,
    evidence_digest char(64) NOT NULL,
    recorded_by varchar(52) NOT NULL REFERENCES app.application_users(user_id),
    recorded_at timestamptz NOT NULL,
    idempotency_key varchar(64) NOT NULL,
    correlation_id varchar(42) NOT NULL,
    status varchar(16) NOT NULL,
    resolution_code varchar(32),
    resolved_at timestamptz,
    policy_version varchar(48) NOT NULL,
    classification varchar(32) NOT NULL,
    UNIQUE (recorded_by, idempotency_key),
    CONSTRAINT v2_discrepancy_id CHECK (discrepancy_id ~ '^RDS_[A-F0-9]{40}$'),
    CONSTRAINT v2_discrepancy_version CHECK (reservation_version >= 1),
    CONSTRAINT v2_discrepancy_counts CHECK (expected_units >= 1 AND matched_units >= 0 AND unmatched_labels >= 0 AND missing_units >= 0
      AND matched_units + missing_units = expected_units AND (missing_units > 0 OR unmatched_labels > 0)),
    CONSTRAINT v2_discrepancy_request_hash CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_discrepancy_digest CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_discrepancy_idempotency CHECK (idempotency_key ~ '^IDEM_[A-Z0-9_-]{1,59}$'),
    CONSTRAINT v2_discrepancy_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
    CONSTRAINT v2_discrepancy_status CHECK ((status = 'OPEN' AND resolution_code IS NULL AND resolved_at IS NULL)
      OR (status = 'RESOLVED' AND resolution_code IN ('RECOUNT_MATCHED','COMPROMISED') AND resolved_at IS NOT NULL)),
    CONSTRAINT v2_discrepancy_policy CHECK (policy_version = 'RECEIPT_DISCREPANCY_V1'),
    CONSTRAINT v2_discrepancy_classification CHECK (classification = 'SIMULATION_ONLY')
  );
  CREATE UNIQUE INDEX v2_discrepancy_one_open_idx ON app.v2_receipt_discrepancies(reservation_id) WHERE status = 'OPEN';
  REVOKE ALL ON app.v2_receipt_discrepancies FROM PUBLIC;
  GRANT SELECT, INSERT ON app.v2_receipt_discrepancies TO bloodledger_app;
  GRANT UPDATE (status, resolution_code, resolved_at) ON app.v2_receipt_discrepancies TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain partial approval and receipt discrepancy evidence'); };
