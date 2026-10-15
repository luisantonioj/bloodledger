import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { assembleActivityHistory, decodeActivityCursor, type ActivityRecord } from "../src/activity-history.js";
import { assembleTransferSummaries, decodeSummaryCursor, type TransferSummaryRecord } from "../src/transfer-summary.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// Synthetic institutions, accounts and references only.
const HOME = "INST_MEDIATRIX";
const RECIPIENT = "INST_SYNTH_SECONDARY_01";

function summary(overrides: Partial<TransferSummaryRecord> & Pick<TransferSummaryRecord, "reservationId" | "purpose">): TransferSummaryRecord {
  return { status: "ACTIVE", version: 2, transferId: null, localReleaseId: null, sourceInstitutionId: HOME, sourceDisplayName: "Synthetic Mediatrix Hospital", destinationInstitutionId: null, destinationDisplayName: null, requestStatus: null, urgency: null, requestBloodType: null, requestComponentType: null, requestQuantity: null, reservedAt: "2026-10-08T17:42:14.000Z", reserveBloodType: null, reserveComponentType: null, reserveQuantity: null, allocatedUnits: null, currentUnitStatus: {}, sortKey: "2026-10-08T17:42:14.000Z", ...overrides };
}

test("TRANSFER_SUMMARY_READ_V1 takes transfer product and requested units from the reservation's own request", () => {
  const result = assembleTransferSummaries([summary({ reservationId: "RES_T1", purpose: "TRANSFER", transferId: "TRF_T1", destinationInstitutionId: RECIPIENT, destinationDisplayName: "Synthetic Secondary Hospital", requestStatus: "APPROVED", urgency: "URGENT", requestBloodType: "O_POSITIVE", requestComponentType: "FRESH_FROZEN_PLASMA", requestQuantity: 2, reserveBloodType: "A_NEGATIVE", reserveQuantity: 9, allocatedUnits: 2, currentUnitStatus: { RESERVED: 2 } })], false);
  const [row] = result.rows;
  assert.equal(row.reservationId, "RES_T1");
  assert.equal(row.transferId, "TRF_T1");
  assert.equal(row.urgency, "URGENT");
  assert.equal(row.bloodType, "O_POSITIVE");
  assert.equal(row.componentType, "FRESH_FROZEN_PLASMA");
  // Requested, allocated and current-status counts stay separate; none is relabeled as dispatched or received.
  assert.deepEqual(row.units, { requested: 2, allocated: 2, currentStatus: { RESERVED: 2 } });
  assert.deepEqual(row.destination, { institutionId: RECIPIENT, displayName: "Synthetic Secondary Hospital" });
  assert.equal(row.destinationApplicability, "RECORDED");
  assert.equal(result.nextCursor, null);
  assert.equal(result.policyVersion, "TRANSFER_SUMMARY_READ_V1");
});

test("local releases stay visible with no invented destination, request or priority", () => {
  const [row] = assembleTransferSummaries([summary({ reservationId: "RES_L1", purpose: "LOCAL_RELEASE", status: "COMPLETED", localReleaseId: "REL_L1", reserveBloodType: "B_POSITIVE", reserveComponentType: "PLATELETS", reserveQuantity: 1, allocatedUnits: 1, currentUnitStatus: { RELEASED: 1 } })], false).rows;
  assert.equal(row.purpose, "LOCAL_RELEASE");
  assert.equal(row.transferId, null);
  assert.equal(row.localReleaseId, "REL_L1");
  assert.equal(row.urgency, null);
  assert.equal(row.requestStatus, null);
  assert.equal(row.destination, null);
  assert.equal(row.destinationApplicability, "NOT_APPLICABLE");
  assert.equal(row.bloodType, "B_POSITIVE");
  assert.equal(row.units.requested, 1);
});

test("missing linkage is explicit and paging cursors reject tampering", () => {
  const records = [summary({ reservationId: "RES_ORPHAN", purpose: "TRANSFER", transferId: "TRF_MISSING", reservedAt: null, sortKey: "1970-01-01T00:00:00.000Z" })];
  const result = assembleTransferSummaries(records, true);
  const [row] = result.rows;
  assert.equal(row.productAvailability, "UNAVAILABLE");
  assert.equal(row.units.requested, null);
  assert.equal(row.units.allocated, null);
  assert.equal(row.destinationApplicability, "UNAVAILABLE");
  assert.equal(row.reservedAt, null);
  assert.deepEqual(decodeSummaryCursor(result.nextCursor!), { sortKey: "1970-01-01T00:00:00.000Z", reservationId: "RES_ORPHAN" });
  assert.throws(() => decodeSummaryCursor("TSUM_bad"), /cursor/i);
  assert.throws(() => decodeSummaryCursor(`TSUM_${Buffer.from("2026-10-08T17:42:14.000Z|TRF_X").toString("base64url")}`), /cursor/i);
});

function activity(overrides: Partial<ActivityRecord> & Pick<ActivityRecord, "eventId" | "activityCode">): ActivityRecord {
  return { eventSource: "COMMAND", targetType: "TRANSFER", processingStatus: "COMMITTED", safeErrorCode: null, correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", ledgerTransactionId: "tx-1", ledgerCommittedAt: "2026-10-09T15:02:20.000Z", recordedAt: "2026-10-09T15:02:19.000Z", commandEventTime: "2026-10-09T15:02:18.373Z", actorUserId: "USR_SYNTH_OPERATOR_01", actorKind: "VERIFIED_OPERATOR", actorDisplayName: "Synthetic Operator", actorCurrentRoleId: "ROLE-02", captureId: null, captureMethod: null, requestId: null, reservationId: null, reservationPurpose: null, localReleaseId: null, componentIds: [], actorInstitutionId: "INST_MEDIATRIX", prcSupplyRequestId: null, coordinationPriorStatus: null, coordinationResultingStatus: null, coordinationReasonCode: null, ...overrides };
}

test("ACTIVITY_HISTORY_READ_V1 links scan, request and transfer only from recorded references", () => {
  const rows = assembleActivityHistory([
    activity({ eventId: "CMD_RECEIPT", activityCode: "RECEIVE_INBOUND_COMPONENT", targetType: "INBOUND_CAPTURE", captureId: "INCAP_R", requestId: "TRF_R", reservationId: "RES_R", reservationPurpose: "TRANSFER", componentIds: ["COMP_A", "COMP_B"] }),
    activity({ eventId: "CMD_SUBMIT", activityCode: "SUBMIT_TRANSFER", requestId: "TRF_S" }),
    activity({ eventId: "CMD_RELEASE", activityCode: "COMPLETE_LOCAL_RELEASE", reservationId: "RES_L", reservationPurpose: "LOCAL_RELEASE", localReleaseId: "REL_L", componentIds: ["COMP_C"] }),
  ], false).rows;
  assert.deepEqual(rows[0].links, { scanId: "INCAP_R", transferId: "TRF_R", reservationId: "RES_R", reservationPurpose: "TRANSFER", localReleaseId: null, componentIds: ["COMP_A", "COMP_B"] });
  // A submitted request has no custody transfer yet; no later reservation is attached to it.
  assert.equal(rows[1].links.transferId, "TRF_S");
  assert.equal(rows[1].links.reservationId, null);
  assert.equal(rows[1].links.scanId, null);
  // A local-release reservation is marked as such, so it is never shown as a hospital Transfer ID.
  assert.equal(rows[2].links.transferId, null);
  assert.equal(rows[2].links.reservationPurpose, "LOCAL_RELEASE");
  assert.equal(rows[2].links.localReleaseId, "REL_L");
  assert.ok(rows.every((row) => row.eventTimeSource === "COMMAND_EVENT_TIME" && row.ledger.status === "COMMITTED"));
});

test("activity status, ledger and actor provenance stay truthful", () => {
  const rows = assembleActivityHistory([
    activity({ eventId: "CMD_FAILED", activityCode: "RECEIVE_INBOUND_COMPONENT", processingStatus: "FAILED", safeErrorCode: "CORE_FIELD_NOT_ALLOWED", ledgerTransactionId: null, ledgerCommittedAt: null }),
    activity({ eventId: "CMD_QUEUED", activityCode: "DISPATCH_RESERVATION", processingStatus: "QUEUED", ledgerTransactionId: null, ledgerCommittedAt: null, commandEventTime: null, actorKind: "UNKNOWN", actorDisplayName: null, actorCurrentRoleId: null, actorUserId: "USR_SYNTH_REMOVED" }),
    activity({ eventId: "CMD_PROJECTING", activityCode: "RESERVE_COMPONENTS", processingStatus: "LEDGER_COMMITTED_PROJECTION_PENDING" }),
    activity({ eventId: "IDEM_ACK", activityCode: "ALERT_ACKNOWLEDGED_OFF_CHAIN", eventSource: "OFF_CHAIN_ACKNOWLEDGEMENT", targetType: "ALERT", processingStatus: null, ledgerTransactionId: null, ledgerCommittedAt: null, commandEventTime: null, actorKind: "USER_ACCOUNT", componentIds: ["COMP_X"] }),
  ], true);
  const [failed, queued, projecting, ack] = rows.rows;
  assert.equal(failed.eventStatus, "FAILED");
  assert.equal(failed.ledger.status, "NOT_COMMITTED");
  assert.equal(queued.eventStatus, "PENDING");
  assert.equal(queued.eventTime, null);
  assert.equal(queued.eventTimeSource, null);
  assert.deepEqual(queued.actor, { kind: "UNKNOWN", reference: "USR_SYNTH_REMOVED", displayName: null, currentRoleId: null });
  assert.equal(projecting.eventStatus, "LEDGER_COMMITTED_PROJECTION_PENDING");
  assert.equal(projecting.ledger.status, "COMMITTED");
  assert.equal(ack.eventStatus, "OFF_CHAIN_RECORDED");
  assert.equal(ack.ledger.status, "NOT_APPLICABLE");
  assert.equal(ack.eventTime, ack.recordedAt);
  assert.equal(ack.eventTimeSource, "OFF_CHAIN_ACKNOWLEDGED_AT");
  assert.deepEqual(decodeActivityCursor(rows.nextCursor!), { recordedAt: "2026-10-09T15:02:19.000Z", eventId: "IDEM_ACK" });
  assert.throws(() => decodeActivityCursor(`ACT_${Buffer.from("2026-10-09T15:02:19.000Z|CORR_X").toString("base64url")}`), /cursor/i);
});

function credential(roleId: CredentialRecord["roleId"], institutionId: string): CredentialRecord {
  return { userId: "USR_SYNTH_TABLE_READER", username: "synth_table_reader", displayName: "Synthetic Table Reader", institutionId, institutionDisplayName: "Synthetic Institution", institutionCategory: "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

async function readsApp(record: CredentialRecord) {
  const calls: unknown[][] = [];
  const transferSummaries = { async readTransferSummaries(...args: unknown[]) { calls.push(["summaries", ...args]); return { records: [summary({ reservationId: "RES_T1", purpose: "TRANSFER" })], hasMore: false }; } };
  const activityHistory = { async readActivityHistory(...args: unknown[]) { calls.push(["activity", ...args]); return { records: [activity({ eventId: "CMD_SUBMIT", activityCode: "SUBMIT_TRANSFER", requestId: "TRF_S" })], hasMore: false }; } };
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "table-reads-test-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
    () => new Date("2026-10-15T02:00:00.000Z"), sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), transferSummaries, activityHistory });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_TABLES", binding: "f".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  return { app, calls, headers: { cookie: `bloodledger_session=${token}` } };
}

test("transfer summaries pass the caller's institution and role; regulators are refused", async () => {
  const recipient = await readsApp(credential("ROLE-03", RECIPIENT));
  try {
    const response = await recipient.app.inject({ method: "GET", url: "/api/v2/transfer-summaries?limit=10", headers: recipient.headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(recipient.calls, [["summaries", RECIPIENT, "ROLE-03", 10, null]]);
    assert.equal(response.json().rows[0].reservationId, "RES_T1");
    assert.equal((await recipient.app.inject({ method: "GET", url: "/api/v2/transfer-summaries?cursor=RES_T1", headers: recipient.headers })).statusCode, 400);
  } finally { await recipient.app.close(); }
  const regulator = await readsApp(credential("ROLE-04", HOME));
  try {
    assert.equal((await regulator.app.inject({ method: "GET", url: "/api/v2/transfer-summaries", headers: regulator.headers })).statusCode, 403);
    assert.equal(regulator.calls.length, 0);
  } finally { await regulator.app.close(); }
});

test("activity history is limited to the audit-reader role in its own institution", async () => {
  const auditor = await readsApp(credential("ROLE-02", HOME));
  try {
    const response = await auditor.app.inject({ method: "GET", url: "/api/v2/activity-history", headers: auditor.headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(auditor.calls, [["activity", HOME, 50, null, false]]);
    assert.equal(response.json().rows[0].links.transferId, "TRF_S");
    assert.doesNotMatch(response.body, /ciphertext|authTag|nonce|lookupHmac|payload|pin/i);
  } finally { await auditor.app.close(); }
  for (const record of [credential("ROLE-01", HOME), credential("ROLE-03", RECIPIENT), credential("ROLE-04", HOME)]) {
    const other = await readsApp(record);
    try {
      assert.equal((await other.app.inject({ method: "GET", url: "/api/v2/activity-history", headers: other.headers })).statusCode, 403);
      assert.equal(other.calls.length, 0);
    } finally { await other.app.close(); }
  }
});
