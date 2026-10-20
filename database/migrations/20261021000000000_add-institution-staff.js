// PA-STAFF-01: institution-scoped staff metadata and short-lived PIN-reset approvals.
exports.up=pgm=>pgm.sql(`
 ALTER TABLE app.institution_operators ADD COLUMN job_title varchar(80);
 ALTER TABLE app.institution_operators ADD CONSTRAINT staff_job_title_nonblank CHECK(job_title IS NULL OR length(btrim(job_title)) BETWEEN 1 AND 80);
 GRANT UPDATE(job_title) ON app.institution_operators TO bloodledger_app;
 CREATE TABLE app.staff_pin_reset_approvals (
  approval_id varchar(48) PRIMARY KEY, actor_id varchar(64) NOT NULL REFERENCES app.application_users(user_id),
  account_id varchar(64) NOT NULL REFERENCES app.application_users(user_id), institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
  session_id varchar(64) NOT NULL, operator_version integer NOT NULL, subject_id varchar(64) NOT NULL REFERENCES app.institution_operators(operator_id),
  subject_version integer NOT NULL, request_sha256 char(64) NOT NULL, expires_at timestamptz NOT NULL, consumed_key varchar(64), consumed_sha256 char(64)
 );
 GRANT SELECT,INSERT ON app.staff_pin_reset_approvals TO bloodledger_app;
 GRANT UPDATE(consumed_key,consumed_sha256) ON app.staff_pin_reset_approvals TO bloodledger_app;
`);
exports.down=()=>{throw new Error('Retained staff history must not be rolled back automatically');};
