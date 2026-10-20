// PA-OCR-04 / ADR-051: operator-reviewed intake after an OCR attempt, including all-field corrections.
// V1 and corrected V1 semantics remain unchanged. Provenance remains insert-only; no data is rewritten.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_inbound_captures
    DROP CONSTRAINT v2_inbound_capture_policy,
    ADD CONSTRAINT v2_inbound_capture_policy CHECK (capture_policy_version IN ('INBOUND_OCR_V1','INBOUND_OCR_CORRECTED_V1','INBOUND_OCR_CORRECTED_V2')),
    DROP CONSTRAINT v2_inbound_capture_confidence,
    ADD CONSTRAINT v2_inbound_capture_confidence CHECK (
      (capture_policy_version = 'INBOUND_OCR_V1' AND donation_number_confidence IS NOT NULL AND blood_type_confidence IS NOT NULL
        AND donation_number_confidence BETWEEN 90 AND 100 AND blood_type_confidence BETWEEN 90 AND 100)
      OR (capture_policy_version IN ('INBOUND_OCR_CORRECTED_V1','INBOUND_OCR_CORRECTED_V2')
        AND (donation_number_confidence IS NULL OR donation_number_confidence BETWEEN 90 AND 100)
        AND (blood_type_confidence IS NULL OR blood_type_confidence BETWEEN 90 AND 100))
    );
`);
exports.down = () => { throw new Error('Retain reviewed intake provenance'); };
