exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.institutions ADD COLUMN account_model varchar(32) NOT NULL DEFAULT 'LEGACY_ROLES',
      ADD COLUMN account_category varchar(24), ADD COLUMN version integer NOT NULL DEFAULT 1;
    ALTER TABLE app.institutions ADD CONSTRAINT institution_account_category CHECK (account_category IN ('BLOOD_BANK','REQUESTOR','PRC','DOH','SYSTEM'));
    ALTER TABLE app.institutions DROP CONSTRAINT institutions_status;
    ALTER TABLE app.institutions ADD CONSTRAINT institutions_status CHECK (status IN ('ACTIVE','SUSPENDED','PENDING_ACTIVATION'));
    ALTER TABLE app.application_users ADD COLUMN account_kind varchar(24) NOT NULL DEFAULT 'LEGACY',
      ADD COLUMN credential_version integer NOT NULL DEFAULT 1;
    ALTER TABLE app.application_users ADD CONSTRAINT application_users_account_kind CHECK (account_kind IN ('LEGACY','PRIMARY','OPERATOR','INTERNAL','RETIRED'));
    ALTER TABLE app.application_users DROP CONSTRAINT application_users_status;
    ALTER TABLE app.application_users ADD CONSTRAINT application_users_status CHECK (status IN ('ACTIVE','SUSPENDED','RETIRED'));
    ALTER TABLE app.application_users DROP CONSTRAINT application_users_username;
    ALTER TABLE app.application_users ADD CONSTRAINT application_users_username CHECK
      (username ~ '^synth_[a-z0-9_]{3,57}$' OR (account_kind IN ('PRIMARY','RETIRED') AND username ~ '^[a-z0-9._+-]{1,40}@[a-z0-9.-]{1,20}[.]bloodledger$'));
    CREATE UNIQUE INDEX institution_primary_active_account ON app.application_users(institution_id)
      WHERE account_kind='PRIMARY' AND status='ACTIVE';
    CREATE FUNCTION app.guard_institution_login_model() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM 1 FROM app.institutions WHERE institution_id=NEW.institution_id FOR UPDATE;
      IF NEW.status='ACTIVE' AND NEW.account_kind='LEGACY' AND (EXISTS
        (SELECT 1 FROM app.institutions WHERE institution_id=NEW.institution_id AND account_model='INSTITUTION_V1') OR EXISTS(SELECT 1 FROM app.institution_account_migrations WHERE status IN ('APPLIED','ROLLED_BACK'))) THEN
        RAISE EXCEPTION 'ACCOUNT_PRIMARY_REQUIRED' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_institution_login_model BEFORE INSERT OR UPDATE ON app.application_users
      FOR EACH ROW EXECUTE FUNCTION app.guard_institution_login_model();
    CREATE TABLE app.institution_operators (
      operator_id varchar(52) PRIMARY KEY REFERENCES app.application_users(user_id),
      account_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      role_id varchar(16) NOT NULL CHECK (role_id IN ('ROLE-01','ROLE-02','ROLE-03','ROLE-04','ROLE-06')),
      capability_profile varchar(32) NOT NULL CHECK (capability_profile IN ('ROLE','PRC_REVIEWER','INSTITUTION_ADMIN')),
      status varchar(16) NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
      pin_salt char(32) NOT NULL CHECK (pin_salt ~ '^[0-9a-f]{32}$'),
      pin_verifier char(128) NOT NULL CHECK (pin_verifier ~ '^[0-9a-f]{128}$'),
      failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts>=0),
      locked_until timestamptz,
      version integer NOT NULL DEFAULT 1,
      UNIQUE(operator_id,account_id,institution_id)
    );
    CREATE TABLE app.operator_attempt_windows (
      scope_digest char(64) PRIMARY KEY, attempts integer NOT NULL CHECK(attempts>=0),
      window_start timestamptz NOT NULL
    );
    CREATE TABLE app.operator_verifications (
      verification_id varchar(45) PRIMARY KEY,
      account_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      session_id varchar(45) NOT NULL REFERENCES app.application_sessions(session_id),
      operator_id varchar(52) NOT NULL REFERENCES app.institution_operators(operator_id),
      operator_version integer NOT NULL,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      action varchar(256) NOT NULL, payload_sha256 char(64) NOT NULL,
      idempotency_key varchar(64) NOT NULL, issued_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL, consumed_at timestamptz, revoked_at timestamptz,
      CHECK (expires_at>issued_at AND expires_at<=issued_at+interval '2 minutes')
    );
    CREATE TABLE app.account_audit (
      audit_id varchar(64) PRIMARY KEY, actor_id varchar(52) NOT NULL,
      actor_institution_id varchar(64), subject_id varchar(64) NOT NULL,
      action varchar(64) NOT NULL, prior_status varchar(32), resulting_status varchar(32),
      reason_code varchar(64), correlation_id varchar(64) NOT NULL,
      idempotency_key varchar(64) NOT NULL, payload_sha256 char(64) NOT NULL,
      result jsonb NOT NULL, created_at timestamptz NOT NULL,
      UNIQUE(actor_id,idempotency_key)
    );
    CREATE TABLE app.institution_account_migrations (
      migration_id varchar(64) PRIMARY KEY, target_digest char(64) NOT NULL,
      mapping_digest char(64) NOT NULL, baseline_fingerprints jsonb NOT NULL,
      status varchar(24) NOT NULL CHECK(status IN ('APPLIED','ROLLED_BACK')),
      applied_at timestamptz NOT NULL, rolled_back_at timestamptz
    );
    REVOKE ALL ON app.institution_operators,app.operator_attempt_windows,app.operator_verifications,
      app.account_audit,app.institution_account_migrations FROM PUBLIC;
    GRANT SELECT ON app.institution_operators,app.operator_attempt_windows,app.operator_verifications,
      app.account_audit,app.institution_account_migrations TO bloodledger_app;
    GRANT INSERT ON app.operator_attempt_windows,app.operator_verifications,app.account_audit TO bloodledger_app;
    GRANT UPDATE(version) ON app.institutions TO bloodledger_app;
    GRANT UPDATE(attempts,window_start) ON app.operator_attempt_windows TO bloodledger_app;
    GRANT UPDATE(failed_attempts,locked_until) ON app.institution_operators TO bloodledger_app;
    GRANT UPDATE(consumed_at,revoked_at) ON app.operator_verifications TO bloodledger_app;
  `);
};
exports.down = () => { throw new Error('Forward-only identity migration; use the reviewed account rollback command.'); };
