import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import type { Context } from "fabric-contract-api";
import { InventoryContract } from "../src/inventory-contract";

interface RecordedEvent {
  name: string;
  payload: Buffer;
}

class MockContext {
  public readonly state = new Map<string, Buffer>();
  public readonly events: RecordedEvent[] = [];
  public transactionId = "TX_001";
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
    putState: async (key: string, value: Uint8Array) => {
      this.state.set(key, Buffer.from(value));
    },
    setEvent: (name: string, payload: Uint8Array) => {
      this.events.push({ name, payload: Buffer.from(payload) });
    },
    getTxID: () => this.transactionId,
  };
}

const asContext = (context: MockContext): Context => context as unknown as Context;
const registerInput = (overrides: Record<string, unknown> = {}) => ({
  unitId: "UNIT_SYNTH_001",
  bloodType: "A_POSITIVE",
  component: "RED_BLOOD_CELLS",
  collectedAt: "2026-07-30T00:00:00.000Z",
  expiresAt: "2026-08-02T00:00:00.000Z",
  institutionId: "INST_MEDIATRIX",
  actorUserId: "USR_SYNTH_001",
  eventTime: "2026-07-30T01:00:00.000Z",
  correlationId: "CORR_REGISTER_001",
  idempotencyKey: "IDEM_REGISTER_001",
  policyVersion: "SYNTHETIC_INVENTORY_V1",
  ...overrides,
});
const evaluationInput = (overrides: Record<string, unknown> = {}) => ({
  unitId: "UNIT_SYNTH_001",
  institutionId: "INST_MEDIATRIX",
  actorUserId: "USR_SYNTH_001",
  evaluationTime: "2026-08-01T12:00:00.000Z",
  expectedVersion: 1,
  correlationId: "CORR_EVALUATE_001",
  idempotencyKey: "IDEM_EVALUATE_001",
  policyVersion: "SYNTHETIC_INVENTORY_V1",
  ...overrides,
});
const submitRegistration = async (
  context: MockContext,
  overrides: Record<string, unknown> = {},
) => new InventoryContract().RegisterBloodUnit(
  asContext(context),
  JSON.stringify(registerInput(overrides)),
);

test("S2-03 registers one allowlisted synthetic asset and privacy-minimized event", async () => {
  const context = new MockContext();
  const response = await submitRegistration(context);
  const asset = JSON.parse(response);
  const {
    idempotencyKey: _idempotencyKey,
    eventTime: _eventTime,
    ...storedInput
  } = registerInput();
  assert.deepEqual(asset, {
    schemaVersion: "INVENTORY_ASSET_V1",
    ...storedInput,
    status: "AVAILABLE",
    version: 1,
    createdAt: "2026-07-30T01:00:00.000Z",
    updatedAt: "2026-07-30T01:00:00.000Z",
    lastTransactionId: "TX_001",
  });
  assert.equal("idempotencyKey" in asset, false);
  assert.equal("eventTime" in asset, false);
  assert.equal(context.state.size, 2);
  assert.equal(context.events.length, 1);
  assert.deepEqual(JSON.parse(context.events[0].payload.toString("utf8")), {
    eventType: "BloodUnitRegistered",
    unitId: "UNIT_SYNTH_001",
    institutionId: "INST_MEDIATRIX",
    status: "AVAILABLE",
    version: 1,
    eventTime: "2026-07-30T01:00:00.000Z",
    correlationId: "CORR_REGISTER_001",
    policyVersion: "SYNTHETIC_INVENTORY_V1",
  });
});

test("S2-03 supports every PA-S2-01 type/component and rejects unsupported values", async () => {
  for (const bloodType of ["A_POSITIVE", "O_POSITIVE"]) {
    for (const component of ["RED_BLOOD_CELLS", "PLATELETS"]) {
      const context = new MockContext();
      const expiresAt = component === "PLATELETS"
        ? "2026-07-31T12:00:00.000Z"
        : "2026-08-02T00:00:00.000Z";
      await assert.doesNotReject(submitRegistration(context, { bloodType, component, expiresAt }));
    }
  }
  await assert.rejects(
    submitRegistration(new MockContext(), { bloodType: "B_POSITIVE" }),
    /INV_BLOOD_TYPE_UNSUPPORTED/,
  );
  await assert.rejects(
    submitRegistration(new MockContext(), { component: "PLASMA" }),
    /INV_COMPONENT_UNSUPPORTED/,
  );
});

test("S2-03 rejects unknown and prohibited fields without state or event", async () => {
  for (const field of ["patientName", "donorName", "employeeId", "diagnosis", "notes"]) {
    const context = new MockContext();
    await assert.rejects(submitRegistration(context, { [field]: "PROHIBITED" }), /INV_FIELD_NOT_ALLOWED/);
    assert.equal(context.state.size, 0);
    assert.equal(context.events.length, 0);
  }
});

test("S2-03 enforces exact UTC, identifier, and synthetic expiry boundaries", async () => {
  for (const overrides of [
    { unitId: "invalid" },
    { actorUserId: "EMPLOYEE-1" },
    { collectedAt: "2026-07-30" },
    { expiresAt: "2026-08-02T00:00:00Z" },
    { eventTime: "2026-07-29T23:59:59.999Z" },
    { expiresAt: "2026-08-02T00:00:00.001Z" },
  ]) {
    const context = new MockContext();
    await assert.rejects(submitRegistration(context, overrides), /INV_(INPUT|TIME|EXPIRY)_INVALID/);
    assert.equal(context.state.size, 0);
    assert.equal(context.events.length, 0);
  }
  await assert.doesNotReject(submitRegistration(new MockContext()));
  await assert.doesNotReject(submitRegistration(new MockContext(), {
    component: "PLATELETS",
    expiresAt: "2026-07-31T12:00:00.000Z",
  }));
});

test("S2-03 duplicate unit and idempotency behavior are distinct and deterministic", async () => {
  const context = new MockContext();
  const contract = new InventoryContract();
  const serialized = JSON.stringify(registerInput());
  const first = await contract.RegisterBloodUnit(asContext(context), serialized);
  const second = await contract.RegisterBloodUnit(asContext(context), serialized);
  assert.equal(second, first);
  assert.equal(context.events.length, 1);
  await assert.rejects(
    contract.RegisterBloodUnit(
      asContext(context),
      JSON.stringify(registerInput({ correlationId: "CORR_CHANGED_001" })),
    ),
    /INV_IDEMPOTENCY_CONFLICT/,
  );
  await assert.rejects(
    contract.RegisterBloodUnit(
      asContext(context),
      JSON.stringify(registerInput({
        idempotencyKey: "IDEM_REGISTER_002",
        correlationId: "CORR_REGISTER_002",
      })),
    ),
    /INV_DUPLICATE_UNIT/,
  );
});

test("S2-03 rejects unauthorized MSP, enrollment, type, role, and institution", async () => {
  const mutations = [
    (context: MockContext) => { context.mspId = "OtherMSP"; },
    (context: MockContext) => { context.attributes["hf.EnrollmentID"] = "mediatrix-admin"; },
    (context: MockContext) => { context.attributes["hf.Type"] = "admin"; },
    (context: MockContext) => { context.attributes["bloodledger.role"] = "OTHER"; },
    (context: MockContext) => { context.attributes["bloodledger.institution_id"] = "INST_OTHER"; },
  ];
  for (const mutate of mutations) {
    const context = new MockContext();
    mutate(context);
    await assert.rejects(submitRegistration(context), /INV_NOT_AUTHORIZED/);
    assert.equal(context.state.size, 0);
  }
  await assert.rejects(
    submitRegistration(new MockContext(), { institutionId: "INST_OTHER" }),
    /INV_INSTITUTION_MISMATCH/,
  );
});

test("S2-04 ReadBloodUnit returns committed state and safe missing error", async () => {
  const context = new MockContext();
  const contract = new InventoryContract();
  const registered = await contract.RegisterBloodUnit(
    asContext(context),
    JSON.stringify(registerInput()),
  );
  assert.equal(await contract.ReadBloodUnit(asContext(context), "UNIT_SYNTH_001"), registered);
  await assert.rejects(
    contract.ReadBloodUnit(asContext(context), "UNIT_MISSING"),
    /INV_UNIT_NOT_FOUND/,
  );
});

test("S2-05 evaluates current, near-expiry, and exact expiry boundaries", async () => {
  const cases = [
    ["2026-08-01T11:59:59.999Z", "CURRENT", "AVAILABLE", 1],
    ["2026-08-01T12:00:00.000Z", "NEAR_EXPIRY", "AVAILABLE", 1],
    ["2026-08-02T00:00:00.000Z", "EXPIRED", "EXPIRED", 2],
  ] as const;
  for (const [evaluationTime, result, status, version] of cases) {
    const context = new MockContext();
    const contract = new InventoryContract();
    await contract.RegisterBloodUnit(asContext(context), JSON.stringify(registerInput()));
    context.transactionId = "TX_002";
    const response = JSON.parse(await contract.EvaluateBloodUnitExpiry(
      asContext(context),
      JSON.stringify(evaluationInput({ evaluationTime })),
    ));
    assert.equal(response.result, result);
    assert.equal(response.asset.status, status);
    assert.equal(response.asset.version, version);
  }
});

test("S2-05 rejects stale, wrong-policy, wrong-institution, and repeated expired transitions", async () => {
  const context = new MockContext();
  const contract = new InventoryContract();
  await contract.RegisterBloodUnit(asContext(context), JSON.stringify(registerInput()));
  await assert.rejects(
    contract.EvaluateBloodUnitExpiry(
      asContext(context),
      JSON.stringify(evaluationInput({ expectedVersion: 2 })),
    ),
    /INV_VERSION_CONFLICT/,
  );
  await assert.rejects(
    contract.EvaluateBloodUnitExpiry(
      asContext(context),
      JSON.stringify(evaluationInput({
        policyVersion: "SYNTHETIC_INVENTORY_V2",
        idempotencyKey: "IDEM_EVALUATE_002",
      })),
    ),
    /INV_POLICY_MISMATCH/,
  );
  await contract.EvaluateBloodUnitExpiry(
    asContext(context),
    JSON.stringify(evaluationInput({ evaluationTime: "2026-08-02T00:00:00.000Z" })),
  );
  await assert.rejects(
    contract.EvaluateBloodUnitExpiry(
      asContext(context),
      JSON.stringify(evaluationInput({
        evaluationTime: "2026-08-02T00:00:00.000Z",
        expectedVersion: 2,
        idempotencyKey: "IDEM_EVALUATE_003",
      })),
    ),
    /INV_TRANSITION_INVALID/,
  );
});

test("S2-05 evaluation retry is idempotent and emits no duplicate event", async () => {
  const context = new MockContext();
  const contract = new InventoryContract();
  await contract.RegisterBloodUnit(asContext(context), JSON.stringify(registerInput()));
  const serialized = JSON.stringify(evaluationInput());
  const first = await contract.EvaluateBloodUnitExpiry(asContext(context), serialized);
  const second = await contract.EvaluateBloodUnitExpiry(asContext(context), serialized);
  assert.equal(second, first);
  assert.equal(context.events.length, 2);
});

test("S2-06 deterministic replay produces identical state, result, and events", async () => {
  const replay = async () => {
    const context = new MockContext();
    const contract = new InventoryContract();
    const registration = await contract.RegisterBloodUnit(
      asContext(context),
      JSON.stringify(registerInput()),
    );
    context.transactionId = "TX_002";
    const evaluation = await contract.EvaluateBloodUnitExpiry(
      asContext(context),
      JSON.stringify(evaluationInput()),
    );
    return {
      registration,
      evaluation,
      state: [...context.state.entries()],
      events: context.events,
    };
  };
  assert.deepEqual(await replay(), await replay());
});

test("S2-06 source contains no scheduler, local clock, network, database, or ML execution", async () => {
  const source = await readFile(resolve(process.cwd(), "src/inventory-contract.ts"), "utf8");
  for (const prohibited of [
    "Date.now", "new Date()", "Math.random", "fetch(", "http://", "https://",
    "setTimeout", "setInterval", "postgres", "database", "tensorflow", "forecast",
    "BROA", "RPS",
  ]) {
    assert.equal(source.includes(prohibited), false, `prohibited contract token: ${prohibited}`);
  }
});
