exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_reservations
      ADD COLUMN prepared_evidence_digest char(64),
      ADD COLUMN prepared_evidence_id varchar(64),
      DROP CONSTRAINT v2_reservations_status,
      ADD CONSTRAINT v2_reservations_status CHECK (status IN ('ACTIVE','COMPLETED','RESERVED','PREPARED','DISPATCHED','IN_TRANSIT','RECEIVED','RELEASED','CANCELLED','COMPROMISED')),
      ADD CONSTRAINT v2_reservations_prepared_evidence CHECK (
        (prepared_evidence_digest IS NULL AND prepared_evidence_id IS NULL)
        OR (prepared_evidence_digest ~ '^[0-9a-f]{64}$' AND prepared_evidence_id ~ '^EVD_[A-Z0-9_-]{1,56}$')
      );

    ALTER TABLE app.v2_components
      DROP CONSTRAINT v2_components_reservation,
      ADD CONSTRAINT v2_components_reservation CHECK (
        (inventory_status IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','RECONCILIATION_HOLD','COMPROMISED') AND reservation_purpose IS NOT NULL AND reservation_id IS NOT NULL)
        OR (inventory_status NOT IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','RECONCILIATION_HOLD','COMPROMISED') AND reservation_purpose IS NULL AND reservation_id IS NULL)
      );
  `);
};

exports.down = false;
