import assert from "node:assert/strict";
import { Pool } from "pg";
import { ApiFailure } from "../build/src/errors.js";
import { PostgresCensusStore } from "../build/src/census-worker.js";
import { PostgresV2ProjectionReader, PostgresV2Projector } from "../build/src/database-v2.js";
import { PostgresV2CommandStore } from "../build/src/v2-command.js";

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_APP_USER,
  password: process.env.POSTGRES_APP_PASSWORD,
});
const commands = new PostgresV2CommandStore(pool);
const projector = new PostgresV2Projector(pool);
const projections = new PostgresV2ProjectionReader(pool);
const acceptedAt = "2026-09-19T06:00:00.000Z";

async function commit(input, transactionId) {
  const { command, replayed } = await commands.enqueue(input);
  assert.equal(replayed, false);
  await commands.markLedgerCommitted(command.commandId, transactionId, new Date(acceptedAt), { accepted: true });
  const pending = await commands.get(command.commandId, input.actorInstitutionId, input.actorUserId);
  assert.equal(pending?.status, "LEDGER_COMMITTED_PROJECTION_PENDING");
  await projector.project(pending, { transactionId, result: { accepted: true } });
  await commands.markCommitted(command.commandId, new Date(acceptedAt));
  return commands.get(command.commandId, input.actorInstitutionId, input.actorUserId);
}

try {
  const registration = {
    commandId: "CMD_S6_INTEGRATION_REGISTER",
    idempotencyKey: "IDEM_S6_INTEGRATION_REGISTER",
    resourceType: "COMPONENT",
    resourceId: "COMP_S6_INTEGRATION_001",
    operation: "REGISTER_COMPONENT",
    payload: {
      componentId: "COMP_S6_INTEGRATION_001",
      donationId: "DON_S6_INTEGRATION_001",
      issuerInstitutionId: "INST_MEDIATRIX",
      custodyInstitutionId: "INST_MEDIATRIX",
      donationNoCiphertext: "synthetic-ciphertext",
      donationNoNonce: "synthetic-nonce-0001",
      donationNoAuthTag: "synthetic-auth-tag-0001",
      donationNoEncryptionKeyVersion: "SYNTH_KEY_V1",
      donationNoLookupHmac: "a".repeat(64),
      componentType: "CRYOPRECIPITATE",
      bloodType: "O_POSITIVE",
      collectedAt: "2026-09-18T00:00:00.000Z",
      expiresAt: "2026-09-25T00:00:00.000Z",
      policyVersion: "INTERVIEW_DERIVED_CORE_V2_1",
    },
    correlationId: `CORR_${"1".repeat(32)}`,
    actorUserId: "USR_MEDIATRIX_ADMIN",
    actorInstitutionId: "INST_MEDIATRIX",
    acceptedAt,
  };
  const registered = await commit(registration, "TX_S6_INTEGRATION_REGISTER");
  assert.equal(registered?.status, "COMMITTED");
  await commands.markInboundCapture("CMD_NON_INBOUND_TYPE_PROBE", "QUEUED", "PROJECTION_RECONCILIATION_FAILED", new Date(acceptedAt));

  const transfer = {
    commandId: "CMD_S6_INTEGRATION_TRANSFER",
    idempotencyKey: "IDEM_S6_INTEGRATION_TRANSFER",
    resourceType: "TRANSFER",
    resourceId: "TRF_S6_INTEGRATION_001",
    operation: "SUBMIT_TRANSFER",
    payload: {
      transferId: "TRF_S6_INTEGRATION_001",
      sourceInstitutionId: "INST_MEDIATRIX",
      destinationInstitutionId: "INST_DIVINE_LOVE",
      bloodType: "O_POSITIVE",
      componentType: "CRYOPRECIPITATE",
      quantity: 1,
      urgency: "ROUTINE",
      requestTime: acceptedAt,
    },
    correlationId: `CORR_${"2".repeat(32)}`,
    actorUserId: "USR_DIVINE_LOVE",
    actorInstitutionId: "INST_DIVINE_LOVE",
    acceptedAt,
  };
  await commit(transfer, "TX_S6_INTEGRATION_TRANSFER");

  const reservation = {
    commandId: "CMD_S6_INTEGRATION_RESERVE",
    idempotencyKey: "IDEM_S6_RSV_DB_1",
    resourceType: "TRANSFER",
    resourceId: "TRF_S6_INTEGRATION_001",
    operation: "RESERVE_COMPONENTS",
    payload: {
      reservationId: "RES_S6_INTEGRATION_001",
      transferId: "TRF_S6_INTEGRATION_001",
      purpose: "TRANSFER",
      selectedComponentIds: ["COMP_S6_INTEGRATION_001"],
      expectedComponentVersions: [1],
    },
    correlationId: `CORR_${"3".repeat(32)}`,
    actorUserId: "USR_MEDIATRIX_ADMIN",
    actorInstitutionId: "INST_MEDIATRIX",
    acceptedAt,
  };
  await commit(reservation, "TX_S6_INTEGRATION_RESERVE");

  const sourceList = await projections.listReservations("INST_MEDIATRIX", "ROLE-02", 50);
  assert.equal(sourceList.reservations.length, 1);
  assert.equal(sourceList.reservations[0].components[0].componentType, "CRYOPRECIPITATE");
  const destinationRead = await projections.getReservation("RES_S6_INTEGRATION_001", "INST_DIVINE_LOVE", "ROLE-03");
  assert.equal(destinationRead?.destinationInstitutionId, "INST_DIVINE_LOVE");
  assert.equal(await projections.getReservation("RES_S6_INTEGRATION_001", "INST_OTHER", "ROLE-03"), null);

  const prepare = {
    ...reservation,
    commandId: "CMD_S6_INTEGRATION_PREPARE",
    idempotencyKey: "IDEM_S6_INTEGRATION_PREPARE",
    resourceId: "RES_S6_INTEGRATION_001",
    operation: "PREPARE_RESERVATION",
    payload: { reservationId: "RES_S6_INTEGRATION_001", expectedVersion: 1, preparedAt: acceptedAt, preparedEvidenceDigest: "c".repeat(64), preparedEvidenceId: "EVD_S6_COMPROMISE_PREP" },
  };
  await commit(prepare, "TX_S6_INTEGRATION_PREPARE");
  const dispatch = { ...prepare, commandId: "CMD_S6_INTEGRATION_DISPATCH", idempotencyKey: "IDEM_S6_INTEGRATION_DISPATCH", operation: "DISPATCH_RESERVATION", payload: { reservationId: "RES_S6_INTEGRATION_001", expectedVersion: 2 } };
  await commit(dispatch, "TX_S6_INTEGRATION_DISPATCH");
  const compromise = { ...prepare, commandId: "CMD_S6_INTEGRATION_COMPROMISE", idempotencyKey: "IDEM_S6_INTEGRATION_COMPROMISE", operation: "COMPROMISE_RESERVATION", payload: { reservationId: "RES_S6_INTEGRATION_001", expectedVersion: 3, reasonCode: "TEMPERATURE_EXCURSION_REPORTED" } };
  const compromised = await commit(compromise, "TX_S6_INTEGRATION_COMPROMISE");
  assert.equal(compromised?.status, "COMMITTED");
  const heldComponent = await projections.getComponent("COMP_S6_INTEGRATION_001", "INST_MEDIATRIX", "ROLE-02");
  assert.equal(heldComponent?.inventoryStatus, "COMPROMISED");
  assert.equal((await projections.getReservation("RES_S6_INTEGRATION_001", "INST_MEDIATRIX", "ROLE-02"))?.status, "COMPROMISED");
  const beforeReplay = await pool.query("SELECT ledger_version FROM app.v2_components WHERE component_id='COMP_S6_INTEGRATION_001'");
  assert.equal(beforeReplay.rows[0]?.ledger_version, 4);
  await projector.project(compromised, { transactionId: "TX_S6_INTEGRATION_COMPROMISE", result: { accepted: true } });
  const afterReplay = await pool.query("SELECT ledger_version FROM app.v2_components WHERE component_id='COMP_S6_INTEGRATION_001'");
  assert.equal(afterReplay.rows[0]?.ledger_version, 4);

  const lookup = await commands.list("INST_MEDIATRIX", "USR_MEDIATRIX_ADMIN", 50, undefined, "IDEM_S6_RSV_DB_1");
  assert.deepEqual(lookup.commands.map((command) => command.commandId), ["CMD_S6_INTEGRATION_RESERVE"]);
  assert.equal(await commands.get("CMD_S6_INTEGRATION_RESERVE", "INST_MEDIATRIX", "USR_DIVINE_LOVE"), null);
  await assert.rejects(
    commands.enqueue({ ...reservation, commandId: "CMD_S6_SCOPE_CONFLICT", actorUserId: "USR_DIVINE_LOVE", actorInstitutionId: "INST_DIVINE_LOVE" }),
    (error) => error instanceof ApiFailure && error.code === "V2_IDEMPOTENCY_SCOPE_CONFLICT",
  );

  await pool.query(
    `INSERT INTO app.v2_census_snapshots(snapshot_id,institution_id,scheduled_for,captured_at,timezone,report_policy_version,trigger_type,classification,source_projection_digest)
     VALUES('CENSUS_S6_DISCOVERY_001','INST_MEDIATRIX',$1,$1,'Asia/Manila','INTERVIEW_DOH_CENSUS_V2','MANUAL','SIMULATION_ONLY',$2)`,
    [acceptedAt, "b".repeat(64)],
  );
  const census = new PostgresCensusStore(pool, "INTERVIEW_DOH_CENSUS_V2");
  const institutionSnapshots = await census.list("INST_MEDIATRIX", 50);
  assert.equal(institutionSnapshots.snapshots.length, 1);
  assert.equal(institutionSnapshots.exportAvailable, false);
  assert.equal((await census.list("INST_DIVINE_LOVE", 50)).snapshots.length, 0);

  const privacy = await pool.query(
    `SELECT payload::text AS payload, ledger_result::text AS result
       FROM app.v2_commands
      WHERE command_id IN ('CMD_S6_INTEGRATION_TRANSFER','CMD_S6_INTEGRATION_RESERVE')
      ORDER BY command_id`,
  );
  assert.equal(privacy.rows.some((row) => /donationNo|ciphertext|ocr/i.test(`${row.payload}${row.result}`)), false);
  console.log("Sprint 6 PostgreSQL reservation, compromise quarantine, recovery, census-discovery, V2.1, scope, replay, and privacy probes passed");
} finally {
  await pool.end();
}
