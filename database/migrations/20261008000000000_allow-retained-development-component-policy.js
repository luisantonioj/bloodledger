// FR-01 / FR-12: project components accepted under Jopia's approved retained-actor policy.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_components DROP CONSTRAINT v2_components_policy;
    ALTER TABLE app.v2_components ADD CONSTRAINT v2_components_policy
      CHECK (policy_version IN ('INTERVIEW_DERIVED_CORE_V2', 'INTERVIEW_DERIVED_CORE_V2_1', 'PERSISTENT_DEVELOPMENT_CORE_V1'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE app.v2_components DROP CONSTRAINT v2_components_policy;
    ALTER TABLE app.v2_components ADD CONSTRAINT v2_components_policy
      CHECK (policy_version IN ('INTERVIEW_DERIVED_CORE_V2', 'INTERVIEW_DERIVED_CORE_V2_1'));
  `);
};
