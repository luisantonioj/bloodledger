import { WorkerFailure } from "./errors.js";
import type { InventoryLedger } from "./fabric.js";
import type { ScanRepository } from "./repository.js";

const RETRY_SECONDS = [1, 2, 4, 8, 16, 30] as const;

export type WorkResult = "IDLE" | "LEASE_RECOVERED" | "PROJECTED" | "PROJECTION_RETRY" | "LEDGER_COMMITTED" | "RETRY_WAIT" | "FAILED" | "CONFLICT";

export class ScanSyncWorker {
  constructor(
    private readonly repository: ScanRepository,
    private readonly ledger: InventoryLedger,
    private readonly workerId: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async runOnce(): Promise<WorkResult> {
    const now = this.clock();
    const recovered = await this.repository.recoverExpiredLeases(now);
    if (recovered > 0) return "LEASE_RECOVERED";

    const projection = await this.repository.claimProjection(now);
    if (projection) {
      try {
        await this.repository.projectCommitted(projection, this.clock());
        return "PROJECTED";
      } catch {
        await this.repository.recordProjectionFailure(projection, "PROJECTION_WRITE_FAILED", this.clock());
        return "PROJECTION_RETRY";
      }
    }

    const event = await this.repository.claimLedger(this.workerId, now);
    if (!event) return "IDLE";
    try {
      const committed = await this.ledger.register(event);
      await this.repository.markLedgerCommitted(event, committed.transactionId, committed.committedAt);
      return "LEDGER_COMMITTED";
    } catch (error) {
      const failure = error instanceof WorkerFailure
        ? error
        : new WorkerFailure("FABRIC_GATEWAY_UNAVAILABLE", true);
      const finishedAt = this.clock();
      if (failure.code === "INV_DUPLICATE_UNIT" || failure.code === "INV_IDEMPOTENCY_CONFLICT") {
        await this.repository.markTerminal(event, "CONFLICT", failure.code, finishedAt);
        return "CONFLICT";
      }
      if (failure.retryable) {
        const retryIndex = Math.min(Math.max(event.attemptCount - 1, 0), RETRY_SECONDS.length - 1);
        const nextAttemptAt = new Date(finishedAt.getTime() + RETRY_SECONDS[retryIndex] * 1000);
        await this.repository.scheduleRetry(event, failure.code, nextAttemptAt, finishedAt);
        return "RETRY_WAIT";
      }
      await this.repository.markTerminal(event, "FAILED", failure.code, finishedAt);
      return "FAILED";
    }
  }
}
