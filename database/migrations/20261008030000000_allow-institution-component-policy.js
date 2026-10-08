exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE app.v2_components DROP CONSTRAINT v2_components_policy;
    ALTER TABLE app.v2_components ADD CONSTRAINT v2_components_policy CHECK(policy_version IN ('INTERVIEW_DERIVED_CORE_V2','INTERVIEW_DERIVED_CORE_V2_1','PERSISTENT_DEVELOPMENT_CORE_V1','SYNTHETIC_INSTITUTION_CORE_V1'));`);
};
exports.down = () => { throw new Error('Preserve accepted institution-policy components; forward-only.'); };
