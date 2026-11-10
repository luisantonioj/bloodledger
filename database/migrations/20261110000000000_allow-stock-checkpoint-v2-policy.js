// SYNTHETIC_STOCK_CHECKPOINT_V2: the scheduled stock checkpoint also records cryoprecipitate.
// This only widens the policy check to one more exact value; existing V1 and INTERVIEW_* rows,
// columns and every other constraint are unchanged.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_census_snapshots
    DROP CONSTRAINT v2_census_policy,
    ADD CONSTRAINT v2_census_policy CHECK (report_policy_version ~ '^INTERVIEW_[A-Z0-9_-]{1,54}$' OR report_policy_version IN ('SYNTHETIC_STOCK_CHECKPOINT_V1', 'SYNTHETIC_STOCK_CHECKPOINT_V2'));
`);
exports.down = () => { throw new Error('Retain recorded stock checkpoints'); };
