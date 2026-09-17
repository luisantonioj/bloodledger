exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_reservations
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  `);
};

exports.down = false;
