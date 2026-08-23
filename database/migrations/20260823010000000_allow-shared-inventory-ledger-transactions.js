exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.inventory_projection
      DROP CONSTRAINT inventory_projection_ledger_transaction_id_key;
    CREATE INDEX inventory_projection_ledger_transaction_idx
      ON app.inventory_projection (ledger_transaction_id);
  `);
};

exports.down = false;
