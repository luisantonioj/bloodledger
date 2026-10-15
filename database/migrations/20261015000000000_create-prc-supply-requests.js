// PA-DEF-06 / ADR-044 SYNTHETIC_PRC_SUPPLY_V1: off-chain PRC supply coordination records.
// They never change inventory; actions are audited in app.account_audit.
exports.up = pgm => pgm.sql(`
  CREATE TABLE app.prc_supply_requests (
    request_id varchar(64) PRIMARY KEY,
    requesting_institution_id varchar(64) NOT NULL REFERENCES app.institutions(institution_id),
    blood_type varchar(32) NOT NULL,
    component_type varchar(32) NOT NULL,
    requested_quantity integer NOT NULL,
    urgency varchar(16) NOT NULL,
    required_by timestamptz NOT NULL,
    status varchar(16) NOT NULL,
    prc_reference varchar(32),
    fulfilled_quantity integer,
    decline_reason varchar(32),
    submitted_by varchar(52) NOT NULL REFERENCES app.application_users(user_id),
    submitted_at timestamptz NOT NULL,
    acknowledged_by varchar(52) REFERENCES app.application_users(user_id),
    acknowledged_at timestamptz,
    closed_by varchar(52) REFERENCES app.application_users(user_id),
    closed_at timestamptz,
    correlation_id varchar(42) NOT NULL,
    version integer NOT NULL DEFAULT 1,
    policy_version varchar(32) NOT NULL,
    classification varchar(32) NOT NULL,
    CONSTRAINT prc_supply_id CHECK (request_id ~ '^PRCSR_[A-Z0-9]{40}$'),
    CONSTRAINT prc_supply_blood CHECK (blood_type IN ('A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE')),
    CONSTRAINT prc_supply_component CHECK (component_type IN ('WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE')),
    CONSTRAINT prc_supply_quantity CHECK (requested_quantity BETWEEN 1 AND 10),
    CONSTRAINT prc_supply_urgency CHECK (urgency IN ('ROUTINE','URGENT','CRITICAL')),
    CONSTRAINT prc_supply_status CHECK (status IN ('SUBMITTED','ACKNOWLEDGED','FULFILLED','DECLINED','CANCELLED')),
    CONSTRAINT prc_supply_reference CHECK (prc_reference IS NULL OR prc_reference ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
    CONSTRAINT prc_supply_fulfilled CHECK (fulfilled_quantity IS NULL OR fulfilled_quantity BETWEEN 1 AND requested_quantity),
    CONSTRAINT prc_supply_decline CHECK (decline_reason IS NULL OR decline_reason IN ('NO_STOCK','OUT_OF_SCOPE','DUPLICATE_REQUEST','DEADLINE_NOT_FEASIBLE')),
    CONSTRAINT prc_supply_window CHECK (required_by > submitted_at),
    CONSTRAINT prc_supply_acknowledgement CHECK ((prc_reference IS NULL) = (acknowledged_at IS NULL) AND (acknowledged_at IS NULL) = (acknowledged_by IS NULL)),
    CONSTRAINT prc_supply_closure CHECK ((closed_at IS NULL) = (closed_by IS NULL) AND (closed_at IS NULL) = (status IN ('SUBMITTED','ACKNOWLEDGED'))),
    CONSTRAINT prc_supply_lifecycle CHECK (
      (status = 'SUBMITTED' AND prc_reference IS NULL AND fulfilled_quantity IS NULL AND decline_reason IS NULL) OR
      (status = 'ACKNOWLEDGED' AND prc_reference IS NOT NULL AND fulfilled_quantity IS NULL AND decline_reason IS NULL) OR
      (status = 'FULFILLED' AND prc_reference IS NOT NULL AND fulfilled_quantity IS NOT NULL AND decline_reason IS NULL) OR
      (status = 'DECLINED' AND fulfilled_quantity IS NULL AND decline_reason IS NOT NULL) OR
      (status = 'CANCELLED' AND prc_reference IS NULL AND fulfilled_quantity IS NULL AND decline_reason IS NULL)),
    CONSTRAINT prc_supply_correlation CHECK (correlation_id ~ '^CORR_[0-9A-F]{32}$'),
    CONSTRAINT prc_supply_version CHECK (version >= 1),
    CONSTRAINT prc_supply_policy CHECK (policy_version = 'SYNTHETIC_PRC_SUPPLY_V1'),
    CONSTRAINT prc_supply_classification CHECK (classification = 'SIMULATION_ONLY')
  );
  CREATE UNIQUE INDEX prc_supply_reference_unique ON app.prc_supply_requests(prc_reference) WHERE prc_reference IS NOT NULL;
  CREATE INDEX prc_supply_institution_order ON app.prc_supply_requests(requesting_institution_id, submitted_at DESC, request_id DESC);
  CREATE INDEX prc_supply_order ON app.prc_supply_requests(submitted_at DESC, request_id DESC);
  REVOKE ALL ON app.prc_supply_requests FROM PUBLIC;
  GRANT SELECT, INSERT ON app.prc_supply_requests TO bloodledger_app;
  GRANT UPDATE(status,prc_reference,fulfilled_quantity,decline_reason,acknowledged_by,acknowledged_at,closed_by,closed_at,version) ON app.prc_supply_requests TO bloodledger_app;
`);
exports.down = () => { throw new Error('Retain PRC supply coordination evidence'); };
