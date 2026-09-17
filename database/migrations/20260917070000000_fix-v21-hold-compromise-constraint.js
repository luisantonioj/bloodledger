exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_components
      DROP CONSTRAINT v2_components_reservation,
      ADD CONSTRAINT v2_components_reservation CHECK (
        (inventory_status IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','COMPROMISED') AND reservation_purpose IS NOT NULL AND reservation_id IS NOT NULL)
        OR inventory_status = 'RECONCILIATION_HOLD'
        OR (inventory_status NOT IN ('RESERVED','DISPATCHED','IN_TRANSIT','RECEIVED','COMPROMISED','RECONCILIATION_HOLD') AND reservation_purpose IS NULL AND reservation_id IS NULL)
      );
  `);
};

exports.down = false;
