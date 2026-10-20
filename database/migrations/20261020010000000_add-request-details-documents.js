// PA-REQ-01..04 (Accepted 2026-10-20; SIMULATION_ONLY, SYNTHETIC_REQUEST_DETAIL_V1).
// Off-chain requester details, pickup references, notes and supporting-document metadata, keyed by the
// request's transfer ID. Rows may precede the ledger projection (a queued request), so there is no foreign
// key to app.v2_transfer_requests. Document bytes are stored outside PostgreSQL. No patient/case reference
// column exists (RQ-20). Synthetic only; real retention stays blocked by RQ-14.
exports.up = pgm => pgm.sql(`
  CREATE TABLE app.v2_request_details (
    transfer_id varchar(60) PRIMARY KEY CHECK (transfer_id ~ '^TRF_[A-Z0-9_-]{1,56}$'),
    source_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    destination_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    requesting_person varchar(80) NOT NULL,
    staff_id varchar(16) CHECK (staff_id IS NULL OR staff_id ~ '^SYN-STAFF-[0-9]{4}$'),
    attending_physician varchar(80),
    required_at timestamptz NOT NULL,
    pickup_representative varchar(80),
    pickup_authorization_reference varchar(16) CHECK (pickup_authorization_reference IS NULL OR pickup_authorization_reference ~ '^SYN-AUTH-[A-Z0-9]{6}$'),
    notes varchar(500),
    version integer NOT NULL CHECK (version >= 1),
    detail_sha256 char(64) NOT NULL,
    last_idempotency_key varchar(64) NOT NULL,
    policy_version text NOT NULL CHECK (policy_version = 'SYNTHETIC_REQUEST_DETAIL_V1'),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    classification text NOT NULL DEFAULT 'SYNTHETIC_DATA' CHECK (classification = 'SYNTHETIC_DATA'),
    CHECK (source_institution_id <> destination_institution_id)
  );
  CREATE INDEX v2_request_details_source ON app.v2_request_details(source_institution_id);
  CREATE INDEX v2_request_details_destination ON app.v2_request_details(destination_institution_id);

  CREATE TABLE app.v2_request_documents (
    document_id char(44) PRIMARY KEY CHECK (document_id ~ '^DOC_[0-9A-F]{40}$'),
    transfer_id varchar(60) NOT NULL REFERENCES app.v2_request_details(transfer_id),
    kind text NOT NULL CHECK (kind IN ('REQUEST_FORM','PICKUP_AUTHORIZATION')),
    display_name varchar(80) NOT NULL,
    content_type text NOT NULL CHECK (content_type IN ('application/pdf','image/png','image/jpeg')),
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    content_sha256 char(64) NOT NULL,
    uploaded_by varchar(64) NOT NULL,
    uploaded_at timestamptz NOT NULL,
    deleted_at timestamptz,
    classification text NOT NULL DEFAULT 'SYNTHETIC_DATA' CHECK (classification = 'SYNTHETIC_DATA')
  );
  CREATE INDEX v2_request_documents_transfer ON app.v2_request_documents(transfer_id) WHERE deleted_at IS NULL;

  GRANT SELECT, INSERT, UPDATE ON app.v2_request_details TO bloodledger_app;
  GRANT SELECT, INSERT, UPDATE ON app.v2_request_documents TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain recorded request details and document metadata'); };
