import assert from "node:assert/strict";
import test from "node:test";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { operatorActions, operatorPrincipal } from "../src/institution-access.js";
import { assertRequiredByWindow, parseSubmission, decodePrcCursor, isPrcResponder, isRequester, PRC_TRANSITIONS, presentRequest, readScope, validateAction, validateSubmission } from "../src/prc-supply.js";
import type { WebPrincipal } from "../src/session.js";

// PA-DEF-06 / ADR-044 SYNTHETIC_PRC_SUPPLY_V1 rules; synthetic principals only.
const now = new Date("2026-10-15T08:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
const HOUR = 3_600_000, DAY = 24 * HOUR;
const body = { bloodType: "O_NEGATIVE", componentType: "CRYOPRECIPITATE", requestedQuantity: 3, urgency: "CRITICAL", requiredBy: at(2 * DAY), correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF" };
const ID = "PRCSR_" + "A".repeat(40);

function principal(overrides: Partial<WebPrincipal>): WebPrincipal {
  return { userId: "USR_SYNTH_OP", displayName: "Synthetic Operator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix", institutionCategory: "HOSPITAL", roleId: "ROLE-02", roleDisplayName: "Verified operator", permissions: [], classification: "SIMULATION_ONLY", accountId: "USR_SYNTH_ACCOUNT", accountCategory: "BLOOD_BANK", operatorId: "USR_SYNTH_OP", ...overrides };
}

test("submission accepts one product line inside the 1 h–30 d required-by window", () => {
  assert.equal(validateSubmission(body, now).requestedQuantity, 3);
  assert.equal(validateSubmission({ ...body, requiredBy: at(HOUR) }, now).requiredBy, at(HOUR));
  assert.equal(validateSubmission({ ...body, requiredBy: at(30 * DAY) }, now).requiredBy, at(30 * DAY));
  for (const requiredBy of [at(HOUR - 1), at(30 * DAY + 1)]) assert.throws(() => validateSubmission({ ...body, requiredBy }, now), /between 1 hour and 30 days/);
  for (const invalid of [{ ...body, requestedQuantity: 0 }, { ...body, requestedQuantity: 11 }, { ...body, requestedQuantity: 1.5 }, { ...body, urgency: "EMERGENCY" }, { ...body, bloodType: "O" }, { ...body, requiredBy: "2026-10-17T08:00:00Z" }, { ...body, note: "free text" }, { ...body, correlationId: "CORR_x" }]) {
    assert.throws(() => validateSubmission(invalid, now), /input is invalid/);
  }
});

test("shape parsing is separate from the moving required-by window used only for new writes", () => {
  // A replay of an accepted body is parsed without the clock; the window applies to a new write.
  const late = { ...body, requiredBy: at(30 * 60_000) };
  assert.equal(parseSubmission(late).requiredBy, late.requiredBy);
  assert.throws(() => assertRequiredByWindow(late.requiredBy, now), /between 1 hour and 30 days/);
  assert.doesNotThrow(() => assertRequiredByWindow(body.requiredBy, now));
  assert.throws(() => parseSubmission({ ...late, note: "x" }), /input is invalid/);
});

test("actions take exact bodies and the decided reference and reason vocabularies", () => {
  const base = { expectedVersion: 1, correlationId: body.correlationId };
  assert.deepEqual(validateAction("cancel", base), base);
  assert.equal(validateAction("acknowledge", { ...base, prcReference: "PRC-SIM-0001" }).prcReference, "PRC-SIM-0001");
  assert.equal(validateAction("fulfil", { ...base, fulfilledQuantity: 2 }).fulfilledQuantity, 2);
  assert.equal(validateAction("decline", { ...base, reasonCode: "DEADLINE_NOT_FEASIBLE" }).reasonCode, "DEADLINE_NOT_FEASIBLE");
  for (const [action, value] of [["acknowledge", { ...base, prcReference: "prc-1" }], ["acknowledge", { ...base, prcReference: "AB" }], ["fulfil", { ...base, fulfilledQuantity: 0 }], ["decline", { ...base, reasonCode: "OTHER" }], ["cancel", { ...base, reasonCode: "NO_STOCK" }], ["cancel", { correlationId: base.correlationId, expectedVersion: 0 }]] as const) {
    assert.throws(() => validateAction(action, value), /input is invalid/);
  }
});

test("the lifecycle allows only the decided transitions and actors", () => {
  assert.deepEqual(PRC_TRANSITIONS.cancel, { from: ["SUBMITTED"], to: "CANCELLED", actor: "REQUESTER" });
  assert.deepEqual(PRC_TRANSITIONS.acknowledge, { from: ["SUBMITTED"], to: "ACKNOWLEDGED", actor: "PRC" });
  assert.deepEqual(PRC_TRANSITIONS.fulfil, { from: ["ACKNOWLEDGED"], to: "FULFILLED", actor: "PRC" });
  assert.deepEqual(PRC_TRANSITIONS.decline, { from: ["SUBMITTED", "ACKNOWLEDGED"], to: "DECLINED", actor: "PRC" });
});

test("operator verification binds PRC actions to bank ROLE-02 and the PRC reviewer only", () => {
  const bank = principal({}), prc = principal({ accountCategory: "PRC", institutionId: "INST_SYNTH_PRC", roleId: "ROLE-04" }), requestor = principal({ accountCategory: "REQUESTOR", roleId: "ROLE-03" });
  const role = (roleId: "ROLE-01" | "ROLE-02" | "ROLE-03") => ({ operatorId: "USR_SYNTH_OP", roleId, capabilityProfile: "ROLE" as const, version: 1 });
  const reviewer = { operatorId: "USR_SYNTH_PRC_OP", roleId: "ROLE-04" as const, capabilityProfile: "PRC_REVIEWER" as const, version: 1 };
  const submit = "POST /api/v2/prc-supply-requests", cancel = `POST /api/v2/prc-supply-requests/${ID}/cancel`;
  assert.equal(allowedOperatorAction(bank, role("ROLE-02"), submit), true);
  assert.equal(allowedOperatorAction(bank, role("ROLE-02"), cancel), true);
  assert.equal(allowedOperatorAction(bank, role("ROLE-01"), submit), false);
  assert.equal(allowedOperatorAction(requestor, role("ROLE-03"), submit), false);
  assert.equal(allowedOperatorAction(prc, reviewer, submit), false);
  for (const action of ["acknowledge", "fulfil", "decline"]) {
    assert.equal(allowedOperatorAction(prc, reviewer, `POST /api/v2/prc-supply-requests/${ID}/${action}`), true);
    assert.equal(allowedOperatorAction(bank, role("ROLE-02"), `POST /api/v2/prc-supply-requests/${ID}/${action}`), false);
  }
  assert.equal(allowedOperatorAction(prc, reviewer, `POST /api/v2/prc-supply-requests/${ID}/approve`), false);
  assert.ok(operatorActions(role("ROLE-02")).includes("prc-supply:request"));
  assert.ok(!operatorActions(role("ROLE-01")).includes("prc-supply:request"));
  assert.ok(operatorActions(reviewer).includes("prc-supply:respond"));
  assert.ok(operatorPrincipal(prc, reviewer).administrativeCapabilities?.includes("prc-supply:respond"));
});

test("service authorization and read scope follow the decided visibility", () => {
  assert.equal(isRequester(principal({})), true);
  assert.equal(isRequester(principal({ operatorId: undefined })), false);
  assert.equal(isRequester(principal({ roleId: "ROLE-01" })), false);
  assert.equal(isPrcResponder(principal({ accountCategory: "PRC", administrativeCapabilities: ["prc-supply:respond"] })), true);
  assert.equal(isPrcResponder(principal({ accountCategory: "PRC", administrativeCapabilities: [] })), false);
  assert.deepEqual(readScope(principal({ operatorId: undefined })), { institutionId: "INST_MEDIATRIX" });
  assert.deepEqual(readScope(principal({ roleId: "ROLE-01" })), { institutionId: "INST_MEDIATRIX" });
  assert.deepEqual(readScope(principal({ accountCategory: "PRC", roleId: "ROLE-04" })), { all: true });
  for (const denied of [principal({ accountCategory: "DOH", roleId: "ROLE-04" }), principal({ accountCategory: "REQUESTOR", roleId: "ROLE-03" }), principal({ accountCategory: undefined, accountId: undefined })]) {
    assert.throws(() => readScope(denied), /not permitted/);
  }
});

test("presentation keeps null reference, fulfilment and ledger semantics explicit", () => {
  const row = presentRequest({ request_id: ID, requesting_institution_id: "INST_MEDIATRIX", institution_name: "Synthetic Mediatrix", blood_type: "O_NEGATIVE", component_type: "PLATELETS", requested_quantity: 3, fulfilled_quantity: null, urgency: "URGENT", required_by: at(DAY), status: "SUBMITTED", prc_reference: null, decline_reason: null, submitted_at: now.toISOString(), acknowledged_at: null, closed_at: null, version: 1 });
  assert.equal(row.prcReference, null);
  assert.equal(row.referenceProvenance, null);
  assert.equal(row.fulfilledQuantity, null);
  assert.deepEqual(row.ledger, { status: "NOT_APPLICABLE" });
  assert.equal(decodePrcCursor(undefined), null);
  assert.throws(() => decodePrcCursor("PRCS_bad"), /cursor/i);
});

test("timestamps from node-postgres keep milliseconds for display and cursors", async () => {
  const { isoTimestamp, nullableIsoTimestamp } = await import("../src/time.js");
  const fromDatabase = new Date("2026-10-15T11:45:02.722Z");
  assert.equal(isoTimestamp(fromDatabase), "2026-10-15T11:45:02.722Z");
  assert.equal(isoTimestamp("2026-10-15 11:45:02.722+00"), "2026-10-15T11:45:02.722Z");
  assert.equal(nullableIsoTimestamp(null), null);
  const row = presentRequest({ request_id: ID, requesting_institution_id: "INST_MEDIATRIX", institution_name: null, blood_type: "O_NEGATIVE", component_type: "PLATELETS", requested_quantity: 1, fulfilled_quantity: null, urgency: "ROUTINE", required_by: new Date("2026-10-16T08:00:00.500Z"), status: "SUBMITTED", prc_reference: null, decline_reason: null, submitted_at: fromDatabase, acknowledged_at: null, closed_at: null, version: 1 });
  assert.equal(row.submittedAt, "2026-10-15T11:45:02.722Z");
  assert.equal(row.requiredBy, "2026-10-16T08:00:00.500Z");
});
