import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { activityContract, assembleActivityHistory, decodeActivityCursor, type ActivityRecord } from "../src/activity-history.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// ADR-045 ACTIVITY_HISTORY_READ_V2: opt-in PRC coordination events; V1 unchanged. Synthetic records only.
function record(overrides: Partial<ActivityRecord> & Pick<ActivityRecord, "eventId" | "activityCode">): ActivityRecord {
  return { eventSource: "COMMAND", targetType: "TRANSFER", processingStatus: "COMMITTED", safeErrorCode: null, correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", ledgerTransactionId: "tx-1", ledgerCommittedAt: "2026-10-15T01:00:01.000Z", recordedAt: "2026-10-15T01:00:00.250Z", commandEventTime: "2026-10-15T00:59:59.000Z", actorUserId: "USR_SYNTH_OP", actorKind: "VERIFIED_OPERATOR", actorDisplayName: "Synthetic Operator", actorCurrentRoleId: "ROLE-02", captureId: null, captureMethod: null, requestId: "TRF_S", reservationId: null, reservationPurpose: null, localReleaseId: null, componentIds: [], actorInstitutionId: "INST_MEDIATRIX", prcSupplyRequestId: null, coordinationPriorStatus: null, coordinationResultingStatus: null, coordinationReasonCode: null, ...overrides };
}
const PRC_ID = "PRCSR_" + "B".repeat(40);
const prcDecline = record({ eventId: "AUD_" + "C".repeat(40), activityCode: "PRC_SUPPLY_DECLINE", eventSource: "PRC_SUPPLY_COORDINATION", targetType: "PRC_SUPPLY_REQUEST", processingStatus: null, ledgerTransactionId: null, ledgerCommittedAt: null, commandEventTime: null, requestId: null, actorUserId: "USR_SYNTH_PRC_OP", actorCurrentRoleId: "ROLE-04", actorInstitutionId: "INST_SYNTH_PRC", prcSupplyRequestId: PRC_ID, coordinationPriorStatus: "SUBMITTED", coordinationResultingStatus: "DECLINED", coordinationReasonCode: "NO_STOCK", recordedAt: "2026-10-15T01:00:00.500Z" });
const command = record({ eventId: "CMD_SUBMIT", activityCode: "SUBMIT_TRANSFER" });

test("contract negotiation: absent or V1 is V1, V2 is opt-in, anything else is refused", () => {
  assert.equal(activityContract(undefined), "ACTIVITY_HISTORY_READ_V1");
  assert.equal(activityContract("ACTIVITY_HISTORY_READ_V1"), "ACTIVITY_HISTORY_READ_V1");
  assert.equal(activityContract("ACTIVITY_HISTORY_READ_V2"), "ACTIVITY_HISTORY_READ_V2");
  for (const value of ["ACTIVITY_HISTORY_READ_V3", "v2", "", ["ACTIVITY_HISTORY_READ_V2", "ACTIVITY_HISTORY_READ_V1"]]) {
    assert.throws(() => activityContract(value), (error: { code?: string }) => error.code === "ACTIVITY_CONTRACT_UNSUPPORTED");
  }
});

test("V1 output is unchanged and never carries PRC coordination rows", () => {
  const v1 = assembleActivityHistory([prcDecline, command], false);
  assert.equal(v1.policyVersion, "ACTIVITY_HISTORY_READ_V1");
  assert.deepEqual(v1.rows.map((row) => row.eventId), ["CMD_SUBMIT"]);
  const [row] = v1.rows;
  assert.deepEqual(Object.keys(row.actor).sort(), ["currentRoleId", "displayName", "kind", "reference"]);
  assert.deepEqual(Object.keys(row.links).sort(), ["componentIds", "localReleaseId", "reservationId", "reservationPurpose", "scanId", "transferId"]);
  assert.equal("coordination" in row, false);
});

test("V2 PRC rows are off-chain coordination with only a PRC request link", () => {
  const v2 = assembleActivityHistory([prcDecline, command], true, "ACTIVITY_HISTORY_READ_V2");
  assert.equal(v2.policyVersion, "ACTIVITY_HISTORY_READ_V2");
  const [prc, cmd] = v2.rows;
  assert.equal(prc.eventSource, "PRC_SUPPLY_COORDINATION");
  assert.equal(prc.activityCode, "PRC_SUPPLY_DECLINE");
  assert.equal(prc.eventStatus, "OFF_CHAIN_RECORDED");
  assert.equal(prc.processingStatus, null);
  assert.deepEqual(prc.ledger, { status: "NOT_APPLICABLE", transactionId: null, committedAt: null });
  assert.equal(prc.eventTime, "2026-10-15T01:00:00.500Z");
  assert.equal(prc.eventTimeSource, "PRC_COORDINATION_RECORDED_AT");
  assert.deepEqual(prc.links, { scanId: null, transferId: null, reservationId: null, reservationPurpose: null, localReleaseId: null, componentIds: [], prcSupplyRequestId: PRC_ID });
  assert.deepEqual(prc.coordination, { priorStatus: "SUBMITTED", resultingStatus: "DECLINED", reasonCode: "NO_STOCK" });
  assert.equal(prc.actor.institutionId, "INST_SYNTH_PRC");
  assert.equal(prc.actor.currentRoleId, "ROLE-04");
  // Ordinary command rows keep V1 values and gain explicit nulls.
  assert.equal(cmd.eventStatus, "CONFIRMED");
  assert.equal(cmd.links.transferId, "TRF_S");
  assert.equal(cmd.links.prcSupplyRequestId, null);
  assert.equal(cmd.coordination, null);
  assert.equal(cmd.actor.institutionId, "INST_MEDIATRIX");
  assert.equal(decodeActivityCursor(v2.nextCursor!, "ACTIVITY_HISTORY_READ_V2")?.eventId, "CMD_SUBMIT");
});

test("cursors are bound to their contract and V2 accepts audit event IDs", () => {
  const v2Cursor = assembleActivityHistory([prcDecline], true, "ACTIVITY_HISTORY_READ_V2").nextCursor!;
  assert.match(v2Cursor, /^ACT2_/);
  assert.deepEqual(decodeActivityCursor(v2Cursor, "ACTIVITY_HISTORY_READ_V2"), { recordedAt: "2026-10-15T01:00:00.500Z", eventId: prcDecline.eventId });
  assert.throws(() => decodeActivityCursor(v2Cursor), /cursor/i);
  const v1Cursor = assembleActivityHistory([command], true).nextCursor!;
  assert.throws(() => decodeActivityCursor(v1Cursor, "ACTIVITY_HISTORY_READ_V2"), /cursor/i);
  assert.throws(() => decodeActivityCursor(`ACT_${Buffer.from(`2026-10-15T01:00:00.500Z|${prcDecline.eventId}`).toString("base64url")}`), /cursor/i);
});

const auditor: CredentialRecord = { userId: "USR_SYNTH_AUDITOR", username: "synth_auditor", displayName: "Synthetic Auditor", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };

test("the route negotiates the contract before reading and refuses unknown or repeated values", async () => {
  const calls: unknown[][] = [];
  const activityHistory = { async readActivityHistory(...args: unknown[]) { calls.push(args); return { records: [prcDecline, command], hasMore: false }; } };
  const sessions = { async findCredential() { return auditor; }, async createSession() {}, async restoreSession() { return auditor; }, async revokeSession() {} };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "activity-v2-test-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
    () => new Date("2026-10-15T02:00:00.000Z"), sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), activityHistory });
  const token = app.jwt.sign({ userId: auditor.userId, institutionId: auditor.institutionId, roleId: auditor.roleId, sessionId: "SESS_SYNTH_ACTIVITY_V2", binding: "9".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const get = (query: string) => app.inject({ method: "GET", url: `/api/v2/activity-history${query}`, headers: { cookie: `bloodledger_session=${token}` } });
  try {
    const v1 = await get("");
    assert.equal(v1.statusCode, 200);
    assert.equal(v1.json().policyVersion, "ACTIVITY_HISTORY_READ_V1");
    assert.equal(v1.json().rows.length, 1);
    const v2 = await get("?contract=ACTIVITY_HISTORY_READ_V2");
    assert.equal(v2.statusCode, 200);
    assert.equal(v2.json().policyVersion, "ACTIVITY_HISTORY_READ_V2");
    assert.equal(v2.json().rows.length, 2);
    assert.deepEqual(calls.map((args) => args[3]), [false, true]);
    for (const query of ["?contract=ACTIVITY_HISTORY_READ_V3", "?contract=ACTIVITY_HISTORY_READ_V2&contract=ACTIVITY_HISTORY_READ_V1"]) {
      const refused = await get(query);
      assert.equal(refused.statusCode, 400);
      assert.equal(refused.json().error.code, "ACTIVITY_CONTRACT_UNSUPPORTED");
    }
    assert.equal(calls.length, 2);
  } finally { await app.close(); }
});
