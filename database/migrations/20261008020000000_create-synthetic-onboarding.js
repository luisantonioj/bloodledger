exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.onboarding_invitations (
      invitation_id varchar(64) PRIMARY KEY, token_digest char(64) NOT NULL UNIQUE,
      category varchar(24) NOT NULL CHECK(category IN ('BLOOD_BANK','REQUESTOR')),
      status varchar(16) NOT NULL CHECK(status IN ('ISSUED','CONSUMED','REVOKED','EXPIRED')),
      issued_by varchar(52) NOT NULL, expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL, consumed_at timestamptz
    );
    CREATE TABLE app.onboarding_applications (
      application_id varchar(64) PRIMARY KEY,
      invitation_id varchar(64) NOT NULL UNIQUE REFERENCES app.onboarding_invitations(invitation_id),
      applicant_id varchar(52) NOT NULL UNIQUE,
      match_digest char(64) NOT NULL,
      previous_application_id varchar(64) REFERENCES app.onboarding_applications(application_id),
      password_salt char(32) NOT NULL, password_verifier char(128) NOT NULL,
      category varchar(24) NOT NULL CHECK(category IN ('BLOOD_BANK','REQUESTOR')),
      institution_id varchar(64) REFERENCES app.institutions(institution_id),
      status varchar(24) NOT NULL CHECK(status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
      version integer NOT NULL DEFAULT 1,
      detail jsonb, verification jsonb, reviewed_by varchar(52),
      created_at timestamptz NOT NULL, closed_at timestamptz, purge_after timestamptz,
      CHECK((closed_at IS NULL AND purge_after IS NULL) OR purge_after=closed_at+interval '30 days'),
      idempotency_key varchar(64) NOT NULL UNIQUE, payload_sha256 char(64) NOT NULL,
      classification varchar(32) NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK(classification='SIMULATION_ONLY')
    );
    CREATE TABLE app.onboarding_applicant_sessions (
      token_digest char(64) PRIMARY KEY,
      application_id varchar(64) NOT NULL REFERENCES app.onboarding_applications(application_id),
      expires_at timestamptz NOT NULL, revoked_at timestamptz
    );
    REVOKE ALL ON app.onboarding_invitations,app.onboarding_applications,app.onboarding_applicant_sessions FROM PUBLIC;
    GRANT SELECT,INSERT ON app.onboarding_invitations,app.onboarding_applications,app.onboarding_applicant_sessions TO bloodledger_app;
    GRANT UPDATE(status,consumed_at) ON app.onboarding_invitations TO bloodledger_app;
    GRANT UPDATE(status,version,institution_id,verification,reviewed_by,closed_at,purge_after) ON app.onboarding_applications TO bloodledger_app;
    GRANT UPDATE(revoked_at) ON app.onboarding_applicant_sessions TO bloodledger_app;
    -- Off-chain onboarding writes are allowlisted and still authorized by the API.
    GRANT INSERT ON app.institutions,app.application_users,app.user_role_assignments,app.institution_operators TO bloodledger_app;
    GRANT UPDATE(status,account_model,account_category,version,display_name) ON app.institutions TO bloodledger_app;
    GRANT UPDATE(status,account_kind,password_salt,password_verifier,credential_version,updated_at) ON app.application_users TO bloodledger_app;
    GRANT UPDATE(account_id,status,pin_salt,pin_verifier,version,failed_attempts,locked_until) ON app.institution_operators TO bloodledger_app;
    CREATE FUNCTION app.purge_closed_synthetic_onboarding(at_time timestamptz) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
    DECLARE changed integer;
    BEGIN
      IF at_time>CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'ONB_PURGE_TIME_INVALID'; END IF;
      UPDATE app.onboarding_applications SET detail=NULL,verification=NULL
        WHERE classification='SIMULATION_ONLY' AND purge_after<=at_time AND (detail IS NOT NULL OR verification IS NOT NULL);
      GET DIAGNOSTICS changed=ROW_COUNT;
      UPDATE app.onboarding_applicant_sessions s SET revoked_at=COALESCE(s.revoked_at,at_time)
        FROM app.onboarding_applications a WHERE a.application_id=s.application_id AND a.purge_after<=at_time;
      RETURN changed;
    END $$;
    REVOKE ALL ON FUNCTION app.purge_closed_synthetic_onboarding(timestamptz) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION app.purge_closed_synthetic_onboarding(timestamptz) TO bloodledger_app;
  `);
};
exports.down = () => { throw new Error('Onboarding evidence is forward-only.'); };
