exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app.institutions (
      institution_id varchar(64) PRIMARY KEY,
      display_name varchar(96) NOT NULL,
      category varchar(24) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      classification varchar(32) NOT NULL DEFAULT 'SIMULATION_ONLY',
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT institutions_id_format CHECK (institution_id ~ '^INST_[A-Z0-9_-]{1,59}$'),
      CONSTRAINT institutions_name_safe CHECK (display_name ~ '^Synthetic [A-Za-z0-9 -]{1,86}$'),
      CONSTRAINT institutions_category CHECK (category IN ('HOSPITAL', 'REGULATOR', 'SYSTEM')),
      CONSTRAINT institutions_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
      CONSTRAINT institutions_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.application_users (
      user_id varchar(52) PRIMARY KEY,
      username varchar(64) NOT NULL UNIQUE,
      display_name varchar(96) NOT NULL,
      institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
      password_algorithm varchar(24) NOT NULL,
      password_salt char(32) NOT NULL,
      password_verifier char(128) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      classification varchar(32) NOT NULL DEFAULT 'SIMULATION_ONLY',
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT application_users_id_format CHECK (user_id ~ '^USR_[A-Z0-9_-]{1,48}$'),
      CONSTRAINT application_users_username CHECK (username ~ '^synth_[a-z0-9_]{3,57}$'),
      CONSTRAINT application_users_name_safe CHECK (display_name ~ '^Synthetic [A-Za-z0-9 -]{1,86}$'),
      CONSTRAINT application_users_algorithm CHECK (password_algorithm = 'SCRYPT_V1'),
      CONSTRAINT application_users_salt CHECK (password_salt ~ '^[0-9a-f]{32}$'),
      CONSTRAINT application_users_verifier CHECK (password_verifier ~ '^[0-9a-f]{128}$'),
      CONSTRAINT application_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
      CONSTRAINT application_users_classification CHECK (classification = 'SIMULATION_ONLY')
    );

    CREATE TABLE app.user_role_assignments (
      user_id varchar(52) PRIMARY KEY REFERENCES app.application_users(user_id),
      role_id varchar(16) NOT NULL,
      policy_version varchar(64) NOT NULL,
      assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT user_role_assignments_role CHECK (role_id IN ('ROLE-01', 'ROLE-02', 'ROLE-03', 'ROLE-04', 'ROLE-05', 'ROLE-06')),
      CONSTRAINT user_role_assignments_policy CHECK (policy_version = 'SYNTHETIC_WEB_ACCESS_V1')
    );

    CREATE TABLE app.application_sessions (
      session_id varchar(45) PRIMARY KEY,
      user_id varchar(52) NOT NULL REFERENCES app.application_users(user_id),
      token_digest char(64) NOT NULL UNIQUE,
      policy_version varchar(64) NOT NULL,
      issued_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      safe_revocation_reason varchar(48),
      CONSTRAINT application_sessions_id_format CHECK (session_id ~ '^SESS_[0-9A-F]{40}$'),
      CONSTRAINT application_sessions_digest CHECK (token_digest ~ '^[0-9a-f]{64}$'),
      CONSTRAINT application_sessions_policy CHECK (policy_version = 'SYNTHETIC_WEB_ACCESS_V1'),
      CONSTRAINT application_sessions_expiry CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '15 minutes'),
      CONSTRAINT application_sessions_revocation CHECK ((revoked_at IS NULL AND safe_revocation_reason IS NULL) OR (revoked_at IS NOT NULL AND safe_revocation_reason IN ('USER_LOGOUT', 'USER_SUSPENDED', 'SESSION_REPLACED', 'SECURITY_REVOCATION')))
    );
    CREATE INDEX application_sessions_active_idx ON app.application_sessions (user_id, expires_at) WHERE revoked_at IS NULL;

    REVOKE ALL ON app.institutions, app.application_users, app.user_role_assignments, app.application_sessions FROM PUBLIC;
    GRANT SELECT ON app.institutions TO bloodledger_app;
    GRANT SELECT ON app.application_users TO bloodledger_app;
    GRANT SELECT ON app.user_role_assignments TO bloodledger_app;
    GRANT SELECT, INSERT ON app.application_sessions TO bloodledger_app;
    GRANT UPDATE (revoked_at, safe_revocation_reason) ON app.application_sessions TO bloodledger_app;
  `);
};

exports.down = false;
