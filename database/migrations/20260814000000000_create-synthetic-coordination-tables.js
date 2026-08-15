exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.location_evidence (
      evidence_id varchar(60) PRIMARY KEY,
      evidence_digest char(64) NOT NULL,
      institution_id varchar(64) NOT NULL,
      phase varchar(16) NOT NULL,
      latitude numeric(9, 6) NOT NULL,
      longitude numeric(9, 6) NOT NULL,
      accuracy_metres numeric(10, 3) NOT NULL,
      capture_source varchar(32) NOT NULL,
      fallback_reason varchar(32),
      captured_at timestamptz NOT NULL,
      facility_matched boolean NOT NULL,
      fallback boolean NOT NULL,
      policy_version varchar(64) NOT NULL,
      classification varchar(32) NOT NULL,
      delete_after timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT location_evidence_id_format CHECK (evidence_id ~ '^LOC_[A-Z0-9_-]{1,56}$'),
      CONSTRAINT location_evidence_digest_format CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT location_evidence_phase CHECK (phase IN ('DISPATCH', 'RECEIPT')),
      CONSTRAINT location_evidence_latitude CHECK (latitude BETWEEN -90 AND 90),
      CONSTRAINT location_evidence_longitude CHECK (longitude BETWEEN -180 AND 180),
      CONSTRAINT location_evidence_accuracy CHECK (accuracy_metres > 0 AND accuracy_metres <= 1000),
      CONSTRAINT location_evidence_source CHECK (capture_source IN ('DEVICE', 'FACILITY_FALLBACK')),
      CONSTRAINT location_evidence_fallback CHECK (
        (fallback = false AND capture_source = 'DEVICE' AND fallback_reason IS NULL)
        OR (fallback = true AND capture_source = 'FACILITY_FALLBACK' AND fallback_reason IN (
          'DEVICE_UNAVAILABLE', 'PERMISSION_DENIED', 'SIGNAL_UNAVAILABLE'
        ))
      ),
      CONSTRAINT location_evidence_policy CHECK (policy_version = 'SYNTHETIC_LOCATION_V1'),
      CONSTRAINT location_evidence_classification CHECK (classification = 'SYNTHETIC_DATA'),
      CONSTRAINT location_evidence_retention CHECK (delete_after = captured_at + interval '30 days')
    );

    CREATE TABLE app.algorithm_runs (
      run_id varchar(37) PRIMARY KEY,
      algorithm_name varchar(8) NOT NULL,
      algorithm_version varchar(64) NOT NULL,
      classification varchar(32) NOT NULL,
      recommendation_eligibility varchar(64) NOT NULL,
      input_sha256 char(64) NOT NULL,
      config_sha256 char(64) NOT NULL,
      recommendation_digest char(64),
      evaluation_time timestamptz NOT NULL,
      evidence jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT algorithm_runs_id_format CHECK (run_id ~ '^ARUN_[0-9A-F]{32}$'),
      CONSTRAINT algorithm_runs_name CHECK (algorithm_name IN ('RPS', 'BROA')),
      CONSTRAINT algorithm_runs_version CHECK (algorithm_version = 'SYNTHETIC_OPTIMIZATION_V1'),
      CONSTRAINT algorithm_runs_classification CHECK (classification = 'SIMULATION_ONLY'),
      CONSTRAINT algorithm_runs_eligibility CHECK (
        recommendation_eligibility = 'DISABLED_UNAPPROVED_POLICY'
      ),
      CONSTRAINT algorithm_runs_input_hash CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT algorithm_runs_config_hash CHECK (config_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT algorithm_runs_recommendation_hash CHECK (
        recommendation_digest IS NULL OR recommendation_digest ~ '^[0-9a-f]{64}$'
      ),
      CONSTRAINT algorithm_runs_evidence_object CHECK (jsonb_typeof(evidence) = 'object')
    );

    CREATE FUNCTION app.purge_expired_synthetic_location_evidence(p_as_of timestamptz)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, app
    AS $function$
    DECLARE deleted_count bigint;
    BEGIN
      DELETE FROM app.location_evidence
      WHERE classification = 'SYNTHETIC_DATA' AND delete_after <= p_as_of;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RETURN deleted_count;
    END;
    $function$;

    REVOKE ALL ON app.location_evidence FROM PUBLIC;
    REVOKE ALL ON app.algorithm_runs FROM PUBLIC;
    REVOKE ALL ON FUNCTION app.purge_expired_synthetic_location_evidence(timestamptz) FROM PUBLIC;
    GRANT SELECT, INSERT ON app.location_evidence TO bloodledger_app;
    GRANT SELECT, INSERT ON app.algorithm_runs TO bloodledger_app;
    GRANT EXECUTE ON FUNCTION app.purge_expired_synthetic_location_evidence(timestamptz)
      TO bloodledger_app;
  `);
};

exports.down = false;
