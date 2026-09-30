// FR-14 / BR-ALG-07: distinct V5 simulation surplus, scoped to forecast and census.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.demand_forecasts
      ADD CONSTRAINT demand_forecasts_v5_row_scope UNIQUE (forecast_id, run_id, institution_id);
    ALTER TABLE app.ml_inventory_snapshots
      ADD CONSTRAINT ml_snapshots_v5_scope UNIQUE (snapshot_id, institution_id);

    CREATE TABLE app.v5_source_surplus_evidence (
      evidence_id varchar(64) PRIMARY KEY,
      source_institution_id varchar(64) NOT NULL,
      blood_type varchar(32) NOT NULL,
      component_type varchar(32) NOT NULL,
      surplus_quantity integer NOT NULL,
      as_of timestamptz NOT NULL,
      inventory_as_of timestamptz NOT NULL,
      origin_date date NOT NULL,
      horizon_date date NOT NULL,
      forecast_status varchar(16) NOT NULL,
      dataset_version varchar(64) NOT NULL,
      forecast_run_id varchar(37) NOT NULL,
      forecast_id varchar(48) NOT NULL,
      model_version varchar(96) NOT NULL,
      model_sha256 char(64) NOT NULL,
      forecast_payload_sha256 char(64) NOT NULL,
      optimization_policy_version varchar(64) NOT NULL,
      configuration_sha256 char(64) NOT NULL,
      inventory_snapshot_id varchar(64) NOT NULL,
      source_projection_digest char(64) NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT v5_surplus_id CHECK (evidence_id ~ '^SURP_[0-9A-F]{40}$'),
      CONSTRAINT v5_surplus_source CHECK (source_institution_id ~ '^INST_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT v5_surplus_blood CHECK (blood_type IN ('A_POSITIVE','B_POSITIVE','O_POSITIVE','AB_POSITIVE')),
      CONSTRAINT v5_surplus_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      CONSTRAINT v5_surplus_nonnegative CHECK (surplus_quantity >= 0),
      CONSTRAINT v5_surplus_dates CHECK (horizon_date = origin_date + 1),
      CONSTRAINT v5_surplus_status CHECK (forecast_status = 'AVAILABLE'),
      CONSTRAINT v5_surplus_dataset CHECK (dataset_version = 'SYNTHETIC_FORECAST_V5_RUNTIME_V1'),
      CONSTRAINT v5_surplus_model CHECK (model_version = 'bloodledger-v5-series-mean-1.0.0'),
      CONSTRAINT v5_surplus_model_hash CHECK (model_sha256 = 'ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86'),
      CONSTRAINT v5_surplus_payload_hash CHECK (forecast_payload_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v5_surplus_policy CHECK (optimization_policy_version = 'INTERVIEW_DERIVED_OPTIMIZATION_V2_1'),
      CONSTRAINT v5_surplus_config CHECK (configuration_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v5_surplus_projection CHECK (source_projection_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT v5_surplus_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT v5_surplus_eligibility CHECK (recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY'),
      CONSTRAINT v5_surplus_forecast_scope FOREIGN KEY (forecast_id, forecast_run_id, source_institution_id)
        REFERENCES app.demand_forecasts (forecast_id, run_id, institution_id),
      CONSTRAINT v5_surplus_inventory_scope FOREIGN KEY (inventory_snapshot_id, source_institution_id)
        REFERENCES app.ml_inventory_snapshots (snapshot_id, institution_id)
    );

    CREATE FUNCTION app.v5_validate_surplus_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE saved record;
    BEGIN
      SELECT fr.dataset_version, fr.run_status, fr.model_version, fr.lineage,
             fr.input_end_date, fr.generated_at,
             df.blood_type, df.component, df.horizon_date, df.forecast_status,
             snapshot.source_projection_digest, snapshot.captured_at
      INTO saved
      FROM app.demand_forecasts df
      JOIN app.forecast_runs fr ON fr.run_id=df.run_id AND fr.institution_id=df.institution_id
      JOIN app.ml_inventory_snapshots snapshot ON snapshot.snapshot_id=NEW.inventory_snapshot_id
        AND snapshot.institution_id=NEW.source_institution_id
      WHERE df.forecast_id=NEW.forecast_id AND df.run_id=NEW.forecast_run_id
        AND df.institution_id=NEW.source_institution_id;
      IF NOT FOUND OR saved.dataset_version <> 'SYNTHETIC_FORECAST_V5_RUNTIME_V1'
         OR saved.run_status <> 'COMPLETED' OR saved.model_version <> NEW.model_version
         OR saved.lineage->>'modelSha256' <> NEW.model_sha256
         OR saved.lineage->>'payloadSha256' <> NEW.forecast_payload_sha256
         OR saved.blood_type <> NEW.blood_type OR saved.component <> NEW.component_type
         OR saved.horizon_date <> NEW.horizon_date OR saved.input_end_date <> NEW.origin_date
         OR saved.generated_at <> NEW.as_of OR saved.forecast_status <> 'AVAILABLE'
         OR saved.source_projection_digest <> NEW.source_projection_digest
         OR saved.captured_at <> NEW.inventory_as_of
         OR (saved.captured_at AT TIME ZONE 'Asia/Manila')::date <> NEW.horizon_date THEN
        RAISE EXCEPTION 'V5_SURPLUS_EVIDENCE_MISMATCH';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER v5_surplus_insert_guard BEFORE INSERT ON app.v5_source_surplus_evidence
      FOR EACH ROW EXECUTE FUNCTION app.v5_validate_surplus_insert();

    CREATE FUNCTION app.v5_reject_surplus_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      RAISE EXCEPTION 'V5_SURPLUS_IMMUTABLE';
    END;
    $fn$;
    CREATE TRIGGER v5_surplus_immutable BEFORE UPDATE OR DELETE ON app.v5_source_surplus_evidence
      FOR EACH ROW EXECUTE FUNCTION app.v5_reject_surplus_mutation();

    REVOKE ALL ON app.v5_source_surplus_evidence FROM PUBLIC;
    GRANT SELECT, INSERT ON app.v5_source_surplus_evidence TO bloodledger_app;
  `);
};

exports.down = false;
