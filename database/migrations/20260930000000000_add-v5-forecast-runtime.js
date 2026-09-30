// FR-14 / BR-ALG-07: additive V5 simulation forecast runs only.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.forecast_runs
      DROP CONSTRAINT forecast_runs_dataset_version,
      ADD CONSTRAINT forecast_runs_dataset_version
        CHECK (dataset_version IN ('SYNTHETIC_FORECAST_V1','SYNTHETIC_FORECAST_V4_RUNTIME_V1','SYNTHETIC_FORECAST_V5_RUNTIME_V1'));
  `);
};

exports.down = false;
