// Sliding web sessions (SYNTHETIC_WEB_ACCESS_V1). The S5-05 15-minute token stays the idle limit, but an
// active session may now be renewed by the API up to an absolute 8 hours from sign-in. Previously every
// session ended exactly 15 minutes after login, signing active users out mid-task. Logout, suspension and
// revocation are unchanged; the runtime role may move only expires_at, never issued_at or the binding.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.application_sessions DROP CONSTRAINT application_sessions_expiry;
  ALTER TABLE app.application_sessions ADD CONSTRAINT application_sessions_expiry
    CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '8 hours');
  GRANT UPDATE (expires_at) ON app.application_sessions TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain issued session expiry evidence'); };
