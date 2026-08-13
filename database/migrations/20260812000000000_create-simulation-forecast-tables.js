exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.forecast_runs (
      run_id varchar(37) PRIMARY KEY,
      run_key char(64) NOT NULL UNIQUE,
      payload_sha256 char(64) NOT NULL,
      dataset_version varchar(64) NOT NULL,
      generator_version varchar(96) NOT NULL,
      dataset_sha256 char(64) NOT NULL,
      code_sha256 char(64) NOT NULL,
      config_sha256 char(64) NOT NULL,
      model_artifact_sha256 char(64) NOT NULL,
      model_version varchar(96) NOT NULL,
      model_name varchar(64) NOT NULL,
      target_name varchar(64) NOT NULL,
      input_start_date date NOT NULL,
      input_end_date date NOT NULL,
      horizon_date date NOT NULL,
      generated_at timestamptz NOT NULL,
      classification varchar(32) NOT NULL,
      run_status varchar(16) NOT NULL,
      safe_error_code varchar(64),
      lineage jsonb NOT NULL,
      selection_evidence jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT forecast_runs_id_format CHECK (run_id ~ '^FRUN_[0-9A-F]{32}$'),
      CONSTRAINT forecast_runs_run_key_format CHECK (run_key ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_payload_hash_format CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_dataset_hash_format CHECK (dataset_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_code_hash_format CHECK (code_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_config_hash_format CHECK (config_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_artifact_hash_format CHECK (model_artifact_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT forecast_runs_dataset_version CHECK (dataset_version = 'SYNTHETIC_FORECAST_V1'),
      CONSTRAINT forecast_runs_target CHECK (target_name = 'requested_units'),
      CONSTRAINT forecast_runs_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT forecast_runs_status CHECK (run_status IN ('COMPLETED', 'FAILED')),
      CONSTRAINT forecast_runs_error_consistency CHECK (
        (run_status = 'COMPLETED' AND safe_error_code IS NULL)
        OR (run_status = 'FAILED' AND safe_error_code IS NOT NULL)
      ),
      CONSTRAINT forecast_runs_dates CHECK (
        input_start_date <= input_end_date AND input_end_date < horizon_date
      ),
      CONSTRAINT forecast_runs_lineage_object CHECK (jsonb_typeof(lineage) = 'object'),
      CONSTRAINT forecast_runs_selection_object CHECK (jsonb_typeof(selection_evidence) = 'object')
    );

    CREATE TABLE app.demand_forecasts (
      forecast_id varchar(37) PRIMARY KEY,
      run_id varchar(37) NOT NULL REFERENCES app.forecast_runs(run_id),
      institution_id varchar(64) NOT NULL,
      blood_type varchar(32) NOT NULL,
      component varchar(32) NOT NULL,
      horizon_date date NOT NULL,
      point_forecast numeric(12, 6) NOT NULL,
      lower_forecast numeric(12, 6) NOT NULL,
      upper_forecast numeric(12, 6) NOT NULL,
      uncertainty_note varchar(96) NOT NULL,
      forecast_status varchar(16) NOT NULL,
      stale_after date NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      generated_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT demand_forecasts_id_format CHECK (forecast_id ~ '^FCST_[0-9A-F]{32}$'),
      CONSTRAINT demand_forecasts_institution CHECK (institution_id = 'INST_MEDIATRIX'),
      CONSTRAINT demand_forecasts_blood_type CHECK (blood_type IN ('A_POSITIVE', 'O_POSITIVE')),
      CONSTRAINT demand_forecasts_component CHECK (component IN ('RED_BLOOD_CELLS', 'PLATELETS')),
      CONSTRAINT demand_forecasts_values CHECK (
        lower_forecast >= 0
        AND point_forecast >= lower_forecast
        AND upper_forecast >= point_forecast
      ),
      CONSTRAINT demand_forecasts_status CHECK (
        forecast_status IN ('AVAILABLE', 'STALE', 'UNAVAILABLE')
      ),
      CONSTRAINT demand_forecasts_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT demand_forecasts_eligibility CHECK (
        recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY'
      ),
      CONSTRAINT demand_forecasts_stale_date CHECK (stale_after >= horizon_date),
      CONSTRAINT demand_forecasts_one_per_series UNIQUE (
        run_id, institution_id, blood_type, component, horizon_date
      )
    );

    REVOKE ALL ON app.forecast_runs FROM PUBLIC;
    REVOKE ALL ON app.demand_forecasts FROM PUBLIC;
    GRANT SELECT, INSERT ON app.forecast_runs TO bloodledger_app;
    GRANT SELECT, INSERT ON app.demand_forecasts TO bloodledger_app;
  `);
};

exports.down = false;
