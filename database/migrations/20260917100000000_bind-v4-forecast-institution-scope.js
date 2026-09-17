// FR-14 / Issue #9: V4 forecasts belong to the same institution as their run.
// Preserve the accepted V1 scope while allowing the V4 producer's explicit scope.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.forecast_runs
      ADD CONSTRAINT forecast_runs_v1_institution
        CHECK (dataset_version <> 'SYNTHETIC_FORECAST_V1' OR institution_id = 'INST_MEDIATRIX'),
      ADD CONSTRAINT forecast_runs_id_institution_unique UNIQUE (run_id, institution_id);

    ALTER TABLE app.demand_forecasts
      DROP CONSTRAINT demand_forecasts_institution,
      ADD CONSTRAINT demand_forecasts_institution
        CHECK (institution_id ~ '^INST_[A-Z0-9_-]{1,59}$'),
      ADD CONSTRAINT demand_forecasts_run_institution
        FOREIGN KEY (run_id, institution_id)
        REFERENCES app.forecast_runs (run_id, institution_id);
  `);
};

exports.down = false;
