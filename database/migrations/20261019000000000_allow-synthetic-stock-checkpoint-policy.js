// PA-DEF-07 SYNTHETIC_STOCK_CHECKPOINT_V1: census snapshots may also carry the synthetic stock-checkpoint policy
// version. This only widens the policy check to that one exact value; existing INTERVIEW_* rows, columns and every
// other constraint are unchanged.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_census_snapshots
    DROP CONSTRAINT v2_census_policy,
    ADD CONSTRAINT v2_census_policy CHECK (report_policy_version ~ '^INTERVIEW_[A-Z0-9_-]{1,54}$' OR report_policy_version = 'SYNTHETIC_STOCK_CHECKPOINT_V1');
`);
exports.down = () => { throw new Error('Retain recorded stock checkpoints'); };
