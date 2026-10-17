// ADR-047 amendment (J2) OUTBOUND_LABEL_VERIFICATION_V2: the outbound evidence table also records V2
// verifications, which match each scanned Donation No. together with its OCR-read component. This only
// widens the policy check; V1 rows, columns and every other constraint are unchanged.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_outbound_verifications
    DROP CONSTRAINT v2_outbound_policy,
    ADD CONSTRAINT v2_outbound_policy CHECK (policy_version IN ('OUTBOUND_LABEL_VERIFICATION_V1', 'OUTBOUND_LABEL_VERIFICATION_V2'));
`);
exports.down = () => { throw new Error('Retain outbound preparation evidence'); };
