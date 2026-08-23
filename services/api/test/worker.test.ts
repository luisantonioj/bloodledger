import assert from "node:assert/strict";
import test from "node:test";
import { WorkerFailure } from "../src/errors.js";
import { safeFabricError, type InventoryLedger } from "../src/fabric.js";
import { ScanSyncWorker } from "../src/worker.js";
import { fixedNow, MemoryRepository, scanEvent } from "./test-support.js";

class Ledger implements InventoryLedger {
  calls = 0;
  constructor(private readonly failure?: WorkerFailure) {}
  async register() {
    this.calls += 1;
    if (this.failure) throw this.failure;
    return { transactionId: "TX_SPRINT4_001", committedAt: fixedNow };
  }
}

test("FR-05 preserves stable Fabric transfer policy errors without exposing Gateway details", () => {
  assert.deepEqual({ code: safeFabricError(new Error("endorsement failed: TRF_NOT_AUTHORIZED")).code, retryable: safeFabricError(new Error("endorsement failed: TRF_NOT_AUTHORIZED")).retryable }, { code: "TRF_NOT_AUTHORIZED", retryable: false });
  assert.deepEqual({ code: safeFabricError(new Error("connection closed")).code, retryable: safeFabricError(new Error("connection closed")).retryable }, { code: "FABRIC_GATEWAY_UNAVAILABLE", retryable: true });
});

test("FR-13 recovers leases and completes pending projections before Fabric submission", async () => {
  const repository = new MemoryRepository();
  const ledger = new Ledger();
  const worker = new ScanSyncWorker(repository, ledger, "WORKER_TEST", () => fixedNow);
  repository.recovered = 1;
  assert.equal(await worker.runOnce(), "LEASE_RECOVERED");
  repository.projection = scanEvent({
    status: "LEDGER_COMMITTED_PROJECTION_PENDING",
    attemptCount: 1,
    ledgerTransactionId: "TX_ALREADY_COMMITTED",
    ledgerCommittedAt: fixedNow.toISOString(),
  });
  assert.equal(await worker.runOnce(), "PROJECTED");
  assert.equal(ledger.calls, 0);
  assert.equal(repository.actions[0].action, "projection");
});

test("FR-13 records ledger success before the independently recoverable projection", async () => {
  const repository = new MemoryRepository();
  const ledger = new Ledger();
  repository.ledgerClaim = scanEvent({ status: "SUBMITTING", attemptCount: 1 });
  const worker = new ScanSyncWorker(repository, ledger, "WORKER_TEST", () => fixedNow);
  assert.equal(await worker.runOnce(), "LEDGER_COMMITTED");
  assert.equal(repository.actions[0].action, "ledger");
  assert.equal(repository.actions[0].transactionId, "TX_SPRINT4_001");
});

test("FR-13 leaves a failed projection recoverable without resubmitting Fabric", async () => {
  const repository = new MemoryRepository();
  const ledger = new Ledger();
  repository.projectionFailure = true;
  repository.projection = scanEvent({
    status: "LEDGER_COMMITTED_PROJECTION_PENDING",
    attemptCount: 1,
    ledgerTransactionId: "TX_ALREADY_COMMITTED",
    ledgerCommittedAt: fixedNow.toISOString(),
  });
  const worker = new ScanSyncWorker(repository, ledger, "WORKER_TEST", () => fixedNow);
  assert.equal(await worker.runOnce(), "PROJECTION_RETRY");
  assert.equal(ledger.calls, 0);
  assert.deepEqual(
    { action: repository.actions[0].action, safeErrorCode: repository.actions[0].safeErrorCode },
    { action: "projection-retry", safeErrorCode: "PROJECTION_WRITE_FAILED" },
  );
});

test("FR-13 uses deterministic bounded retry delays and terminal conflict handling", async () => {
  const retryRepository = new MemoryRepository();
  retryRepository.ledgerClaim = scanEvent({ status: "SUBMITTING", attemptCount: 3 });
  const retryWorker = new ScanSyncWorker(
    retryRepository,
    new Ledger(new WorkerFailure("FABRIC_GATEWAY_UNAVAILABLE", true)),
    "WORKER_TEST",
    () => fixedNow,
  );
  assert.equal(await retryWorker.runOnce(), "RETRY_WAIT");
  assert.equal(retryRepository.actions[0].nextAttemptAt, "2026-08-17T12:00:04.000Z");

  const conflictRepository = new MemoryRepository();
  conflictRepository.ledgerClaim = scanEvent({ status: "SUBMITTING", attemptCount: 1 });
  const conflictWorker = new ScanSyncWorker(
    conflictRepository,
    new Ledger(new WorkerFailure("INV_DUPLICATE_UNIT", false)),
    "WORKER_TEST",
    () => fixedNow,
  );
  assert.equal(await conflictWorker.runOnce(), "CONFLICT");
  assert.deepEqual(
    { action: conflictRepository.actions[0].action, status: conflictRepository.actions[0].status, safeErrorCode: conflictRepository.actions[0].safeErrorCode },
    { action: "terminal", status: "CONFLICT", safeErrorCode: "INV_DUPLICATE_UNIT" },
  );
});

test("NFR-06 preserves exactly-once worker outcomes at simulated Gateway latencies", async (context) => {
  for (const delay of [0, 250, 2_000, 5_000]) {
    await context.test(`${delay} millisecond Gateway latency`, async () => {
      const repository = new MemoryRepository();
      repository.ledgerClaim = scanEvent({ status: "SUBMITTING", attemptCount: 1 });
      const ledger: InventoryLedger = {
        async register() {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return { transactionId: `TX_LATENCY_${delay}`, committedAt: fixedNow };
        },
      };
      const worker = new ScanSyncWorker(repository, ledger, "WORKER_LATENCY", () => fixedNow);
      assert.equal(await worker.runOnce(), "LEDGER_COMMITTED");
      assert.equal(repository.actions.length, 1);
      assert.equal(repository.actions[0].transactionId, `TX_LATENCY_${delay}`);
    });
  }
});
