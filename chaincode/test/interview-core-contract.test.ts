import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import type { Context } from "fabric-contract-api";
import { InterviewCoreContract } from "../src/interview-core-contract";
import developmentPolicy from "../policy/persistent-development-core-v1.json";
import v21Policy from "../policy/interview-core-v2-1.json";

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

const developmentVersion = "PERSISTENT_DEVELOPMENT_CORE_V1";
const retainedCoordinator = "USR_SYNTH_REVIEW_ROLE02";
const retainedRecipient = "USR_SYNTH_REVIEW_ROLE03";

function retainedTransfer(overrides: Record<string, unknown> = {}) {
  return { actorUserId: retainedRecipient, bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", correlationId: "CORR_RETAINED_REQUEST", destinationInstitutionId: "INST_SYNTH_SECONDARY_REVIEW", eventTime: "2026-09-02T00:00:00.000Z", idempotencyKey: "IDEM_RETAINED_REQUEST", policyVersion: developmentVersion, quantity: 1, requestTime: "2026-09-02T00:00:00.000Z", sourceInstitutionId: "INST_MEDIATRIX", transferId: "TRF_RETAINED_001", urgency: "ROUTINE", ...overrides };
}

test("FR-12 retained development policy adds exactly two actors without changing V2.1 rules", () => {
  const { policyVersion: newVersion, developmentActorIds, actors, ...rules } = developmentPolicy;
  const { policyVersion: oldVersion, actors: oldActors, ...oldRules } = v21Policy;
  assert.equal(newVersion, developmentVersion); assert.equal(oldVersion, "INTERVIEW_DERIVED_CORE_V2_1");
  assert.deepEqual(rules, oldRules);
  assert.deepEqual(Object.keys(actors).filter(id => !(id in oldActors)).sort(), [...developmentActorIds].sort());
  for (const [id, actor] of Object.entries(oldActors)) assert.deepEqual(actors[id as keyof typeof actors], actor);
});

test("FR-12 retained actors fail under old policies and retain role/institution denial", async () => {
  const contract = new InterviewCoreContract(); const context = new MockContext();
  const input = { ...component("COMP_RETAINED_001", "DON_RETAINED_001", digest("a"), "2026-09-10T00:00:00.000Z", "CRYOPRECIPITATE"), actorUserId: retainedCoordinator, policyVersion: developmentVersion };
  for (const old of ["INTERVIEW_DERIVED_CORE_V2", "INTERVIEW_DERIVED_CORE_V2_1"]) {
    await assert.rejects(register(contract, context, { ...input, policyVersion: old }), /CORE_NOT_AUTHORIZED/);
    await assert.rejects(contract.SubmitTransferRequest(asContext(context), JSON.stringify(retainedTransfer({ policyVersion: old }))), /CORE_NOT_AUTHORIZED/);
  }
  await assert.rejects(register(contract, context, { ...input, actorUserId: retainedRecipient }), /CORE_NOT_AUTHORIZED/);
  await assert.rejects(register(contract, context, { ...input, issuerInstitutionId: "INST_SYNTH_SECONDARY_REVIEW", custodyInstitutionId: "INST_SYNTH_SECONDARY_REVIEW" }), /CORE_NOT_AUTHORIZED/);
  for (const overrides of [{ actorUserId: retainedCoordinator }, { destinationInstitutionId: "INST_DIVINE_LOVE" }, { sourceInstitutionId: "INST_SYNTH_SECONDARY_REVIEW" }]) await assert.rejects(contract.SubmitTransferRequest(asContext(context), JSON.stringify(retainedTransfer(overrides))), /TRANSFER_NOT_AUTHORIZED/);
  await assert.rejects(contract.SubmitTransferRequest(asContext(context), JSON.stringify(retainedTransfer({ actorUserId: "USR_SYNTH_UNKNOWN" }))), /CORE_NOT_AUTHORIZED/);
  assert.equal(context.state.size, 0); assert.equal(context.events.length, 0);
});

test("NFR-02 retained policy inspection is read-only and enforces gateway identity", async () => {
  const contract = new InterviewCoreContract(); const context = new MockContext();
  const input = JSON.stringify({ actorUserId: retainedRecipient, policyVersion: developmentVersion });
  const actor = JSON.parse(await contract.ReadActorPolicy(asContext(context), input));
  assert.equal(actor.role, "ROLE_03"); assert.equal(actor.institutionId, "INST_SYNTH_SECONDARY_REVIEW");
  assert.equal(actor.policySha256, createHash("sha256").update(JSON.stringify(developmentPolicy)).digest("hex")); assert.equal(context.state.size, 0);
  context.mspId = "OTHER_MSP";
  await assert.rejects(contract.ReadActorPolicy(asContext(context), input), /CORE_NOT_AUTHORIZED/);
});

test("NFR-08 retained actor lifecycle and duplicate replay preserve identical state and events", async () => {
  const run = async () => {
    const contract = new InterviewCoreContract(); const context = new MockContext();
    const input = { ...component("COMP_RETAINED_001", "DON_RETAINED_001", digest("a"), "2026-09-10T00:00:00.000Z", "CRYOPRECIPITATE"), actorUserId: retainedCoordinator, policyVersion: developmentVersion };
    await register(contract, context, input); const before = context.state.size;
    await register(contract, context, input); assert.equal(context.state.size, before);
    const transfer = JSON.stringify(retainedTransfer());
    assert.equal(await contract.SubmitTransferRequest(asContext(context), transfer), await contract.SubmitTransferRequest(asContext(context), transfer));
    await contract.ReserveComponents(asContext(context), JSON.stringify(reservation("RES_RETAINED_001", [input.componentId], [1], "TRANSFER", { actorUserId: retainedCoordinator, policyVersion: developmentVersion, componentType: "CRYOPRECIPITATE", destinationInstitutionId: "INST_SYNTH_SECONDARY_REVIEW" })));
    await contract.PrepareReservation(asContext(context), JSON.stringify(action("RES_RETAINED_001", 1, retainedCoordinator, { policyVersion: developmentVersion, preparedAt: "2026-09-02T00:10:00.000Z", preparedEvidenceDigest: digest("b"), preparedEvidenceId: "EVD_RETAINED_001" })));
    await contract.DispatchReservation(asContext(context), JSON.stringify(action("RES_RETAINED_001", 2, retainedCoordinator, { policyVersion: developmentVersion })));
    await contract.StartReservationTransit(asContext(context), JSON.stringify(action("RES_RETAINED_001", 3, retainedCoordinator, { policyVersion: developmentVersion })));
    const asset = JSON.parse(await contract.ReadComponent(asContext(context), JSON.stringify({ actorUserId: retainedRecipient, componentId: input.componentId })));
    assert.equal(asset.status, "IN_TRANSIT"); assert.equal(asset.policyVersion, developmentVersion);
    await assert.rejects(contract.ReadComponent(asContext(context), JSON.stringify({ actorUserId: "USR_DIVINE_LOVE", componentId: input.componentId })), /COMPONENT_NOT_AUTHORIZED/);
    return { state: [...context.state].map(([key, bytes]) => [key, bytes.toString("utf8")]), events: context.events.map(event => [event.name, event.payload.toString("utf8")]) };
  };
  assert.deepEqual(await run(), await run());
});

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
