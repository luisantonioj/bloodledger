// PA-OCR-03 INBOUND_OCR_CORRECTED_V1 (RQ-19, simulation only): an OCR intake may carry operator corrections.
// INBOUND_OCR_V1 rows and rules are unchanged. A corrected capture keeps no confidence for a corrected field, and
// each field's provenance (OCR read digest and score, correction reason, final value digest) is recorded once in
// an insert-only table. Raw OCR text and Donation No. values are never stored.
exports.up = pgm => pgm.sql(`
  ALTER TABLE app.v2_inbound_captures
    DROP CONSTRAINT v2_inbound_capture_policy,
    ADD CONSTRAINT v2_inbound_capture_policy CHECK (capture_policy_version IN ('INBOUND_OCR_V1','INBOUND_OCR_CORRECTED_V1')),
    -- NOT NULL moves into the policy check: a V1 row still needs both confidences (guarded against NULL below).
    ALTER COLUMN donation_number_confidence DROP NOT NULL,
    ALTER COLUMN blood_type_confidence DROP NOT NULL,
    DROP CONSTRAINT v2_inbound_capture_confidence,
    ADD CONSTRAINT v2_inbound_capture_confidence CHECK (
      (capture_policy_version = 'INBOUND_OCR_V1' AND donation_number_confidence IS NOT NULL AND blood_type_confidence IS NOT NULL
        AND donation_number_confidence BETWEEN 90 AND 100 AND blood_type_confidence BETWEEN 90 AND 100)
      OR (capture_policy_version = 'INBOUND_OCR_CORRECTED_V1'
        AND (donation_number_confidence IS NULL OR donation_number_confidence BETWEEN 90 AND 100)
        AND (blood_type_confidence IS NULL OR blood_type_confidence BETWEEN 90 AND 100))
    );

  CREATE TABLE app.v2_capture_field_provenance (
    capture_id varchar(64) NOT NULL REFERENCES app.v2_inbound_captures(capture_id),
    field_name varchar(24) NOT NULL,
    source varchar(24) NOT NULL,
    ocr_value_digest char(64),
    ocr_confidence smallint,
    correction_reason varchar(24),
    final_value_digest char(64) NOT NULL,
    recorded_at timestamptz NOT NULL,
    classification varchar(32) NOT NULL,
    PRIMARY KEY (capture_id, field_name),
    CONSTRAINT v2_capture_field_name CHECK (field_name IN ('donationNumber','bloodType','componentType','collectedAt','expiresAt')),
    CONSTRAINT v2_capture_field_source CHECK (source IN ('OCR_LABEL','OPERATOR_CORRECTED')),
    CONSTRAINT v2_capture_field_digests CHECK ((ocr_value_digest IS NULL OR ocr_value_digest ~ '^[0-9a-f]{64}$') AND final_value_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT v2_capture_field_confidence CHECK (ocr_confidence IS NULL OR ocr_confidence BETWEEN 0 AND 100),
    -- Every operand is NOT NULL-guarded: a NULL comparison is unknown, which a CHECK would otherwise accept.
    CONSTRAINT v2_capture_field_rule CHECK (
      (source = 'OCR_LABEL' AND correction_reason IS NULL AND ocr_confidence IS NOT NULL AND ocr_confidence BETWEEN 90 AND 100
        AND ocr_value_digest IS NOT NULL AND ocr_value_digest = final_value_digest)
      OR (source = 'OPERATOR_CORRECTED' AND correction_reason IS NOT NULL AND correction_reason IN ('OCR_MISREAD','OCR_NOT_READ','OCR_LOW_CONFIDENCE'))
    ),
    CONSTRAINT v2_capture_field_classification CHECK (classification = 'SIMULATION_ONLY')
  );
  CREATE FUNCTION app.v2_reject_capture_provenance_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'V2_CAPTURE_PROVENANCE_IMMUTABLE';
  END;
  $$;
  CREATE TRIGGER v2_capture_field_provenance_immutable
    BEFORE UPDATE OR DELETE ON app.v2_capture_field_provenance
    FOR EACH ROW EXECUTE FUNCTION app.v2_reject_capture_provenance_mutation();
  REVOKE ALL ON app.v2_capture_field_provenance FROM PUBLIC;
  GRANT SELECT, INSERT ON app.v2_capture_field_provenance TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain capture provenance'); };
