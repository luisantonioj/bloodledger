import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import { V2CommandWorker } from "../src/v2-worker.js";

const base = { commandId: "CMD_CORE_001", idempotencyKey: "IDEM_CORE_001", resourceType: "COMPONENT" as const, resourceId: "COMP_CORE_001", operation: "REGISTER_COMPONENT", payload: { componentId: "COMP_CORE_001", correlationId: "CORR_00000000000000000000000000000001" }, correlationId: "CORR_00000000000000000000000000000001", actorUserId: "USR_MEDIATRIX_TECH", actorInstitutionId: "INST_MEDIATRIX", acceptedAt: "2026-09-12T00:00:00.000Z" };

test("queues idempotently and exposes a safe command state machine", async () => {
  const store = new InMemoryV2CommandStore();
  const first = await store.enqueue(base); const second = await store.enqueue(base);
  assert.equal(first.replayed, false); assert.equal(second.replayed, true);
  const ledger = { submit: async () => ({ transactionId: "TX_CORE_001" }), project: async () => undefined };
  const worker = new V2CommandWorker(store, ledger, "WORKER_01");
  assert.deepEqual(await worker.runOnce(new Date("2026-09-12T00:01:00.000Z")), { commandId: "CMD_CORE_001", status: "COMMITTED" });
  assert.equal((await store.get("CMD_CORE_001", "INST_MEDIATRIX", "ROLE-02"))?.status, "COMMITTED");
});

test("keeps retryable failures queued and makes conflicts visible", async () => {
  const store = new InMemoryV2CommandStore(); await store.enqueue({ ...base, commandId: "CMD_CORE_002", idempotencyKey: "IDEM_CORE_002", resourceId: "COMP_CORE_002" });
  const retryWorker = new V2CommandWorker(store, { submit: async () => { throw Object.assign(new Error("offline"), { retryable: true, code: "FABRIC_GATEWAY_UNAVAILABLE" }); }, project: async () => undefined }, "WORKER_02");
  assert.equal((await retryWorker.runOnce(new Date("2026-09-12T00:01:00.000Z"))).status, "RETRY_WAIT");
  const conflictStore = new InMemoryV2CommandStore(); await conflictStore.enqueue({ ...base, commandId: "CMD_CORE_003", idempotencyKey: "IDEM_CORE_003", resourceId: "COMP_CORE_003" });
  const conflictWorker = new V2CommandWorker(conflictStore, { submit: async () => { throw Object.assign(new Error("stale"), { retryable: false, code: "V2_VERSION_CONFLICT" }); }, project: async () => undefined }, "WORKER_03");
  assert.equal((await conflictWorker.runOnce(new Date("2026-09-12T00:01:00.000Z"))).status, "CONFLICT");
});
