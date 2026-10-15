import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { encryptDonationNumber, type DonationKeyring } from "../src/donation-crypto.js";
import type { SealedDonationNumber } from "../src/label-identity.js";
import { assembleUnitHistory, decodeHistoryCursor, encodeHistoryCursor, type HistoryCommandRecord, type HistoryComponentRecord, type UnitHistoryEvidence } from "../src/unit-history.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// Synthetic fixtures only; labels follow the synthetic Mediatrix MMYY-MM-NNNN format.
const keyring: DonationKeyring = { encryptionKey: Buffer.alloc(32, 3), lookupKey: Buffer.alloc(32, 4), encryptionKeyVersion: "v1" };
const HOME = "INST_MEDIATRIX";
const OTHER = "INST_SYNTH_SECONDARY_01";

function seal(value: string, captureMethod: string | null = "OCR"): SealedDonationNumber {
  const { ciphertext, nonce, authTag, encryptionKeyVersion } = encryptDonationNumber(value, keyring);
  return { ciphertext, nonce, authTag, encryptionKeyVersion, captureMethod };
}

function command(overrides: Partial<HistoryCommandRecord> & Pick<HistoryCommandRecord, "commandId" | "operation">): HistoryCommandRecord {
  return { status: "COMMITTED", acceptedAt: "2026-10-15T01:00:00.000Z", ledgerCommittedAt: "2026-10-15T01:00:02.000Z", ledgerTransactionId: `tx-${overrides.commandId.toLowerCase()}`, blockNumber: "41", validationStatus: "VALID", safeErrorCode: null, eventTime: "2026-10-15T00:59:58.000Z", componentId: null, captureId: null, captureMethod: null, reservationId: null, bloodType: null, componentType: null, ...overrides };
}

function unit(componentId: string, institutionId: string, componentType: string, label: string | null, captureMethod: string | null = "OCR"): HistoryComponentRecord {
  return { componentId, bloodType: "O_POSITIVE", componentType, institutionId, sealed: label ? seal(label, captureMethod) : null };
}

function evidence(commands: HistoryCommandRecord[], partial: Partial<UnitHistoryEvidence> = {}): UnitHistoryEvidence {
  return { commands, members: new Map(), reservations: new Map(), components: new Map(), hasMore: false, ...partial };
}

test("UNIT_HISTORY_READ_V1 maps a committed OCR registration to one inbound scanned row", () => {
  const registration = command({ commandId: "CMD_REG", operation: "REGISTER_INBOUND_COMPONENT", componentId: "COMP_A", captureId: "INCAP_A", captureMethod: "OCR", bloodType: "O_POSITIVE", componentType: "PLATELETS" });
  const result = assembleUnitHistory(HOME, evidence([registration], { components: new Map([["COMP_A", unit("COMP_A", HOME, "PLATELETS", "MM26-08-4064")]]) }), keyring);
  assert.equal(result.rows.length, 1);
  const [row] = result.rows;
  assert.equal(row.rowId, "CMD_REG:COMP_A");
  assert.equal(row.eventType, "INBOUND_REGISTERED");
  assert.equal(row.direction, "INBOUND");
  assert.equal(row.scanId, "INCAP_A");
  assert.equal(row.transactionId, "CMD_REG");
  assert.equal(row.method, "OCR");
  assert.equal(row.labelIdentity.value, "MM26-08-4064");
  assert.equal(row.bloodType, "O_POSITIVE");
  assert.equal(row.unitAttributesSource, "LEDGER_PROJECTION");
  assert.equal(row.eventStatus, "CONFIRMED");
  assert.deepEqual(row.ledger, { status: "COMMITTED", transactionId: "tx-cmd_reg", committedAt: "2026-10-15T01:00:02.000Z", blockNumber: "41", validationStatus: "VALID" });
  assert.equal(result.policyVersion, "UNIT_HISTORY_READ_V1");
});

test("a pending registration is not shown as confirmed movement and uses its own command attributes", () => {
  const pending = command({ commandId: "CMD_PENDING", operation: "REGISTER_INBOUND_COMPONENT", status: "QUEUED", ledgerTransactionId: null, ledgerCommittedAt: null, blockNumber: null, validationStatus: null, componentId: "COMP_NEW", captureId: "INCAP_NEW", captureMethod: "OCR", bloodType: "A_NEGATIVE", componentType: "WHOLE_BLOOD" });
  const [row] = assembleUnitHistory(HOME, evidence([pending]), keyring).rows;
  assert.equal(row.eventStatus, "PENDING");
  assert.equal(row.processingStatus, "QUEUED");
  assert.equal(row.ledger.status, "NOT_COMMITTED");
  assert.equal(row.ledger.transactionId, null);
  assert.equal(row.labelIdentity.unavailableReason, "NOT_COMMITTED");
  assert.equal(row.bloodType, "A_NEGATIVE");
  assert.equal(row.unitAttributesSource, "PENDING_COMMAND");
});

test("a multi-unit dispatch expands to one row per reserved unit sharing one transaction", () => {
  const dispatch = command({ commandId: "CMD_DISPATCH", operation: "DISPATCH_RESERVATION", reservationId: "RES_T1" });
  const result = assembleUnitHistory(HOME, evidence([dispatch], {
    members: new Map([["RES_T1", ["COMP_FFP", "COMP_PRBC"]]]),
    reservations: new Map([["RES_T1", { transferId: "TRF_T1", localReleaseId: null }]]),
    // Both units now sit at the destination; the source still held them at the committed dispatch.
    components: new Map([["COMP_FFP", unit("COMP_FFP", OTHER, "FRESH_FROZEN_PLASMA", "MM26-08-4070")], ["COMP_PRBC", unit("COMP_PRBC", OTHER, "PACKED_RED_BLOOD_CELLS", "MM26-08-4070")]]),
  }), keyring);
  assert.deepEqual(result.rows.map((row) => row.rowId), ["CMD_DISPATCH:COMP_FFP", "CMD_DISPATCH:COMP_PRBC"]);
  assert.ok(result.rows.every((row) => row.transactionId === "CMD_DISPATCH" && row.direction === "OUTBOUND" && row.eventType === "TRANSFER_DISPATCHED"));
  assert.ok(result.rows.every((row) => row.method === "WEB_COMMAND" && row.scanId === null && row.links.transferId === "TRF_T1"));
  // Shared-donation units share the printed value and differ by component.
  assert.deepEqual(result.rows.map((row) => [row.labelIdentity.value, row.componentType]), [["MM26-08-4070", "FRESH_FROZEN_PLASMA"], ["MM26-08-4070", "PACKED_RED_BLOOD_CELLS"]]);
});

test("receipt, projection-pending and failed states stay distinct", () => {
  const members = new Map([["RES_T2", ["COMP_B"]], ["RES_T3", ["COMP_C"]]]);
  const components = new Map([["COMP_B", unit("COMP_B", HOME, "PLATELETS", "MM26-09-0007")], ["COMP_C", unit("COMP_C", OTHER, "PLATELETS", "MM26-09-0008")]]);
  const received = command({ commandId: "CMD_RECEIVE", operation: "RECEIVE_RESERVATION", status: "LEDGER_COMMITTED_PROJECTION_PENDING", reservationId: "RES_T2" });
  const failed = command({ commandId: "CMD_FAILED", operation: "RECEIVE_RESERVATION", status: "FAILED", safeErrorCode: "V2_RESERVATION_STATE_CONFLICT", ledgerTransactionId: null, ledgerCommittedAt: null, reservationId: "RES_T3" });
  const [projectionPending, failure] = assembleUnitHistory(HOME, evidence([received, failed], { members, components }), keyring).rows;
  assert.equal(projectionPending.direction, "INBOUND");
  assert.equal(projectionPending.eventStatus, "LEDGER_COMMITTED_PROJECTION_PENDING");
  assert.equal(projectionPending.ledger.status, "COMMITTED");
  assert.equal(projectionPending.labelIdentity.value, "MM26-09-0007");
  assert.equal(failure.eventStatus, "FAILED");
  assert.equal(failure.safeErrorCode, "V2_RESERVATION_STATE_CONFLICT");
  assert.equal(failure.ledger.status, "NOT_COMMITTED");
  // The failed receipt never brought the unit into this institution, so its label is withheld.
  assert.equal(failure.labelIdentity.value, null);
  assert.equal(failure.labelIdentity.unavailableReason, "NOT_COMMITTED");
});

test("missing membership and legacy registrations are explicit, never reconstructed", () => {
  const release = command({ commandId: "CMD_RELEASE", operation: "COMPLETE_LOCAL_RELEASE", reservationId: "RES_UNKNOWN" });
  const legacy = command({ commandId: "CMD_LEGACY", operation: "REGISTER_COMPONENT", componentId: "COMP_OLD" });
  const rows = assembleUnitHistory(HOME, evidence([release, legacy], { components: new Map([["COMP_OLD", unit("COMP_OLD", HOME, "WHOLE_BLOOD", "MM26-07-0100", null)]]) }), keyring).rows;
  assert.equal(rows[0].unitMembership, "UNAVAILABLE");
  assert.equal(rows[0].componentId, null);
  assert.equal(rows[0].direction, "OUTBOUND");
  assert.equal(rows[0].eventType, "LOCAL_RELEASE_COMPLETED");
  assert.equal(rows[1].method, null);
  assert.equal(rows[1].scanId, null);
  assert.equal(rows[1].labelIdentity.source, "LEGACY_REGISTRATION");
});

test("an OCR-matched transfer receipt keeps its scan ID and OCR method", () => {
  // Mirrors the retained payload shape: captureId without a captureMethod key.
  const receipt = command({ commandId: "CMD_OCR_RECEIPT", operation: "RECEIVE_INBOUND_COMPONENT", captureId: "INCAP_R", reservationId: "RES_T4" });
  const [row] = assembleUnitHistory(OTHER, evidence([receipt], { members: new Map([["RES_T4", ["COMP_R"]]]), reservations: new Map([["RES_T4", { transferId: "TRF_T4", localReleaseId: null }]]), components: new Map([["COMP_R", unit("COMP_R", OTHER, "PLATELETS", "MM26-10-1428")]]) }), keyring).rows;
  assert.equal(row.eventType, "TRANSFER_RECEIVED");
  assert.equal(row.direction, "INBOUND");
  assert.equal(row.scanId, "INCAP_R");
  assert.equal(row.method, "OCR");
  assert.equal(row.links.transferId, "TRF_T4");
});

test("history cursors round-trip and reject tampering", () => {
  const cursor = encodeHistoryCursor({ acceptedAt: "2026-10-15T01:00:00.000Z", commandId: "CMD_REG" });
  assert.deepEqual(decodeHistoryCursor(cursor), { acceptedAt: "2026-10-15T01:00:00.000Z", commandId: "CMD_REG" });
  assert.equal(decodeHistoryCursor(undefined), null);
  for (const bad of ["CMD_REG", `HIST_${Buffer.from("2026-10-15|CMD_REG").toString("base64url")}`, `HIST_${Buffer.from("2026-10-15T01:00:00.000Z|cmd_x").toString("base64url")}`]) assert.throws(() => decodeHistoryCursor(bad), /cursor/i);
});

function credential(roleId: CredentialRecord["roleId"], institutionId = HOME): CredentialRecord {
  return { userId: "USR_SYNTH_HISTORY", username: "synth_history", displayName: "Synthetic History Reader", institutionId, institutionDisplayName: "Synthetic Mediatrix", institutionCategory: "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

async function historyApp(record: CredentialRecord) {
  const calls: Array<{ institutionId: string; limit: number; cursor: unknown }> = [];
  const registration = command({ commandId: "CMD_REG", operation: "REGISTER_INBOUND_COMPONENT", componentId: "COMP_A", captureId: "INCAP_A", captureMethod: "OCR" });
  const unitHistory = {
    async readUnitHistory(institutionId: string, limit: number, cursor: unknown) {
      calls.push({ institutionId, limit, cursor });
      return evidence([registration], { components: new Map([["COMP_A", unit("COMP_A", record.institutionId, "PLATELETS", "MM26-08-4064")]]), hasMore: true });
    },
  };
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "unit-history-test-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
    () => new Date("2026-10-15T02:00:00.000Z"), sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), keyring, unitHistory });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_HISTORY", binding: "e".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  return { app, calls, headers: { cookie: `bloodledger_session=${token}` } };
}

test("GET /api/v2/unit-history is institution-scoped, paginated and excludes sealed material", async () => {
  const { app, calls, headers } = await historyApp(credential("ROLE-03", OTHER));
  try {
    const response = await app.inject({ method: "GET", url: "/api/v2/unit-history?limit=20", headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(calls, [{ institutionId: OTHER, limit: 20, cursor: null }]);
    assert.equal(response.json().scope, "INSTITUTION");
    assert.equal(response.json().rows[0].labelIdentity.value, "MM26-08-4064");
    assert.equal(decodeHistoryCursor(response.json().nextCursor)?.commandId, "CMD_REG");
    assert.doesNotMatch(response.body, /ciphertext|authTag|nonce|lookupHmac|payload/i);
    assert.equal((await app.inject({ method: "GET", url: "/api/v2/unit-history?limit=101", headers })).statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: "/api/v2/unit-history?cursor=CMD_REG", headers })).statusCode, 400);
  } finally { await app.close(); }
});

test("regulatory readers cannot read unit history", async () => {
  const { app, calls, headers } = await historyApp(credential("ROLE-04"));
  try {
    const response = await app.inject({ method: "GET", url: "/api/v2/unit-history", headers });
    assert.equal(response.statusCode, 403);
    assert.equal(calls.length, 0);
  } finally { await app.close(); }
});
