import assert from "node:assert/strict";
import test from "node:test";
import { interviewCorePayload } from "../src/fabric.js";
import type { V2Command } from "../src/v2-command.js";

// Exact input keys of InterviewCoreContract.RecordInboundReceipt (parseExactObject); the chaincode is unchanged.
const RECORD_INBOUND_RECEIPT_KEYS = ["actorInstitutionId", "actorUserId", "captureEvidenceDigest", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId"];
const base = { reservationId: "RES_SYNTH_RECEIPT", expectedVersion: 4, actorUserId: "USR_SYNTH_RECEIVER", actorInstitutionId: "INST_MEDIATRIX", eventTime: "2026-10-09T15:00:00.000Z", correlationId: "CORR_00000000000000000000000000000002", captureEvidenceDigest: "a".repeat(64) };
const command = (payload: Record<string, unknown>) => ({ operation: "RECEIVE_INBOUND_COMPONENT", idempotencyKey: "IDEM_RECEIPT_PAYLOAD", payload }) as Pick<V2Command, "operation" | "payload" | "idempotencyKey">;

test("FR-10/FR-11 a bank receipt sends only RecordInboundReceipt fields to the ledger", () => {
  // Receipts accepted through OCR intake before ADR-049 keep their capture link and replay digest off-chain.
  assert.deepEqual(Object.keys(interviewCorePayload(command({ ...base, captureId: `INCAP_${"A".repeat(40)}`, captureRequestSha256: "b".repeat(64) }))).sort(), RECORD_INBOUND_RECEIPT_KEYS);
  // ADR-049 receipts reference their verified receipt evidence off-chain; its digest is the capture evidence digest.
  assert.deepEqual(Object.keys(interviewCorePayload(command({ ...base, policyVersion: "INTERVIEW_DERIVED_CORE_V2_1", receiptEvidenceId: `RCV_${"A".repeat(40)}` }))).sort(), RECORD_INBOUND_RECEIPT_KEYS);
});
