import assert from "node:assert/strict";
import { createHash, createPrivateKey, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as grpc from "@grpc/grpc-js";
import { connect, hash, signers, StatusCode } from "@hyperledger/fabric-gateway";
import { Pool } from "pg";
import { createPoolFromEnvironment } from "../build/src/database.js";
import { PostgresV2Projector } from "../build/src/database-v2.js";
import { provisionSyntheticAccount } from "../build/src/synthetic-account.js";
import { PostgresV2CommandStore } from "../build/src/v2-command.js";
import { V2CommandWorker } from "../build/src/v2-worker.js";

const phase = process.argv[2];
assert.ok(["seed", "commit", "recover"].includes(phase));
const suffix = process.env.BLOODLEDGER_COMPROMISE_RUN_SUFFIX;
assert.match(suffix ?? "", /^[A-Z0-9]{4,20}$/);
const chaincode = process.env.FABRIC_CHAINCODE;
assert.match(chaincode ?? "", /^bloodledger-inventory-s6-compromise-[a-z0-9-]+$/);
const now = new Date("2026-09-24T04:00:00.000Z");
const at = now.toISOString();
const id = (prefix, value) => `${prefix}_S6_LIVE_${suffix}_${value}`;
const transferId = id("TRF", "ONE");
const reservationId = id("RES", "ONE");
const selectedComponentId = id("COMP", "ONE");
const unrelatedComponentId = id("COMP", "TWO");
const compromiseCommandId = id("CMD", "COMPROMISE");
const reasonCode = "TEMPERATURE_EXCURSION_REPORTED";
const policyVersion = "INTERVIEW_DERIVED_CORE_V2_1";
const pool = createPoolFromEnvironment();
const store = new PostgresV2CommandStore(pool);
const projector = new PostgresV2Projector(pool);

async function gatewayContract() {
  const root = process.env.BLOODLEDGER_REPOSITORY_ROOT;
  assert.ok(root);
  const org = join(root, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
  const msp = join(org, "users/ApiGateway@mediatrix.bloodledger.local/msp");
  const keyFiles = await readdir(join(msp, "keystore"));
  const certFiles = await readdir(join(msp, "signcerts"));
  assert.equal(keyFiles.length, 1);
  assert.equal(certFiles.length, 1);
  const client = new grpc.Client("peer0-mediatrix:7051", grpc.credentials.createSsl(await readFile(join(org, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt"))), { "grpc.ssl_target_name_override": "peer0.mediatrix.bloodledger.local" });
  const gateway = connect({
    client,
    identity: { mspId: "MediatrixMSP", credentials: await readFile(join(msp, "signcerts", certFiles[0])) },
    signer: signers.newPrivateKeySigner(createPrivateKey(await readFile(join(msp, "keystore", keyFiles[0])))),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: new Date(Date.now() + 15_000) }),
    endorseOptions: () => ({ deadline: new Date(Date.now() + 30_000) }),
    submitOptions: () => ({ deadline: new Date(Date.now() + 15_000) }),
    commitStatusOptions: () => ({ deadline: new Date(Date.now() + 30_000) }),
  });
  return { client, gateway, contract: gateway.getNetwork("bloodledger-dev").getContract(chaincode, "InterviewCoreContract") };
}

function command(operation, label, resourceType, resourceId, actorUserId, actorInstitutionId, payload) {
  const correlationId = id("CORR", label);
  return {
    commandId: id("CMD", label), idempotencyKey: id("IDEM", label),
    resourceType, resourceId, operation,
    payload: { ...payload, actorUserId, eventTime: at, correlationId, policyVersion },
    correlationId, actorUserId, actorInstitutionId, acceptedAt: at,
  };
}

async function runCommitted(input, contract, transaction) {
  await store.enqueue(input);
  let submissions = 0;
  const worker = new V2CommandWorker(store, {
    submit: async (claimed) => {
      submissions++;
      const submitted = await contract.submitAsync(transaction, { arguments: [JSON.stringify({ ...claimed.payload, idempotencyKey: claimed.idempotencyKey })] });
      const status = await submitted.getStatus();
      assert.equal(status.code, StatusCode.VALID);
      assert.equal(status.successful, true);
      return { transactionId: submitted.getTransactionId(), result: JSON.parse(Buffer.from(submitted.getResult()).toString("utf8")) };
    },
    project: (claimed, committed) => projector.project(claimed, committed),
  }, `V2WORKER_S6_LIVE_${suffix}`);
  assert.deepEqual(await worker.runOnce(now), { commandId: input.commandId, status: "COMMITTED" });
  assert.equal(submissions, 1);
  const result = await store.get(input.commandId, input.actorInstitutionId, input.actorUserId);
  assert.equal(result?.status, "COMMITTED");
  assert.ok(result.ledgerTransactionId);
  return result;
}

try {
  if (phase === "seed") {
    const migrator = new Pool({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_MIGRATOR_USER, password: process.env.POSTGRES_MIGRATOR_PASSWORD });
    const password = randomBytes(24).toString("base64url");
    try {
      for (const account of [
        { institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Live Probe", institutionCategory: "HOSPITAL", userId: "USR_MEDIATRIX_ADMIN", username: `synth_mediatrix_live_${suffix.toLowerCase()}`, userDisplayName: "Synthetic Mediatrix Live Probe", roleId: "ROLE-01" },
        { institutionId: "INST_DIVINE_LOVE", institutionDisplayName: "Synthetic Divine Love Live Probe", institutionCategory: "HOSPITAL", userId: "USR_DIVINE_LOVE", username: `synth_divine_live_${suffix.toLowerCase()}`, userDisplayName: "Synthetic Divine Love Live Probe", roleId: "ROLE-03" },
      ]) await provisionSyntheticAccount(migrator, { ...account, password });
    } finally { await migrator.end(); }
    const { client, gateway, contract } = await gatewayContract();
    try {
      for (const [index, componentId] of [selectedComponentId, unrelatedComponentId].entries()) {
        const digest = createHash("sha256").update(componentId).digest("hex");
        const input = command("REGISTER_INBOUND_COMPONENT", `CAPTURE_${index}`, "INBOUND_CAPTURE", id("CAP", `${index}`), "USR_MEDIATRIX_ADMIN", "INST_MEDIATRIX", {
          captureId: id("CAP", `${index}`), componentId, donationId: id("DON", `${index}`),
          issuerInstitutionId: "INST_MEDIATRIX", custodyInstitutionId: "INST_MEDIATRIX", actorInstitutionId: "INST_MEDIATRIX",
          donationNoCiphertext: randomBytes(24).toString("base64url"), donationNoNonce: randomBytes(12).toString("base64url"), donationNoAuthTag: randomBytes(16).toString("base64url"), donationNoEncryptionKeyVersion: "SYNTH_KEY_V1", donationNoLookupHmac: digest,
          componentType: "PACKED_RED_BLOOD_CELLS", bloodType: "O_POSITIVE", collectedAt: "2026-09-23T00:00:00.000Z", expiresAt: index === 0 ? "2026-09-30T00:00:00.000Z" : "2026-10-01T00:00:00.000Z",
          captureMethod: "OCR", captureEvidenceDigest: digest, capturedAt: at, confirmedAt: at, bloodTypeEvidenceSource: "OCR_LABEL", componentEvidenceSource: "OCR_LABEL", ocrEngine: "SYNTHETIC_PROBE", ocrEngineVersion: "1", donationNumberConfidence: 1, bloodTypeConfidence: 1,
        });
        // The Fabric boundary strips encrypted reference and OCR bookkeeping.
        const { captureId, donationNoCiphertext, donationNoNonce, donationNoAuthTag, donationNoEncryptionKeyVersion, capturedAt, confirmedAt, ocrEngine, ocrEngineVersion, donationNumberConfidence, bloodTypeConfidence, donationNoLookupHmac, ...ledgerPayload } = input.payload;
        const safeInput = { ...input, payload: { ...ledgerPayload, donationNoDigest: donationNoLookupHmac } };
        await store.enqueue(input);
        const worker = new V2CommandWorker(store, {
          submit: async () => {
            const submitted = await contract.submitAsync("RegisterInboundComponent", { arguments: [JSON.stringify({ ...safeInput.payload, idempotencyKey: input.idempotencyKey })] });
            assert.equal((await submitted.getStatus()).code, StatusCode.VALID);
            return { transactionId: submitted.getTransactionId() };
          },
          project: (claimed, committed) => projector.project(claimed, committed),
        }, `V2WORKER_S6_LIVE_${suffix}`);
        assert.deepEqual(await worker.runOnce(now), { commandId: input.commandId, status: "COMMITTED" });
      }
      await runCommitted(command("SUBMIT_TRANSFER", "TRANSFER", "TRANSFER", transferId, "USR_DIVINE_LOVE", "INST_DIVINE_LOVE", { transferId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_DIVINE_LOVE", bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", quantity: 1, urgency: "ROUTINE", requestTime: at }), contract, "SubmitTransferRequest");
      await runCommitted(command("RESERVE_COMPONENTS", "RESERVE", "TRANSFER", transferId, "USR_MEDIATRIX_ADMIN", "INST_MEDIATRIX", { reservationId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_DIVINE_LOVE", purpose: "TRANSFER", selectedComponentIds: [selectedComponentId], expectedComponentVersions: [1], bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", quantity: 1 }), contract, "ReserveComponents");
      await runCommitted(command("PREPARE_RESERVATION", "PREPARE", "TRANSFER", reservationId, "USR_MEDIATRIX_ADMIN", "INST_MEDIATRIX", { reservationId, expectedVersion: 1, preparedAt: at, preparedEvidenceDigest: "c".repeat(64), preparedEvidenceId: id("EVD", "PREPARE") }), contract, "PrepareReservation");
      await runCommitted(command("DISPATCH_RESERVATION", "DISPATCH", "TRANSFER", reservationId, "USR_MEDIATRIX_ADMIN", "INST_MEDIATRIX", { reservationId, expectedVersion: 2 }), contract, "DispatchReservation");
      const unrelated = await pool.query("SELECT inventory_status,ledger_version FROM app.v2_components WHERE component_id=$1", [unrelatedComponentId]);
      assert.deepEqual(unrelated.rows[0], { inventory_status: "AVAILABLE", ledger_version: 1 });
      console.log(JSON.stringify({ phase, chaincode, reservationId, selectedComponentId, unrelatedComponentId, status: "DISPATCHED", classification: "SIMULATION_ONLY" }));
    } finally { gateway.close(); client.close(); }
  } else if (phase === "commit") {
    const { client, gateway, contract } = await gatewayContract();
    try {
      const input = command("COMPROMISE_RESERVATION", "COMPROMISE", "TRANSFER", reservationId, "USR_MEDIATRIX_ADMIN", "INST_MEDIATRIX", { reservationId, expectedVersion: 3, reasonCode });
      const evaluate = (changes, key) => contract.evaluateTransaction("MarkReservationCompromised", JSON.stringify({ ...input.payload, ...changes, idempotencyKey: id("IDEM", key) }));
      for (const [changes, key, code] of [
        [{ reasonCode: "UNSUPPORTED" }, "BAD_REASON", "COMPROMISE_REASON_INVALID"],
        [{ actorUserId: "USR_DOH_VIEWER" }, "BAD_ACTOR", "RESERVATION_NOT_AUTHORIZED"],
        [{ expectedVersion: 2 }, "STALE", "RESERVATION_VERSION_CONFLICT"],
      ]) await assert.rejects(evaluate(changes, key), (error) => String(error).includes(code));
      await store.enqueue(input);
      let submissions = 0;
      const worker = new V2CommandWorker(store, {
        submit: async (claimed) => {
          submissions++;
          const submitted = await contract.submitAsync("MarkReservationCompromised", { arguments: [JSON.stringify({ ...claimed.payload, idempotencyKey: claimed.idempotencyKey })] });
          const status = await submitted.getStatus();
          assert.equal(status.code, StatusCode.VALID);
          const result = JSON.parse(Buffer.from(submitted.getResult()).toString("utf8"));
          assert.equal(result.status, "COMPROMISED");
          assert.equal(result.compromiseReasonCode, reasonCode);
          assert.equal(result.compromisePolicyVersion, "SYNTHETIC_COMPROMISE_REASONS_V1");
          return { transactionId: submitted.getTransactionId(), result };
        },
        project: async () => { throw Object.assign(new Error("intentional projection interruption"), { code: "PROJECTION_INTERRUPTED" }); },
      }, `V2WORKER_S6_LIVE_${suffix}`);
      assert.deepEqual(await worker.runOnce(now), { commandId: compromiseCommandId, status: "RETRY_WAIT" });
      const pending = await store.get(compromiseCommandId, "INST_MEDIATRIX", "USR_MEDIATRIX_ADMIN");
      assert.equal(pending?.status, "LEDGER_COMMITTED_PROJECTION_PENDING");
      assert.equal(submissions, 1);
      assert.ok(pending.ledgerTransactionId);
      console.log(JSON.stringify({ phase, commandId: compromiseCommandId, transactionId: pending.ledgerTransactionId, submissionCount: submissions, status: pending.status, reasonCode, policyVersion: "SYNTHETIC_COMPROMISE_REASONS_V1" }));
    } finally { gateway.close(); client.close(); }
  } else {
    let submissions = 0;
    const worker = new V2CommandWorker(store, {
      submit: async () => { submissions++; throw new Error("committed command was resubmitted"); },
      project: (claimed, committed) => projector.project(claimed, committed),
    }, `V2WORKER_S6_RECOVER_${suffix}`);
    assert.deepEqual(await worker.runOnce(new Date(now.getTime() + 10_000)), { commandId: compromiseCommandId, status: "COMMITTED" });
    assert.equal(submissions, 0);
    const committed = await store.get(compromiseCommandId, "INST_MEDIATRIX", "USR_MEDIATRIX_ADMIN");
    assert.equal(committed?.status, "COMMITTED");
    assert.equal(committed?.ledgerResult?.compromiseReasonCode, reasonCode);
    assert.equal(committed?.ledgerResult?.compromisePolicyVersion, "SYNTHETIC_COMPROMISE_REASONS_V1");
    const selected = await pool.query("SELECT inventory_status,ledger_version FROM app.v2_components WHERE component_id=$1", [selectedComponentId]);
    const unrelated = await pool.query("SELECT inventory_status,ledger_version FROM app.v2_components WHERE component_id=$1", [unrelatedComponentId]);
    const reservation = await pool.query("SELECT status,version FROM app.v2_reservations WHERE reservation_id=$1", [reservationId]);
    assert.deepEqual(selected.rows[0], { inventory_status: "COMPROMISED", ledger_version: 4 });
    assert.deepEqual(unrelated.rows[0], { inventory_status: "AVAILABLE", ledger_version: 1 });
    assert.deepEqual(reservation.rows[0], { status: "COMPROMISED", version: 4 });
    await projector.project(committed, { transactionId: committed.ledgerTransactionId, result: committed.ledgerResult });
    assert.equal((await pool.query("SELECT ledger_version FROM app.v2_components WHERE component_id=$1", [selectedComponentId])).rows[0].ledger_version, 4);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM app.v2_projection_receipts WHERE command_id=$1", [compromiseCommandId])).rows[0].count, 1);
    const { client, gateway, contract } = await gatewayContract();
    try {
      const original = await store.get(compromiseCommandId, "INST_MEDIATRIX", "USR_MEDIATRIX_ADMIN");
      const replay = JSON.parse(Buffer.from(await contract.evaluateTransaction("MarkReservationCompromised", JSON.stringify({ ...original.payload, idempotencyKey: original.idempotencyKey }))).toString("utf8"));
      assert.equal(replay.status, "COMPROMISED");
      assert.equal(replay.version, 4);
      const component = JSON.parse(Buffer.from(await contract.evaluateTransaction("ReadComponent", JSON.stringify({ actorUserId: "USR_MEDIATRIX_ADMIN", componentId: selectedComponentId }))).toString("utf8"));
      assert.equal(component.status, "COMPROMISED");
      await assert.rejects(contract.evaluateTransaction("MarkReservationCompromised", JSON.stringify({ ...original.payload, expectedVersion: 4, idempotencyKey: id("IDEM", "INVALID_TRANSITION") })), (error) => String(error).includes("RESERVATION_TRANSITION_INVALID"));
    } finally { gateway.close(); client.close(); }
    console.log(JSON.stringify({ phase, commandId: compromiseCommandId, transactionId: committed.ledgerTransactionId, submissionCount: submissions, projectionRows: 1, selectedStatus: "COMPROMISED", unrelatedStatus: "AVAILABLE", version: 4, classification: "SIMULATION_ONLY" }));
  }
} finally { await pool.end(); }
