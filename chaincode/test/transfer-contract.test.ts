import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "fabric-contract-api";
import { InventoryContract } from "../src/inventory-contract";
import { TransferContract } from "../src/transfer-contract";

class MockContext {
  public readonly state = new Map<string, Buffer>();
  public readonly events: Array<{ name: string; payload: Buffer }> = [];
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
    getStateByRange: async (startKey: string, endKey: string) => {
      const entries = [...this.state.entries()]
        .filter(([key]) => key >= startKey && key < endKey)
        .sort(([left], [right]) => left.localeCompare(right));
      let index = 0;
      return {
        next: async () => index >= entries.length
          ? { done: true }
          : {
              done: false,
              value: { key: entries[index]?.[0], value: entries[index++]?.[1] ?? Buffer.alloc(0) },
            },
        close: async () => undefined,
      };
    },
  };
}

const asContext = (context: MockContext): Context => context as unknown as Context;
const transferPolicyVersion = "SYNTHETIC_TRANSFER_V1";
const inventoryPolicyVersion = "SYNTHETIC_INVENTORY_V1";

function registration(unitId: string, expiresAt: string, suffix: string) {
  return {
    unitId,
    bloodType: "A_POSITIVE",
    component: "RED_BLOOD_CELLS",
    collectedAt: "2026-08-12T00:00:00.000Z",
    expiresAt,
    institutionId: "INST_MEDIATRIX",
    actorUserId: "USR_MEDIATRIX_TECH",
    eventTime: "2026-08-12T01:00:00.000Z",
    correlationId: `CORR_REGISTER_${suffix}`,
    idempotencyKey: `IDEM_REGISTER_${suffix}`,
    policyVersion: inventoryPolicyVersion,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    transferId: "TRF_SPRINT3_001",
    sourceInstitutionId: "INST_MEDIATRIX",
    destinationInstitutionId: "INST_METRO_LIPA",
    bloodType: "A_POSITIVE",
    component: "RED_BLOOD_CELLS",
    quantity: 2,
    urgency: "URGENT",
    requestTime: "2026-08-13T00:00:00.000Z",
    actorUserId: "USR_METRO_LIPA",
    eventTime: "2026-08-13T00:05:00.000Z",
    correlationId: "CORR_TRANSFER_SUBMIT_001",
    idempotencyKey: "IDEM_TRANSFER_SUBMIT_001",
    policyVersion: transferPolicyVersion,
    inventoryPolicyVersion,
    ...overrides,
  };
}

function approval(overrides: Record<string, unknown> = {}) {
  return {
    transferId: "TRF_SPRINT3_001",
    selectedUnitIds: ["UNIT_FEFO_001", "UNIT_FEFO_002"],
    actorUserId: "USR_MEDIATRIX_ADMIN",
    eventTime: "2026-08-13T00:10:00.000Z",
    expectedVersion: 1,
    correlationId: "CORR_TRANSFER_APPROVE_001",
    idempotencyKey: "IDEM_TRANSFER_APPROVE_001",
    policyVersion: transferPolicyVersion,
    inventoryPolicyVersion,
    ...overrides,
  };
}

function basic(
  actorUserId: string,
  expectedVersion: number,
  suffix: string,
  eventTime: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    transferId: "TRF_SPRINT3_001",
    actorUserId,
    eventTime,
    expectedVersion,
    correlationId: `CORR_${suffix}`,
    idempotencyKey: `IDEM_${suffix}`,
    policyVersion: transferPolicyVersion,
    ...overrides,
  };
}

function location(phase: "DISPATCH" | "RECEIPT", digestCharacter: string, capturedAt: string) {
  return {
    evidenceId: `LOC_${phase}_001`,
    evidenceDigest: digestCharacter.repeat(64),
    phase,
    capturedAt,
    source: "DEVICE",
    facilityMatched: true,
    fallback: false,
    policyVersion: "SYNTHETIC_LOCATION_V1",
  };
}

async function setup(quantity = 2): Promise<{ context: MockContext; inventory: InventoryContract; transfer: TransferContract }> {
  const context = new MockContext();
  const inventory = new InventoryContract();
  const transfer = new TransferContract();
  const units = [
    ["UNIT_FEFO_003", "2026-08-15T00:00:00.000Z", "003"],
    ["UNIT_FEFO_001", "2026-08-14T00:00:00.000Z", "001"],
    ["UNIT_FEFO_002", "2026-08-14T00:00:00.000Z", "002"],
  ];
  for (const [unitId, expiresAt, suffix] of units) {
    await inventory.RegisterBloodUnit(
      asContext(context),
      JSON.stringify(registration(unitId ?? "", expiresAt ?? "", suffix ?? "")),
    );
  }
  await transfer.SubmitTransferRequest(asContext(context), JSON.stringify(submission({ quantity })));
  return { context, inventory, transfer };
}

async function state(context: MockContext, key: string): Promise<Record<string, unknown>> {
  return JSON.parse((context.state.get(key) ?? Buffer.alloc(0)).toString("utf8")) as Record<string, unknown>;
}

test("S3-07 approves exact FEFO units atomically and records no recommendation approval", async () => {
  const { context, transfer } = await setup();
  const approved = JSON.parse(await transfer.ApproveTransfer(
    asContext(context), JSON.stringify(approval({ recommendationDigest: "a".repeat(64) })),
  ));
  assert.equal(approved.status, "APPROVED");
  assert.deepEqual(approved.selectedUnitIds, ["UNIT_FEFO_001", "UNIT_FEFO_002"]);
  assert.equal(approved.recommendationDigest, "a".repeat(64));
  assert.equal("automaticApproval" in approved, false);
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_001")).status, "RESERVED");
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_002")).status, "RESERVED");
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_003")).status, "AVAILABLE");
});

test("S3-07 rejects FEFO violations and insufficient stock without reserving units", async () => {
  const first = await setup();
  await assert.rejects(
    first.transfer.ApproveTransfer(
      asContext(first.context),
      JSON.stringify(approval({ selectedUnitIds: ["UNIT_FEFO_002", "UNIT_FEFO_003"] })),
    ),
    /TRF_FEFO_VIOLATION/,
  );
  assert.equal((await state(first.context, "inventory:unit:UNIT_FEFO_001")).status, "AVAILABLE");

  const second = await setup(4);
  await assert.rejects(
    second.transfer.ApproveTransfer(
      asContext(second.context),
      JSON.stringify(approval({
        selectedUnitIds: ["UNIT_FEFO_001", "UNIT_FEFO_002", "UNIT_FEFO_003", "UNIT_FEFO_004"],
      })),
    ),
    /TRF_INSUFFICIENT_STOCK/,
  );
  assert.equal((await state(second.context, "inventory:unit:UNIT_FEFO_001")).status, "AVAILABLE");
});

test("S3-07 follows dispatch, transit, delay, resume, and receipt custody transitions", async () => {
  const { context, transfer } = await setup();
  await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
  await transfer.RecordDispatch(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_TECH", 2, "DISPATCH_001", "2026-08-13T00:20:00.000Z",
    { locationEvidence: location("DISPATCH", "b", "2026-08-13T00:19:00.000Z") },
  )));
  await transfer.StartTransit(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_TECH", 3, "TRANSIT_001", "2026-08-13T00:30:00.000Z",
  )));
  await transfer.MarkTransferDelayed(asContext(context), JSON.stringify(basic(
    "USR_METRO_LIPA", 4, "DELAY_001", "2026-08-13T00:40:00.000Z",
    { reasonCode: "ROUTE_DELAY" },
  )));
  await transfer.ResumeTransfer(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_ADMIN", 5, "RESUME_001", "2026-08-13T00:50:00.000Z",
  )));
  const received = JSON.parse(await transfer.RecordReceipt(asContext(context), JSON.stringify(basic(
    "USR_METRO_LIPA", 6, "RECEIPT_001", "2026-08-13T01:00:00.000Z",
    { locationEvidence: location("RECEIPT", "c", "2026-08-13T00:59:00.000Z") },
  ))));
  assert.equal(received.status, "RECEIVED");
  assert.equal("latitude" in received.receiptEvidence, false);
  for (const unitId of ["UNIT_FEFO_001", "UNIT_FEFO_002"]) {
    const unit = await state(context, `inventory:unit:${unitId}`);
    assert.equal(unit.status, "RECEIVED");
    assert.equal(unit.institutionId, "INST_METRO_LIPA");
  }
});

test("S3-07 releases reservations on cancellation and prevents stale transitions", async () => {
  const { context, transfer } = await setup();
  await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
  await assert.rejects(
    transfer.StartTransit(asContext(context), JSON.stringify(basic(
      "USR_MEDIATRIX_ADMIN", 1, "STALE_001", "2026-08-13T00:20:00.000Z",
    ))),
    /TRF_VERSION_CONFLICT/,
  );
  await transfer.CancelTransfer(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_ADMIN", 2, "CANCEL_001", "2026-08-13T00:20:00.000Z",
    { reasonCode: "REQUEST_WITHDRAWN" },
  )));
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_001")).status, "AVAILABLE");
  assert.equal((await state(context, "transfer:asset:TRF_SPRINT3_001")).status, "CANCELLED");
});

test("S3-07 is idempotent, detects conflicting replay, and rejects unauthorized actors", async () => {
  const { context, transfer } = await setup();
  const serialized = JSON.stringify(approval());
  const first = await transfer.ApproveTransfer(asContext(context), serialized);
  assert.equal(await transfer.ApproveTransfer(asContext(context), serialized), first);
  await assert.rejects(
    transfer.ApproveTransfer(asContext(context), JSON.stringify(approval({ correlationId: "CORR_CHANGED_001" }))),
    /TRF_IDEMPOTENCY_CONFLICT/,
  );
  await assert.rejects(
    transfer.MarkTransferDelayed(asContext(context), JSON.stringify(basic(
      "USR_DIVINE_LOVE", 2, "DELAY_BAD_SCOPE", "2026-08-13T00:20:00.000Z",
      { reasonCode: "ROUTE_DELAY" },
    ))),
    /TRF_TRANSITION_INVALID|TRF_NOT_AUTHORIZED/,
  );
  await assert.rejects(
    transfer.SubmitTransferRequest(asContext(context), JSON.stringify(submission({
      transferId: "TRF_PROHIBITED_001",
      idempotencyKey: "IDEM_TEST",
      patientName: "PROHIBITED",
    }))),
    /TRF_FIELD_NOT_ALLOWED/,
  );
});

test("S3-07 expiry cancels an approved transfer and releases sibling reservations", async () => {
  const { context, inventory, transfer } = await setup();
  await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
  await inventory.EvaluateBloodUnitExpiry(asContext(context), JSON.stringify({
    unitId: "UNIT_FEFO_001",
    institutionId: "INST_MEDIATRIX",
    actorUserId: "USR_MEDIATRIX_TECH",
    evaluationTime: "2026-08-14T00:00:00.000Z",
    expectedVersion: 2,
    correlationId: "CORR_EXPIRY_TRANSFER_001",
    idempotencyKey: "IDEM_EXPIRY_TRANSFER_001",
    policyVersion: inventoryPolicyVersion,
  }));
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_001")).status, "EXPIRED");
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_002")).status, "AVAILABLE");
  const changedTransfer = await state(context, "transfer:asset:TRF_SPRINT3_001");
  assert.equal(changedTransfer.status, "CANCELLED");
  assert.equal(changedTransfer.reasonCode, "RESERVED_UNIT_EXPIRED");
});

test("S3-07 rejects future location evidence and non-monotonic lifecycle time", async () => {
  const { context, transfer } = await setup();
  await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
  await assert.rejects(
    transfer.RecordDispatch(asContext(context), JSON.stringify(basic(
      "USR_MEDIATRIX_TECH", 2, "DISPATCH_FUTURE", "2026-08-13T00:20:00.000Z",
      { locationEvidence: location("DISPATCH", "d", "2026-08-13T00:21:00.000Z") },
    ))),
    /TRF_LOCATION_INVALID/,
  );
  await assert.rejects(
    transfer.CancelTransfer(asContext(context), JSON.stringify(basic(
      "USR_MEDIATRIX_ADMIN", 2, "CANCEL_PAST", "2026-08-13T00:01:00.000Z",
      { reasonCode: "REQUEST_WITHDRAWN" },
    ))),
    /TRF_TIME_INVALID/,
  );
});

test("S3-07 rejects a pending request without reserving inventory", async () => {
  const { context, transfer } = await setup();
  const rejected = JSON.parse(await transfer.RejectTransfer(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_ADMIN", 1, "REJECT_001", "2026-08-13T00:10:00.000Z",
    { reasonCode: "REQUEST_NOT_APPROVED" },
  ))));
  assert.equal(rejected.status, "REJECTED");
  assert.deepEqual(rejected.selectedUnitIds, []);
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_001")).status, "AVAILABLE");
});

test("S3-07 enforces actor scope and marks in-transit custody compromised", async () => {
  const { context, transfer } = await setup();
  await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
  await transfer.RecordDispatch(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_TECH", 2, "DISPATCH_SCOPE", "2026-08-13T00:20:00.000Z",
    { locationEvidence: location("DISPATCH", "e", "2026-08-13T00:19:00.000Z") },
  )));
  await transfer.StartTransit(asContext(context), JSON.stringify(basic(
    "USR_MEDIATRIX_TECH", 3, "TRANSIT_SCOPE", "2026-08-13T00:30:00.000Z",
  )));
  await assert.rejects(
    transfer.MarkTransferDelayed(asContext(context), JSON.stringify(basic(
      "USR_DIVINE_LOVE", 4, "DELAY_WRONG_DEST", "2026-08-13T00:40:00.000Z",
      { reasonCode: "ROUTE_DELAY" },
    ))),
    /TRF_NOT_AUTHORIZED/,
  );
  const compromised = JSON.parse(await transfer.MarkTransferCompromised(
    asContext(context),
    JSON.stringify(basic(
      "USR_METRO_LIPA", 4, "COMPROMISE_001", "2026-08-13T00:40:00.000Z",
      { reasonCode: "CUSTODY_EXCEPTION" },
    )),
  ));
  assert.equal(compromised.status, "COMPROMISED");
  assert.equal((await state(context, "inventory:unit:UNIT_FEFO_001")).status, "COMPROMISED");
});

test("S3-07 deterministic transfer replay produces identical state and events", async () => {
  const replay = async () => {
    const { context, transfer } = await setup();
    const result = await transfer.ApproveTransfer(asContext(context), JSON.stringify(approval()));
    return {
      result,
      state: [...context.state.entries()].sort(([left], [right]) => left.localeCompare(right)),
      events: context.events,
    };
  };
  assert.deepEqual(await replay(), await replay());
});
