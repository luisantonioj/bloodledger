// FR-14 / BR-ALG-07: additive V5 simulation runtime and versioned surplus evidence.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.forecast_runs
      DROP CONSTRAINT forecast_runs_dataset_version,
      ADD CONSTRAINT forecast_runs_dataset_version
        CHECK (dataset_version IN ('SYNTHETIC_FORECAST_V1','SYNTHETIC_FORECAST_V4_RUNTIME_V1','SYNTHETIC_FORECAST_V5_RUNTIME_V1'));

    ALTER TABLE app.v2_source_surplus_evidence
      DROP CONSTRAINT v2_surplus_dataset_version,
      DROP CONSTRAINT v2_surplus_v21_provenance,
      ADD CONSTRAINT v2_surplus_dataset_version
        CHECK (dataset_version IS NULL OR dataset_version IN ('SYNTHETIC_FORECAST_V1','SYNTHETIC_FORECAST_V4_RUNTIME_V1','SYNTHETIC_FORECAST_V5_RUNTIME_V1')),
      ADD CONSTRAINT v2_surplus_v21_provenance CHECK (
        component_type <> 'CRYOPRECIPITATE'
        OR (forecast_run_id IS NOT NULL
          AND dataset_version IN ('SYNTHETIC_FORECAST_V4_RUNTIME_V1','SYNTHETIC_FORECAST_V5_RUNTIME_V1')
          AND optimization_policy_version = 'INTERVIEW_DERIVED_OPTIMIZATION_V2_1'
          AND configuration_sha256 IS NOT NULL)
      );

    ALTER TABLE app.v2_source_surplus_evidence
      ADD CONSTRAINT v2_surplus_forecast_institution
        FOREIGN KEY (forecast_run_id, source_institution_id)
        REFERENCES app.forecast_runs (run_id, institution_id);
  `);
};

exports.down = false;
