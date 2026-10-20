import { CensusWorker, STOCK_CHECKPOINT_POLICY_VERSION, STOCK_CHECKPOINT_WINDOW_MS, type CensusStore } from "./census-worker.js";
import type { DohReportPolicy } from "./report-policy.js";

export function requireStockCheckpointPolicy(policy: DohReportPolicy): void {
  if (!policy.copyModeEnabled || policy.version !== STOCK_CHECKPOINT_POLICY_VERSION) throw new Error("STOCK_CHECKPOINT_POLICY_DISABLED");
}

/** Off-chain only. Discover active banks every tick; one bank's failure must not skip the others. */
export class StockCheckpointScheduler {
  constructor(private readonly store: CensusStore, private readonly activeBanks: () => Promise<string[]>) {}
  async runOnce(now: Date): Promise<{ institutions: number; snapshots: number; failedInstitutions: string[] }> {
    const institutions = await this.activeBanks();
    let snapshots = 0;
    const failedInstitutions: string[] = [];
    for (const institution of institutions) {
      try { snapshots += (await new CensusWorker(this.store, [institution], STOCK_CHECKPOINT_WINDOW_MS).runDueSlots(now)).length; }
      catch { failedInstitutions.push(institution); }
    }
    return { institutions: institutions.length, snapshots, failedInstitutions };
  }
}
