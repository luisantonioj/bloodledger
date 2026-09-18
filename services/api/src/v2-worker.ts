import type { V2Command, V2CommandStore } from "./v2-command.js";

export interface V2LedgerSubmitter {
  submit(command: V2Command): Promise<{ transactionId: string; result?: unknown }>;
  project(command: V2Command, committed?: { transactionId: string; result: unknown | null }): Promise<void>;
}

export interface V2WorkerResult { commandId: string | null; status: "IDLE" | "COMMITTED" | "RETRY_WAIT" | "FAILED" | "CONFLICT"; }

function retryDelay(attemptCount: number): number { return Math.min(300_000, 1_000 * 2 ** Math.min(attemptCount, 8)); }

export class V2CommandWorker {
  constructor(private readonly store: V2CommandStore, private readonly ledger: V2LedgerSubmitter, private readonly workerId: string) {}

  async runOnce(now = new Date()): Promise<V2WorkerResult> {
    const command = await this.store.claim(this.workerId, now);
    if (!command) return { commandId: null, status: "IDLE" };
    let ledgerCommitted = command.ledgerTransactionId !== null;
    try {
      const committed = command.ledgerTransactionId === null
        ? await this.ledger.submit(command)
        : { transactionId: command.ledgerTransactionId, result: command.ledgerResult };
      if (command.ledgerTransactionId === null) {
        await this.store.markLedgerCommitted(command.commandId, committed.transactionId, now, committed.result ?? null);
        ledgerCommitted = true;
      }
      await this.ledger.project(
        { ...command, ledgerTransactionId: committed.transactionId, ledgerResult: committed.result ?? null },
        { transactionId: committed.transactionId, result: committed.result ?? null },
      );
      await this.store.markCommitted(command.commandId, now);
      return { commandId: command.commandId, status: "COMMITTED" };
    } catch (error) {
      const candidate = error as { retryable?: boolean; code?: string };
      const safeErrorCode = typeof candidate.code === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(candidate.code) ? candidate.code : "V2_COMMAND_FAILED";
      if (ledgerCommitted) {
        await this.store.markProjectionRetry(command.commandId, "PROJECTION_RECONCILIATION_FAILED", new Date(now.getTime() + retryDelay(command.attemptCount)), now);
        await this.store.markInboundCapture?.(command.commandId, "QUEUED", "PROJECTION_RECONCILIATION_FAILED", now);
        return { commandId: command.commandId, status: "RETRY_WAIT" };
      }
      if (candidate.retryable === true) {
        await this.store.markRetry(command.commandId, safeErrorCode, new Date(now.getTime() + retryDelay(command.attemptCount)), now);
        await this.store.markInboundCapture?.(command.commandId, "QUEUED", safeErrorCode, now);
        return { commandId: command.commandId, status: "RETRY_WAIT" };
      }
      const terminal = safeErrorCode.includes("CONFLICT") ? "CONFLICT" : "FAILED";
      await this.store.markTerminal(command.commandId, terminal, safeErrorCode, now);
      await this.store.markInboundCapture?.(command.commandId, terminal, safeErrorCode, now);
      return { commandId: command.commandId, status: terminal };
    }
  }
}
