exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.ml_inventory_snapshots (
      snapshot_id varchar(64) PRIMARY KEY,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      scheduled_for timestamptz NOT NULL,
      captured_at timestamptz NOT NULL,
      timezone varchar(32) NOT NULL,
      snapshot_kind varchar(24) NOT NULL,
      policy_version varchar(64) NOT NULL,
      schema_version varchar(32) NOT NULL,
      projection_watermark bigint NOT NULL,
      source_projection_digest char(64) NOT NULL,
      classification varchar(32) NOT NULL,
      UNIQUE (institution_id, scheduled_for, policy_version),
      CONSTRAINT ml_snapshot_id CHECK (snapshot_id ~ '^CENSUS_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT ml_snapshot_timezone CHECK (timezone = 'Asia/Manila'),
      CONSTRAINT ml_snapshot_kind CHECK (snapshot_kind = 'INTERNAL_ML'),
      CONSTRAINT ml_snapshot_policy CHECK (policy_version = 'INTERVIEW_ML_INVENTORY_SNAPSHOT_V1'),
      CONSTRAINT ml_snapshot_schema CHECK (schema_version = 'BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1'),
      CONSTRAINT ml_snapshot_watermark CHECK (projection_watermark >= 0),
      CONSTRAINT ml_snapshot_digest CHECK (source_projection_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT ml_snapshot_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.ml_inventory_snapshot_counts (
      snapshot_id varchar(64) NOT NULL REFERENCES app.ml_inventory_snapshots(snapshot_id),
      component_type varchar(32) NOT NULL,
      blood_type varchar(32) NOT NULL,
      available_count integer NOT NULL,
      reserved_count integer NOT NULL,
      forecast_eligible_available_count integer NOT NULL,
      reportable_count integer NOT NULL,
      PRIMARY KEY (snapshot_id, component_type, blood_type),
      CONSTRAINT ml_snapshot_count_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
      CONSTRAINT ml_snapshot_count_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
      CONSTRAINT ml_snapshot_count_nonnegative CHECK (available_count >= 0 AND reserved_count >= 0 AND forecast_eligible_available_count >= 0 AND forecast_eligible_available_count <= available_count AND reportable_count = available_count + reserved_count)
    );

    CREATE OR REPLACE FUNCTION app.ml_inventory_snapshot_immutable()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'ML_INVENTORY_SNAPSHOT_IMMUTABLE';
    END;
    $$;
    CREATE TRIGGER ml_inventory_snapshot_immutable
      BEFORE UPDATE OR DELETE ON app.ml_inventory_snapshots
      FOR EACH ROW EXECUTE FUNCTION app.ml_inventory_snapshot_immutable();
    CREATE TRIGGER ml_inventory_snapshot_counts_immutable
      BEFORE UPDATE OR DELETE ON app.ml_inventory_snapshot_counts
      FOR EACH ROW EXECUTE FUNCTION app.ml_inventory_snapshot_immutable();

    CREATE OR REPLACE FUNCTION app.ml_inventory_snapshot_require_complete()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF (SELECT COUNT(*) FROM app.ml_inventory_snapshot_counts WHERE snapshot_id = NEW.snapshot_id) <> 40 THEN
        RAISE EXCEPTION 'ML_INVENTORY_SNAPSHOT_INCOMPLETE';
      END IF;
      RETURN NULL;
    END;
    $fn$;
    CREATE CONSTRAINT TRIGGER ml_inventory_snapshot_complete
      AFTER INSERT ON app.ml_inventory_snapshots
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION app.ml_inventory_snapshot_require_complete();
    CREATE CONSTRAINT TRIGGER ml_inventory_snapshot_counts_complete
      AFTER INSERT ON app.ml_inventory_snapshot_counts
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION app.ml_inventory_snapshot_require_complete();

    REVOKE ALL ON app.ml_inventory_snapshots,app.ml_inventory_snapshot_counts FROM PUBLIC;
    GRANT SELECT,INSERT ON app.ml_inventory_snapshots,app.ml_inventory_snapshot_counts TO bloodledger_app;
  `);
};

exports.down = false;
