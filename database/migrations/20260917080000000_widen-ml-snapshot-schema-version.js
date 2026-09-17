exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.ml_inventory_snapshots
      ALTER COLUMN schema_version TYPE varchar(64);
  `);
};

exports.down = false;
