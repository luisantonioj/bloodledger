import type { V2Command, V2CommandStore } from "./v2-command.js";

export interface V2LedgerSubmitter {
  submit(command: V2Command): Promise<{ transactionId: string }>;
  project(command: V2Command): Promise<void>;
}

export interface V2WorkerResult { commandId: string | null; status: "IDLE" | "COMMITTED" | "RETRY_WAIT" | "FAILED" | "CONFLICT"; }

function retryDelay(attemptCount: number): number { return Math.min(300_000, 1_000 * 2 ** Math.min(attemptCount, 8)); }

export class V2CommandWorker {
  constructor(private readonly store: V2CommandStore, private readonly ledger: V2LedgerSubmitter, private readonly workerId: string) {}

  async runOnce(now = new Date()): Promise<V2WorkerResult> {
    const command = await this.store.claim(this.workerId, now);
    if (!command) return { commandId: null, status: "IDLE" };
    try {
      const committed = await this.ledger.submit(command);
      await this.store.markLedgerCommitted(command.commandId, committed.transactionId, now);
      await this.ledger.project(command);
      await this.store.markCommitted(command.commandId, now);
      return { commandId: command.commandId, status: "COMMITTED" };
    } catch (error) {
      const candidate = error as { retryable?: boolean; code?: string };
      const safeErrorCode = typeof candidate.code === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(candidate.code) ? candidate.code : "V2_COMMAND_FAILED";
      if (candidate.retryable === true) {
        await this.store.markRetry(command.commandId, safeErrorCode, new Date(now.getTime() + retryDelay(command.attemptCount)), now);
        return { commandId: command.commandId, status: "RETRY_WAIT" };
      }
      const terminal = safeErrorCode.includes("CONFLICT") ? "CONFLICT" : "FAILED";
      await this.store.markTerminal(command.commandId, terminal, safeErrorCode, now);
      return { commandId: command.commandId, status: terminal };
    }
  }
}
