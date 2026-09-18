exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_source_surplus_evidence
      ADD COLUMN forecast_run_id varchar(37),
      ADD COLUMN dataset_version varchar(64),
      ADD COLUMN optimization_policy_version varchar(64),
      ADD COLUMN configuration_sha256 char(64),
      ADD CONSTRAINT v2_surplus_forecast_run_fk FOREIGN KEY (forecast_run_id) REFERENCES app.forecast_runs(run_id),
      ADD CONSTRAINT v2_surplus_dataset_version CHECK (dataset_version IS NULL OR dataset_version IN ('SYNTHETIC_FORECAST_V1','SYNTHETIC_FORECAST_V4_RUNTIME_V1')),
      ADD CONSTRAINT v2_surplus_optimization_policy CHECK (optimization_policy_version IS NULL OR optimization_policy_version IN ('INTERVIEW_DERIVED_OPTIMIZATION_V2','INTERVIEW_DERIVED_OPTIMIZATION_V2_1')),
      ADD CONSTRAINT v2_surplus_configuration_hash CHECK (configuration_sha256 IS NULL OR configuration_sha256 ~ '^[0-9a-f]{64}$'),
      ADD CONSTRAINT v2_surplus_v21_provenance CHECK (
        component_type <> 'CRYOPRECIPITATE'
        OR (forecast_run_id IS NOT NULL AND dataset_version = 'SYNTHETIC_FORECAST_V4_RUNTIME_V1' AND optimization_policy_version = 'INTERVIEW_DERIVED_OPTIMIZATION_V2_1' AND configuration_sha256 IS NOT NULL)
      );
  `);
};

exports.down = false;
