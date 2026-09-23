import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "fabric-contract-api";
import { InterviewCoreContract } from "../src/interview-core-contract";

class MockContext {
  public readonly state = new Map<string, Buffer>();
  public readonly events: Array<{ name: string; payload: Buffer }> = [];
  public transactionId = "TX_CORE_001";
  public readonly attributes: Record<string, string> = {
    "hf.EnrollmentID": "api-gateway",
    "hf.Type": "client",
    "bloodledger.role": "API_GATEWAY",
    "bloodledger.institution_id": "INST_MEDIATRIX",
  };
  public mspId = "MediatrixMSP";
  public readonly clientIdentity = {
    getMSPID: () => this.mspId,
    getAttributeValue: (name: string) => this.attributes[name] ?? null,
  };
  public readonly stub = {
    getState: async (key: string) => this.state.get(key) ?? Buffer.alloc(0),
    putState: async (key: string, value: Uint8Array) => { this.state.set(key, Buffer.from(value)); },
    setEvent: (name: string, payload: Uint8Array) => { this.events.push({ name, payload: Buffer.from(payload) }); },
    getTxID: () => this.transactionId,
    getStateByRange: async (startKey: string, endKey: string) => {
      const entries = [...this.state.entries()].filter(([key]) => key >= startKey && key < endKey).sort(([a], [b]) => a.localeCompare(b));
      let index = 0;
      return {
        next: async () => index >= entries.length ? { done: true } : { done: false, value: { key: entries[index]?.[0], value: entries[index++]?.[1] ?? Buffer.alloc(0) } },
        close: async () => undefined,
      };
    },
  };
}

const asContext = (value: MockContext): Context => value as unknown as Context;
const policyVersion = "INTERVIEW_DERIVED_CORE_V2";
const digest = (character: string) => character.repeat(64);

function component(id: string, donation: string, donationDigest: string, expiry: string, type = "PACKED_RED_BLOOD_CELLS") {
  return {
    componentId: id,
    donationId: donation,
    issuerInstitutionId: "INST_MEDIATRIX",
    donationNoDigest: donationDigest,
    componentType: type,
    bloodType: "A_POSITIVE",
    collectedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: expiry,
    custodyInstitutionId: "INST_MEDIATRIX",
    actorUserId: "USR_MEDIATRIX_TECH",
    eventTime: "2026-09-01T01:00:00.000Z",
    correlationId: `CORR_${id}`,
    idempotencyKey: `IDEM_${id}`,
    policyVersion,
  };
}

async function register(contract: InterviewCoreContract, context: MockContext, value: ReturnType<typeof component>): Promise<void> {
  await contract.RegisterComponent(asContext(context), JSON.stringify(value));
}

function reservation(id: string, selected: string[], versions: number[], purpose: "TRANSFER" | "LOCAL_RELEASE" = "TRANSFER", overrides: Record<string, unknown> = {}) {
  return {
    reservationId: id,
    purpose,
    sourceInstitutionId: "INST_MEDIATRIX",
    destinationInstitutionId: purpose === "TRANSFER" ? "INST_METRO_LIPA" : null,
    bloodType: "A_POSITIVE",
    componentType: "PACKED_RED_BLOOD_CELLS",
    quantity: selected.length,
    selectedComponentIds: selected,
    expectedComponentVersions: versions,
    actorUserId: purpose === "TRANSFER" ? "USR_MEDIATRIX_TECH" : "USR_MEDIATRIX_ADMIN",
    eventTime: "2026-09-02T00:00:00.000Z",
    correlationId: `CORR_${id}`,
    idempotencyKey: `IDEM_${id}`,
    policyVersion,
    ...overrides,
  };
}

function action(reservationId: string, expectedVersion: number, actorUserId = "USR_MEDIATRIX_TECH", overrides: Record<string, unknown> = {}) {
  return {
    reservationId,
    expectedVersion,
    actorUserId,
    eventTime: "2026-09-02T00:10:00.000Z",
    correlationId: `CORR_ACTION_${reservationId}`,
    idempotencyKey: `IDEM_ACTION_${reservationId}_${expectedVersion}`,
    policyVersion,
    ...overrides,
  };
}

async function read(context: MockContext, key: string): Promise<Record<string, unknown>> {
  return JSON.parse((context.state.get(key) ?? Buffer.alloc(0)).toString("utf8")) as Record<string, unknown>;
}

test("registers opaque components, supports all eight blood groups, and rejects Whole Blood mixing", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  await register(contract, context, component("COMP_CORE_001", "DON_CORE_001", digest("a"), "2026-09-10T00:00:00.000Z", "WHOLE_BLOOD"));
  await assert.rejects(register(contract, context, component("COMP_CORE_002", "DON_CORE_001", digest("a"), "2026-09-10T00:00:00.000Z", "PLATELETS")), /COMPONENT_WHOLE_BLOOD_EXCLUSIVE/);
  const state = await read(context, "component:asset:COMP_CORE_001");
  assert.equal(state.status, "AVAILABLE");
  assert.equal("donationNumber" in state, false);
  const other = component("COMP_CORE_003", "DON_CORE_003", digest("b"), "2026-09-10T00:00:00.000Z");
  other.bloodType = "O_NEGATIVE";
  await register(contract, context, other);
  assert.equal((await read(context, "component:asset:COMP_CORE_003")).bloodType, "O_NEGATIVE");
});

test("accepts cryoprecipitate only under the additive V2.1 policy", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  const input = { ...component("COMP_CORE_V21_001", "DON_CORE_V21_001", digest("e"), "2026-09-10T00:00:00.000Z", "CRYOPRECIPITATE"), policyVersion: "INTERVIEW_DERIVED_CORE_V2_1" };
  await register(contract, context, input);
  const state = await read(context, "component:asset:COMP_CORE_V21_001");
  assert.equal(state.componentType, "CRYOPRECIPITATE");
  assert.equal(state.policyVersion, "INTERVIEW_DERIVED_CORE_V2_1");
  await assert.rejects(register(contract, context, { ...component("COMP_CORE_V21_002", "DON_CORE_V21_002", digest("f"), "2026-09-10T00:00:00.000Z", "CRYOPRECIPITATE"), policyVersion }), /COMPONENT_TYPE_UNSUPPORTED/);
});

test("registers OCR inbound stock with separate issuer/custody and no raw Donation No.", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  const input = { actorInstitutionId: "INST_MEDIATRIX", actorUserId: "USR_MEDIATRIX_TECH", bloodType: "AB_NEGATIVE", bloodTypeEvidenceSource: "OCR_LABEL", captureEvidenceDigest: digest("c"), captureMethod: "OCR", componentEvidenceSource: "BAG_TYPE", componentId: "COMP_INBOUND_001", componentType: "FRESH_FROZEN_PLASMA", correlationId: "CORR_INBOUND_000000000000000000000001", custodyInstitutionId: "INST_MEDIATRIX", donationId: "DON_INBOUND_001", donationNoDigest: digest("d"), eventTime: "2026-09-12T00:01:00.000Z", expiresAt: "2027-09-12T00:00:00.000Z", idempotencyKey: "IDEM_INBOUND_001", issuerInstitutionId: "INST_MEDIATRIX", policyVersion, collectedAt: "2026-09-11T00:00:00.000Z" };
  await contract.RegisterInboundComponent(asContext(context), JSON.stringify(input));
  const state = await read(context, "component:asset:COMP_INBOUND_001");
  assert.equal(state.status, "AVAILABLE"); assert.equal(state.custodyInstitutionId, "INST_MEDIATRIX"); assert.equal(state.captureMethod, "OCR"); assert.equal("donationNumber" in state, false);
  await assert.rejects(contract.RegisterInboundComponent(asContext(context), JSON.stringify({ ...input, componentId: "COMP_INBOUND_002", idempotencyKey: "IDEM_INBOUND_002" })), /COMPONENT_DUPLICATE_DONATION_TYPE/);
});

test("reserves exact FEFO components atomically and requires preparation before dispatch", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  await register(contract, context, component("COMP_CORE_011", "DON_CORE_011", digest("c"), "2026-09-05T00:00:00.000Z"));
  await register(contract, context, component("COMP_CORE_012", "DON_CORE_012", digest("d"), "2026-09-06T00:00:00.000Z"));
  await assert.rejects(contract.ReserveComponents(asContext(context), JSON.stringify(reservation("RES_CORE_011", ["COMP_CORE_012"], [1]))), /RESERVATION_FEFO_VIOLATION/);
  await contract.ReserveComponents(asContext(context), JSON.stringify(reservation("RES_CORE_012", ["COMP_CORE_011"], [1])));
  assert.equal((await read(context, "component:asset:COMP_CORE_011")).status, "RESERVED");
  await assert.rejects(contract.DispatchReservation(asContext(context), JSON.stringify(action("RES_CORE_012", 1))), /RELEASE_PREPARATION_REQUIRED/);
  await contract.PrepareReservation(asContext(context), JSON.stringify(action("RES_CORE_012", 1, "USR_MEDIATRIX_TECH", { preparedEvidenceDigest: digest("e"), preparedEvidenceId: "EVD_PREP_012", preparedAt: "2026-09-02T00:05:00.000Z" })));
  await contract.DispatchReservation(asContext(context), JSON.stringify(action("RES_CORE_012", 2)));
  assert.equal((await read(context, "reservation:asset:RES_CORE_012")).status, "DISPATCHED");
  assert.equal((await read(context, "component:asset:COMP_CORE_011")).status, "DISPATCHED");
});

test("completes a prepared local release and leaves terminal RELEASED stock unavailable", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  await register(contract, context, component("COMP_CORE_021", "DON_CORE_021", digest("f"), "2026-09-05T00:00:00.000Z"));
  await contract.ReserveComponents(asContext(context), JSON.stringify(reservation("RES_CORE_021", ["COMP_CORE_021"], [1], "LOCAL_RELEASE")));
  await contract.PrepareReservation(asContext(context), JSON.stringify(action("RES_CORE_021", 1, "USR_MEDIATRIX_ADMIN", { preparedEvidenceDigest: digest("1"), preparedEvidenceId: "EVD_PREP_021", preparedAt: "2026-09-02T00:05:00.000Z" })));
  await contract.CompleteLocalRelease(asContext(context), JSON.stringify(action("RES_CORE_021", 2, "USR_MEDIATRIX_ADMIN")));
  assert.equal((await read(context, "component:asset:COMP_CORE_021")).status, "RELEASED");
  assert.equal((await read(context, "reservation:asset:RES_CORE_021")).status, "COMPLETED");
});

test("places and resolves reconciliation holds with stale-version protection", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  await register(contract, context, component("COMP_CORE_031", "DON_CORE_031", digest("2"), "2026-09-05T00:00:00.000Z"));
  await assert.rejects(contract.PlaceReconciliationHold(asContext(context), JSON.stringify({ componentId: "COMP_CORE_031", caseId: "RECON_CORE_INVALID", reasonCode: "FREE_TEXT", expectedVersion: 1, actorUserId: "USR_MEDIATRIX_ADMIN", eventTime: "2026-09-02T00:00:00.000Z", correlationId: "CORR_HOLD_INVALID", idempotencyKey: "IDEM_HOLD_INVALID", policyVersion })), /RECONCILIATION_REASON_INVALID/);
  await contract.PlaceReconciliationHold(asContext(context), JSON.stringify({ componentId: "COMP_CORE_031", caseId: "RECON_CORE_031", reasonCode: "STATUS_MISMATCH", expectedVersion: 1, actorUserId: "USR_MEDIATRIX_ADMIN", eventTime: "2026-09-02T00:00:00.000Z", correlationId: "CORR_HOLD_031", idempotencyKey: "IDEM_HOLD_031", policyVersion }));
  await assert.rejects(contract.ResolveReconciliationHold(asContext(context), JSON.stringify({ componentId: "COMP_CORE_031", caseId: "RECON_CORE_031", resolutionCode: "VERIFIED_AVAILABLE", expectedVersion: 1, actorUserId: "USR_MEDIATRIX_ADMIN", eventTime: "2026-09-02T00:10:00.000Z", correlationId: "CORR_RESOLVE_031", idempotencyKey: "IDEM_RESOLVE_031", policyVersion })), /COMPONENT_VERSION_CONFLICT/);
  await contract.ResolveReconciliationHold(asContext(context), JSON.stringify({ componentId: "COMP_CORE_031", caseId: "RECON_CORE_031", resolutionCode: "VERIFIED_AVAILABLE", expectedVersion: 2, actorUserId: "USR_MEDIATRIX_ADMIN", eventTime: "2026-09-02T00:10:00.000Z", correlationId: "CORR_RESOLVE_032", idempotencyKey: "IDEM_RESOLVE_032", policyVersion }));
  assert.equal((await read(context, "component:asset:COMP_CORE_031")).status, "AVAILABLE");
});

test("marks only label-expired components expired and rejects wrong institution actors", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  await register(contract, context, component("COMP_CORE_041", "DON_CORE_041", digest("3"), "2026-09-05T00:00:00.000Z"));
  await assert.rejects(contract.EvaluateComponentExpiry(asContext(context), JSON.stringify({ componentId: "COMP_CORE_041", expectedVersion: 1, evaluationTime: "2026-09-02T00:00:00.000Z", actorUserId: "USR_METRO_LIPA", eventTime: "2026-09-02T00:01:00.000Z", correlationId: "CORR_EXP_041", idempotencyKey: "IDEM_EXP_041", policyVersion })), /CORE_NOT_AUTHORIZED/);
  await contract.EvaluateComponentExpiry(asContext(context), JSON.stringify({ componentId: "COMP_CORE_041", expectedVersion: 1, evaluationTime: "2026-09-06T00:00:00.000Z", actorUserId: "USR_MEDIATRIX_TECH", eventTime: "2026-09-06T00:01:00.000Z", correlationId: "CORR_EXP_042", idempotencyKey: "IDEM_EXP_042", policyVersion }));
  assert.equal((await read(context, "component:asset:COMP_CORE_041")).status, "EXPIRED");
});

test("accepts a recipient transfer request without putting Donation No. on Fabric", async () => {
  const context = new MockContext();
  const contract = new InterviewCoreContract();
  const request = { transferId: "TRF_CORE_051", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "O_NEGATIVE", componentType: "PLATELETS", quantity: 1, urgency: "URGENT", requestTime: "2026-09-02T00:00:00.000Z", actorUserId: "USR_METRO_LIPA", eventTime: "2026-09-02T00:01:00.000Z", correlationId: "CORR_TRANSFER_CORE_051", idempotencyKey: "IDEM_TRANSFER_CORE_051", policyVersion };
  const result = JSON.parse(await contract.SubmitTransferRequest(asContext(context), JSON.stringify(request))) as Record<string, unknown>;
  assert.equal(result.status, "PENDING");
  assert.equal("donationNumber" in result, false);
  assert.equal(JSON.parse((context.state.get("transfer:v2:asset:TRF_CORE_051") ?? Buffer.alloc(0)).toString("utf8")).status, "PENDING");
});


test("compromise reason policy quarantines each supported incident and rejects invalid or stale transitions", async () => {
  const codes = ["TEMPERATURE_EXCURSION_REPORTED", "CONTAINER_DAMAGE_OR_LEAK_REPORTED", "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", "HANDLING_OR_CUSTODY_DEVIATION_REPORTED"];
  for (const [index, code] of codes.entries()) {
    const context = new MockContext(); const contract = new InterviewCoreContract();
    const componentId = `COMP_COMPROMISE_${index}`; const reservationId = `RES_COMPROMISE_${index}`;
    await register(contract,context,component(componentId,`DON_COMPROMISE_${index}`,digest(String(index)),"2026-10-01T00:00:00.000Z"));
    await contract.ReserveComponents(asContext(context),JSON.stringify(reservation(reservationId,[componentId],[1])));
    await contract.PrepareReservation(asContext(context),JSON.stringify(action(reservationId,1,"USR_MEDIATRIX_TECH",{preparedEvidenceDigest:digest("e"),preparedEvidenceId:`EVD_COMPROMISE_${index}`,preparedAt:"2026-09-02T00:05:00.000Z"})));
    await contract.DispatchReservation(asContext(context),JSON.stringify(action(reservationId,2)));
    const input=action(reservationId,3,"USR_MEDIATRIX_TECH",{reasonCode:code,idempotencyKey:`IDEM_COMPROMISE_${index}`});
    await assert.rejects(contract.MarkReservationCompromised(asContext(context),JSON.stringify({...input,reasonCode:"FREE_TEXT"})),/COMPROMISE_REASON_INVALID/);
    await assert.rejects(contract.MarkReservationCompromised(asContext(context),JSON.stringify({...input,actorUserId:"USR_DIVINE_LOVE"})),/RESERVATION_NOT_AUTHORIZED/);
    await assert.rejects(contract.MarkReservationCompromised(asContext(context),JSON.stringify({...input,expectedVersion:2})),/RESERVATION_VERSION_CONFLICT/);
    assert.equal((await read(context,`component:asset:${componentId}`)).status,"DISPATCHED");
    const first=await contract.MarkReservationCompromised(asContext(context),JSON.stringify(input));
    assert.equal(await contract.MarkReservationCompromised(asContext(context),JSON.stringify(input)),first);
    const held=await read(context,`reservation:asset:${reservationId}`);
    assert.equal(held.status,"COMPROMISED"); assert.equal(held.compromiseReasonCode,code); assert.equal(held.compromisePolicyVersion,"SYNTHETIC_COMPROMISE_REASONS_V1");
    assert.equal((await read(context,`component:asset:${componentId}`)).status,"COMPROMISED");
    await assert.rejects(contract.MarkReservationCompromised(asContext(context),JSON.stringify({...input,idempotencyKey:`IDEM_COMPROMISE_REPEAT_${index}`,expectedVersion:4})),/RESERVATION_TRANSITION_INVALID/);
  }
});
