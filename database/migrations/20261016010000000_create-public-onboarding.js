// PA-ACCOUNT-03 / ADR-048 SYNTHETIC_PUBLIC_APPLICATION_V1: public synthetic application entry,
// reusable synthetic sample-facility claims, retained facility profiles and non-destructive
// deregistration. Additive only; earlier onboarding tables and evidence are unchanged.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.onboarding_applications ALTER COLUMN invitation_id DROP NOT NULL,
      ADD COLUMN schema_version varchar(32) NOT NULL DEFAULT 'INVITATION_V1',
      ADD COLUMN sample_catalog_version varchar(48),
      ADD COLUMN sample_id varchar(32),
      ADD COLUMN sample_instance integer;
    ALTER TABLE app.onboarding_applications
      ADD CONSTRAINT onboarding_schema_version CHECK (schema_version IN ('INVITATION_V1','PUBLIC_APPLICATION_V1')),
      ADD CONSTRAINT onboarding_entry_channel CHECK ((schema_version='INVITATION_V1' AND invitation_id IS NOT NULL) OR (schema_version='PUBLIC_APPLICATION_V1' AND invitation_id IS NULL)),
      ADD CONSTRAINT onboarding_sample_reference CHECK ((sample_id IS NULL AND sample_catalog_version IS NULL AND sample_instance IS NULL)
        OR (schema_version='PUBLIC_APPLICATION_V1' AND sample_id ~ '^SAMPLE_(BANK|REQUESTOR)_[0-9]{2}$' AND sample_catalog_version ~ '^SYNTHETIC_FACILITY_CATALOG_V[0-9]+$' AND sample_instance BETWEEN 1 AND 99));
    CREATE INDEX onboarding_applications_order ON app.onboarding_applications(created_at,application_id);
    ALTER TABLE app.institutions DROP CONSTRAINT institutions_status;
    ALTER TABLE app.institutions ADD CONSTRAINT institutions_status CHECK (status IN ('ACTIVE','SUSPENDED','PENDING_ACTIVATION','DEREGISTERED'));
    -- A claim holds a synthetic catalog identity from submission until rejection, withdrawal or
    -- deregistration. Selection (Fill Up) never writes here. Released rows remain as linkage.
    CREATE TABLE app.onboarding_sample_claims (
      claim_id varchar(64) PRIMARY KEY CHECK (claim_id ~ '^CLM_[0-9A-F]{40}$'),
      catalog_version varchar(48) NOT NULL,
      sample_id varchar(32) NOT NULL CHECK (sample_id ~ '^SAMPLE_(BANK|REQUESTOR)_[0-9]{2}$'),
      category varchar(24) NOT NULL CHECK (category IN ('BLOOD_BANK','REQUESTOR')),
      instance integer NOT NULL CHECK (instance BETWEEN 1 AND 99),
      application_id varchar(64) NOT NULL UNIQUE REFERENCES app.onboarding_applications(application_id),
      status varchar(16) NOT NULL CHECK (status IN ('ACTIVE','RELEASED')),
      claimed_at timestamptz NOT NULL, released_at timestamptz,
      release_reason varchar(24) CHECK (release_reason IN ('REJECTED','WITHDRAWN','DEREGISTERED','APPROVAL_LAPSED')),
      classification varchar(32) NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK (classification='SIMULATION_ONLY'),
      CHECK ((status='ACTIVE' AND released_at IS NULL AND release_reason IS NULL) OR (status='RELEASED' AND released_at IS NOT NULL AND release_reason IS NOT NULL)),
      UNIQUE (catalog_version,sample_id,instance)
    );
    CREATE UNIQUE INDEX onboarding_sample_active_claim ON app.onboarding_sample_claims(catalog_version,sample_id) WHERE status='ACTIVE';
    -- Facility profile copied at activation so it outlives the 30-day application-detail purge.
    CREATE TABLE app.institution_profiles (
      institution_id varchar(64) PRIMARY KEY REFERENCES app.institutions(institution_id),
      application_id varchar(64) NOT NULL UNIQUE REFERENCES app.onboarding_applications(application_id),
      schema_version varchar(32) NOT NULL CHECK (schema_version='PUBLIC_APPLICATION_V1'),
      profile jsonb,
      submitted_at timestamptz NOT NULL, approved_at timestamptz NOT NULL, activated_at timestamptz NOT NULL,
      deregistered_at timestamptz, purge_after timestamptz,
      classification varchar(32) NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK (classification='SIMULATION_ONLY'),
      CHECK ((deregistered_at IS NULL AND purge_after IS NULL) OR purge_after=deregistered_at+interval '30 days')
    );
    REVOKE ALL ON app.onboarding_sample_claims,app.institution_profiles FROM PUBLIC;
    GRANT SELECT,INSERT ON app.onboarding_sample_claims,app.institution_profiles TO bloodledger_app;
    GRANT UPDATE(status,released_at,release_reason) ON app.onboarding_sample_claims TO bloodledger_app;
    GRANT UPDATE(deregistered_at,purge_after) ON app.institution_profiles TO bloodledger_app;
    CREATE OR REPLACE FUNCTION app.purge_closed_synthetic_onboarding(at_time timestamptz) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
    DECLARE changed integer;
    BEGIN
      IF at_time>CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'ONB_PURGE_TIME_INVALID'; END IF;
      UPDATE app.onboarding_applications SET detail=NULL,verification=NULL
        WHERE classification='SIMULATION_ONLY' AND purge_after<=at_time AND (detail IS NOT NULL OR verification IS NOT NULL);
      GET DIAGNOSTICS changed=ROW_COUNT;
      UPDATE app.onboarding_applicant_sessions s SET revoked_at=COALESCE(s.revoked_at,at_time)
        FROM app.onboarding_applications a WHERE a.application_id=s.application_id AND a.purge_after<=at_time;
      -- An approved application purged before activation can never be activated: free its sample.
      UPDATE app.onboarding_sample_claims c SET status='RELEASED',released_at=at_time,release_reason='APPROVAL_LAPSED'
        FROM app.onboarding_applications a WHERE a.application_id=c.application_id AND c.status='ACTIVE'
          AND a.status='APPROVED' AND a.institution_id IS NULL AND a.purge_after<=at_time;
      UPDATE app.institution_profiles SET profile=NULL
        WHERE classification='SIMULATION_ONLY' AND purge_after<=at_time AND profile IS NOT NULL;
      RETURN changed;
    END $$;
    REVOKE ALL ON FUNCTION app.purge_closed_synthetic_onboarding(timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION app.purge_closed_synthetic_onboarding(timestamptz) TO bloodledger_app;
  `);
};
exports.down = () => { throw new Error('Public onboarding evidence is forward-only.'); };
