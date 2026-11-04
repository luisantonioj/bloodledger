import { nullableIsoTimestamp } from "./time.js";
import { INTERVIEW_V2_1_COMPONENT_TYPES } from "./v2-contracts.js";

// PA-REV-03 DASHBOARD_EXACT_STOCK_V1 (Proposed; panel revision Dean Cherrie #3): exact ledger-confirmed counts for
// one blood bank by blood type, component and status, with label expiry evaluated at read time. Queued commands are
// reported, never counted. SIMULATION_ONLY; it classifies nothing (RQ-16) and has no near-expiry band (RQ-03).
export const DASHBOARD_STOCK_POLICY_VERSION = "DASHBOARD_EXACT_STOCK_V1";
export const DASHBOARD_BLOOD_TYPE_ORDER = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
export const STOCK_COUNT_FIELDS = ["available", "reserved", "outgoingInTransit", "received", "labelExpiredPendingEvaluation", "expired", "onHold", "compromised"] as const;
type StockCountField = (typeof STOCK_COUNT_FIELDS)[number];
type StockCounts = Record<StockCountField, number>;

// One row per blood type x component x count bucket, as produced by PostgresBloodBankReader.stockCounts.
export interface StockCountRow { blood_type: string; component_type: string; bucket: string; count: number | string }
export interface StockCountEvidence { rows: StockCountRow[]; lastProjectedAt: unknown; pendingCommands: number | string }

const zero = (): StockCounts => Object.fromEntries(STOCK_COUNT_FIELDS.map((field) => [field, 0])) as StockCounts;

export function assembleStockCounts(institutionId: string, evidence: StockCountEvidence, now: Date) {
  const cells = new Map<string, StockCounts>();
  for (const bloodType of DASHBOARD_BLOOD_TYPE_ORDER) for (const componentType of INTERVIEW_V2_1_COMPONENT_TYPES) cells.set(`${bloodType}|${componentType}`, zero());
  for (const row of evidence.rows) {
    const cell = cells.get(`${row.blood_type}|${row.component_type}`);
    // Statuses outside the buckets (RELEASED) and types outside the V2.1 matrix are not stock on hand.
    if (!cell || !(STOCK_COUNT_FIELDS as readonly string[]).includes(row.bucket)) continue;
    cell[row.bucket as StockCountField] += Number(row.count);
  }
  const rows = [...cells].map(([key, counts]) => { const [bloodType, componentType] = key.split("|"); return { bloodType: bloodType!, componentType: componentType!, ...counts }; });
  const totals = zero();
  for (const row of rows) for (const field of STOCK_COUNT_FIELDS) totals[field] += row[field];
  return {
    scope: "INSTITUTION" as const,
    institutionId,
    evaluatedAt: now.toISOString(),
    lastProjectedAt: nullableIsoTimestamp(evidence.lastProjectedAt),
    pendingCommands: Number(evidence.pendingCommands),
    rows,
    totals: { ...totals, usable: totals.available + totals.reserved },
    policyVersion: DASHBOARD_STOCK_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}
