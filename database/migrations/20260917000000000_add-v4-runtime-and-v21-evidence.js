exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.forecast_runs
      DROP CONSTRAINT forecast_runs_id_format,
      DROP CONSTRAINT forecast_runs_run_key_format,
      DROP CONSTRAINT forecast_runs_dataset_version,
      DROP CONSTRAINT forecast_runs_status,
      DROP CONSTRAINT forecast_runs_error_consistency;
    ALTER TABLE app.forecast_runs
      ADD CONSTRAINT forecast_runs_id_format CHECK (run_id ~ '^(FRUN|RUN)_[0-9A-F]{32}$'),
      ADD CONSTRAINT forecast_runs_run_key_format CHECK (rtrim(run_key) ~ '^[A-Za-z0-9_-]{1,64}$'),
      ADD CONSTRAINT forecast_runs_dataset_version CHECK (dataset_version IN ('SYNTHETIC_FORECAST_V1','SYNTHETIC_FORECAST_V4_RUNTIME_V1')),
      ADD CONSTRAINT forecast_runs_status CHECK (run_status IN ('COMPLETED','UNAVAILABLE','FAILED')),
      ADD CONSTRAINT forecast_runs_error_consistency CHECK (
        (run_status = 'COMPLETED' AND safe_error_code IS NULL)
        OR (run_status IN ('UNAVAILABLE','FAILED') AND safe_error_code IS NOT NULL)
      );

    ALTER TABLE app.demand_forecasts
      ALTER COLUMN forecast_id TYPE varchar(48),
      ALTER COLUMN lower_forecast DROP NOT NULL,
      ALTER COLUMN upper_forecast DROP NOT NULL,
      ADD COLUMN uncertainty_status varchar(32) NOT NULL DEFAULT 'CALIBRATED',
      DROP CONSTRAINT demand_forecasts_id_format,
      DROP CONSTRAINT demand_forecasts_blood_type,
      DROP CONSTRAINT demand_forecasts_component,
      DROP CONSTRAINT demand_forecasts_values;
    ALTER TABLE app.demand_forecasts
      ADD CONSTRAINT demand_forecasts_id_format CHECK (forecast_id ~ '^(FCST|FC)_[0-9A-F]{32,40}$'),
      ADD CONSTRAINT demand_forecasts_blood_type CHECK (blood_type IN ('A_POSITIVE','B_POSITIVE','AB_POSITIVE','O_POSITIVE')),
      ADD CONSTRAINT demand_forecasts_component CHECK (component IN ('RED_BLOOD_CELLS','PACKED_RED_BLOOD_CELLS','PLATELETS','FRESH_FROZEN_PLASMA','CRYOPRECIPITATE','WHOLE_BLOOD')),
      ADD CONSTRAINT demand_forecasts_uncertainty_status CHECK (uncertainty_status IN ('CALIBRATED','UNCERTAINTY_UNAVAILABLE')),
      ADD CONSTRAINT demand_forecasts_values CHECK (
        (uncertainty_status = 'UNCERTAINTY_UNAVAILABLE' AND lower_forecast IS NULL AND upper_forecast IS NULL AND point_forecast >= 0)
        OR (uncertainty_status = 'CALIBRATED' AND lower_forecast IS NOT NULL AND upper_forecast IS NOT NULL AND lower_forecast >= 0 AND point_forecast >= lower_forecast AND upper_forecast >= point_forecast)
      );

    ALTER TABLE app.v2_components
      DROP CONSTRAINT v2_components_type,
      DROP CONSTRAINT v2_components_policy,
      ADD COLUMN last_projection_command_id varchar(64);
    ALTER TABLE app.v2_components
      ADD CONSTRAINT v2_components_type CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      ADD CONSTRAINT v2_components_policy CHECK (policy_version IN ('INTERVIEW_DERIVED_CORE_V2','INTERVIEW_DERIVED_CORE_V2_1'));

    ALTER TABLE app.v2_reservations ADD COLUMN last_projection_command_id varchar(64);

    ALTER TABLE app.v2_census_snapshots
      ADD COLUMN source_projection_digest char(64),
      ADD CONSTRAINT v2_census_projection_digest CHECK (source_projection_digest IS NULL OR source_projection_digest ~ '^[0-9a-f]{64}$');
    ALTER TABLE app.v2_census_counts
      ADD COLUMN forecast_eligible_available_count integer NOT NULL DEFAULT 0,
      DROP CONSTRAINT v2_census_count_component;
    ALTER TABLE app.v2_census_counts
      ADD CONSTRAINT v2_census_count_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      ADD CONSTRAINT v2_census_eligible_nonnegative CHECK (forecast_eligible_available_count >= 0 AND forecast_eligible_available_count <= available_count);

    ALTER TABLE app.v2_source_surplus_evidence
      ADD COLUMN inventory_snapshot_id varchar(64),
      ADD COLUMN source_projection_digest char(64),
      DROP CONSTRAINT v2_surplus_component;
    ALTER TABLE app.v2_source_surplus_evidence
      ADD CONSTRAINT v2_surplus_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      ADD CONSTRAINT v2_surplus_snapshot_shape CHECK (
        (inventory_snapshot_id IS NULL AND source_projection_digest IS NULL)
        OR (inventory_snapshot_id ~ '^CENSUS_[A-Z0-9_-]{1,56}$' AND source_projection_digest ~ '^[0-9a-f]{64}$')
      );

    ALTER TABLE app.v2_inbound_captures
      DROP CONSTRAINT v2_inbound_capture_component;
    ALTER TABLE app.v2_inbound_captures
      ADD CONSTRAINT v2_inbound_capture_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'));

    CREATE OR REPLACE FUNCTION app.v2_reject_census_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'V2_CENSUS_IMMUTABLE';
    END;
    $$;
    CREATE TRIGGER v2_census_snapshot_immutable
      BEFORE UPDATE OR DELETE ON app.v2_census_snapshots
      FOR EACH ROW EXECUTE FUNCTION app.v2_reject_census_mutation();
    CREATE TRIGGER v2_census_counts_immutable
      BEFORE UPDATE OR DELETE ON app.v2_census_counts
      FOR EACH ROW EXECUTE FUNCTION app.v2_reject_census_mutation();
  `);
};

exports.down = false;
