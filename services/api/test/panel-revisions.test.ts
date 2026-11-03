import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerV2Routes } from "../src/v2-routes.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import { interviewCorePayload } from "../src/fabric.js";
import { approvalQuantity, PARTIAL_APPROVAL_POLICY_VERSION } from "../src/partial-approval-policy.js";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { presentDiscrepancy } from "../src/receipt-verification.js";
import type { WebPrincipal } from "../src/session.js";

// Exact input keys of chaincode ReserveComponents; PA-REV-01 must not add any.
const RESERVE_LEDGER_KEYS = ["actorUserId", "bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "expectedComponentVersions", "idempotencyKey", "policyVersion", "purpose", "quantity", "reservationId", "selectedComponentIds", "sourceInstitutionId"];
const origin = "http://127.0.0.1:5174";
const correlationId = "CORR_" + "B".repeat(32);

test("PA-REV-01 approvalQuantity: full by default, partial only with a supported reason, never above the request", () => {
  assert.deepEqual(approvalQuantity({}, 3), { requestedQuantity: 3, approvedQuantity: 3, partialReasonCode: null });
  assert.deepEqual(approvalQuantity({ approvedQuantity: 3, partialReasonCode: null }, 3), { requestedQuantity: 3, approvedQuantity: 3, partialReasonCode: null });
  assert.deepEqual(approvalQuantity({ approvedQuantity: 1, partialReasonCode: "LOCAL_RESERVE_PROTECTED" }, 3), { requestedQuantity: 3, approvedQuantity: 1, partialReasonCode: "LOCAL_RESERVE_PROTECTED" });
  for (const body of [
    { approvedQuantity: 0, partialReasonCode: "OTHER_OPERATIONAL" },
    { approvedQuantity: 4, partialReasonCode: "OTHER_OPERATIONAL" },
    { approvedQuantity: 1.5, partialReasonCode: "OTHER_OPERATIONAL" },
    { approvedQuantity: 2, partialReasonCode: null },
    { approvedQuantity: 2, partialReasonCode: "PATIENT_NAME" },
    { approvedQuantity: 3, partialReasonCode: "OTHER_OPERATIONAL" },
  ]) assert.throws(() => approvalQuantity(body, 3), (error: { code?: string }) => error.code === "PARTIAL_APPROVAL_INVALID", JSON.stringify(body));
});

function bridge() {
  const principal = { userId: "USR_MEDIATRIX_TECH", institutionId: "INST_MEDIATRIX", roleId: "ROLE-02" } as WebPrincipal;
  const app = Fastify(); const store = new InMemoryV2CommandStore();
  registerV2Routes(app, { store, clock: () => new Date("2026-11-03T00:00:00.000Z"), webOrigin: origin, restore: async () => ({ principal }), projection: { listComponents: async () => [], getComponent: async () => null, findComponentByIdentity: async () => null, getTransferRequest: async () => ({ status: "PENDING", destination_institution_id: "INST_DIVINE_LOVE", blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", quantity: 3 }) } });
  const body = (ids: string[], extra: Record<string, unknown> = {}) => ({ correlationId, eventTime: "2026-11-03T00:00:00.000Z", transferId: "TRF_PARTIAL", reservationId: `RES_PARTIAL_${ids.length}`, selectedComponentIds: ids, expectedComponentVersions: ids.map(() => 1), ...extra });
  const post = (idempotencyKey: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/v2/reservations", headers: { origin, "idempotency-key": idempotencyKey, "x-bloodledger-contract-version": "V2.1" }, payload });
  return { app, store, principal, body, post };
}

test("PA-REV-01 reservation bridge: partial approval reserves approvedQuantity FEFO units and keeps the ledger payload exact", async () => {
  const { app, store, principal, body, post } = bridge();
  try {
    const full = await post("IDEM_FULL_APPROVAL", body(["COMP_A", "COMP_B", "COMP_C"]));
    assert.equal(full.statusCode, 202, full.body);
    const fullCommand = await store.get(full.json().commandId, principal.institutionId, principal.userId);
    assert.equal(fullCommand?.payload.quantity, 3); assert.equal(fullCommand?.payload.requestedQuantity, 3); assert.equal(fullCommand?.payload.partialReasonCode, undefined);

    assert.equal((await post("IDEM_SHORT_NO_REASON", body(["COMP_A", "COMP_B"]))).statusCode, 400, "fewer units without approvedQuantity keep the full-quantity rule");
    const partial = await post("IDEM_PARTIAL_APPROVAL", body(["COMP_A", "COMP_B"], { approvedQuantity: 2, partialReasonCode: "INSUFFICIENT_ELIGIBLE_STOCK" }));
    assert.equal(partial.statusCode, 202, partial.body);
    const command = await store.get(partial.json().commandId, principal.institutionId, principal.userId);
    assert.equal(command?.payload.quantity, 2); assert.equal(command?.payload.requestedQuantity, 3);
    assert.equal(command?.payload.partialReasonCode, "INSUFFICIENT_ELIGIBLE_STOCK"); assert.equal(command?.payload.partialPolicyVersion, PARTIAL_APPROVAL_POLICY_VERSION);
    const ledger = interviewCorePayload(command!);
    assert.deepEqual(Object.keys(ledger).sort(), RESERVE_LEDGER_KEYS);
    assert.equal(ledger.quantity, 2);
    assert.equal((await post("IDEM_PARTIAL_APPROVAL", body(["COMP_A", "COMP_B"], { approvedQuantity: 2, partialReasonCode: "INSUFFICIENT_ELIGIBLE_STOCK" }))).json().replayed, true);

    const rejected = await post("IDEM_PARTIAL_MISMATCH", body(["COMP_A"], { approvedQuantity: 2, partialReasonCode: "OTHER_OPERATIONAL" }));
    assert.equal(rejected.statusCode, 400); assert.equal(rejected.json().code, "V2_INPUT_INVALID", "selection must equal approvedQuantity");
    const noReason = await post("IDEM_PARTIAL_NULL_REASON", body(["COMP_A"], { approvedQuantity: 1, partialReasonCode: null }));
    assert.equal(noReason.statusCode, 400); assert.equal(noReason.json().code, "PARTIAL_APPROVAL_INVALID");
    const over = await post("IDEM_PARTIAL_OVER", body(["COMP_A", "COMP_B", "COMP_C", "COMP_D"], { approvedQuantity: 4, partialReasonCode: "OTHER_OPERATIONAL" }));
    assert.equal(over.json().code, "PARTIAL_APPROVAL_INVALID");
    const half = await post("IDEM_PARTIAL_HALF_PAIR", body(["COMP_A"], { approvedQuantity: 1 }));
    assert.equal(half.statusCode, 400); assert.equal(half.json().code, "V2_INPUT_INVALID", "the two fields travel together");
  } finally { await app.close(); }
});

test("PA-REV-02 receipt is blocked while a discrepancy is open", async () => {
  const principal = { userId: "USR_DIVINE_REQUESTER", institutionId: "INST_DIVINE_LOVE", roleId: "ROLE-03" } as WebPrincipal;
  let discrepancy: ReturnType<typeof presentDiscrepancy> | null = presentDiscrepancy({ discrepancy_id: "RDS_" + "A".repeat(40), reservation_id: "RES_DISPUTED", reservation_version: 6, status: "OPEN", expected_units: 3, matched_units: 2, unmatched_labels: 0, missing_units: 1, recorded_at: "2026-11-03T00:00:00.000Z", resolution_code: null, resolved_at: null });
  const app = Fastify(); const store = new InMemoryV2CommandStore();
  registerV2Routes(app, { store, clock: () => new Date("2026-11-03T00:00:00.000Z"), webOrigin: origin, restore: async () => ({ principal }), projection: { listComponents: async () => [], getComponent: async () => null, findComponentByIdentity: async () => null, getReservation: async () => ({ reservationId: "RES_DISPUTED", purpose: "TRANSFER", status: "IN_TRANSIT", version: 6, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_DIVINE_LOVE", transferId: "TRF_DISPUTED", localReleaseId: null, preparedAt: null, preparedEvidencePresent: true, updatedAt: "2026-11-03T00:00:00.000Z", components: [{ componentId: "COMP_A", componentType: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "IN_TRANSIT", inventoryVersion: 4 }], receiptDiscrepancy: discrepancy, classification: "SIMULATION_ONLY" }) } });
  const receive = (key: string) => app.inject({ method: "POST", url: "/api/v2/reservations/RES_DISPUTED/receive", headers: { origin, "idempotency-key": key }, payload: { correlationId, eventTime: "2026-11-03T00:00:00.000Z", expectedVersion: 6 } });
  try {
    const blocked = await receive("IDEM_RECEIVE_DISPUTED");
    assert.equal(blocked.statusCode, 409); assert.equal(blocked.json().code, "RECEIPT_DISCREPANCY_OPEN");
    discrepancy = { ...discrepancy!, status: "RESOLVED", resolutionCode: "RECOUNT_MATCHED", resolvedAt: "2026-11-03T00:05:00.000Z" };
    assert.equal((await receive("IDEM_RECEIVE_AFTER_RECOUNT")).statusCode, 202, "a resolved discrepancy no longer blocks receipt");
    const discrepancyRoute = await app.inject({ method: "POST", url: "/api/v2/reservations/RES_DISPUTED/receipt-discrepancy", headers: { origin, "idempotency-key": "IDEM_DISCREPANCY" }, payload: {} });
    assert.equal(discrepancyRoute.statusCode, 503, "the route needs the receipt store");
  } finally { await app.close(); }
});

test("PA-REV-02 discrepancy recording is an operator-bound action for receiving hospitals only; reads expose counts only", () => {
  const action = "POST /api/v2/reservations/RES_DISPUTED/receipt-discrepancy";
  const operator = (roleId: "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04") => ({ operatorId: "USR_SYNTH_OP", roleId, capabilityProfile: "ROLE" as const, version: 1 });
  assert.equal(allowedOperatorAction({ accountCategory: "REQUESTOR" } as WebPrincipal, operator("ROLE-03"), action), true);
  for (const roleId of ["ROLE-01", "ROLE-02"] as const) assert.equal(allowedOperatorAction({ accountCategory: "BLOOD_BANK" } as WebPrincipal, operator(roleId), action), true);
  assert.equal(allowedOperatorAction({ accountCategory: "DOH" } as WebPrincipal, operator("ROLE-04"), action), false);
  const read = presentDiscrepancy({ discrepancy_id: "RDS_" + "C".repeat(40), reservation_id: "RES_DISPUTED", reservation_version: 6, status: "RESOLVED", expected_units: 3, matched_units: 3, unmatched_labels: 1, missing_units: 0, recorded_at: "2026-11-03T00:00:00.000Z", resolution_code: "COMPROMISED", resolved_at: "2026-11-03T01:00:00.000Z", request_sha256: "f".repeat(64), evidence_digest: "e".repeat(64), recorded_by: "USR_SECRET" });
  assert.deepEqual(Object.keys(read).sort(), ["classification", "discrepancyId", "expectedUnits", "matchedUnits", "missingUnits", "policyVersion", "recordedAt", "reservationId", "reservationVersion", "resolutionCode", "resolvedAt", "status", "unmatchedLabels"]);
});
