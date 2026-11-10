import type { CensusSnapshot } from "../../services/api/census-index";
import type { PrcSupplyRequest } from "../../services/api/prc-supply";
import { OPEN_SUPPLY_STATUSES } from "./use-open-supply-requests";

// Saved stock records are scheduled at 09:00 and 16:00 Asia/Manila with a 30-minute capture window.
const SLOT_HOURS = [9, 16] as const;
const WINDOW_MS = 30 * 60_000;
const isCheckpoint = (row: CensusSnapshot) => row.reportPolicyVersion.startsWith("SYNTHETIC_STOCK_CHECKPOINT_");

function manilaDay(time: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const slotAt = (day: string, hour: number) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00.000+08:00`);

/** The most recent 09:00 or 16:00 Manila slot that has started at `now`. */
export function latestReachedSlot(now: number): number {
  const today = manilaDay(now);
  const reached = SLOT_HOURS.map(hour => slotAt(today, hour)).filter(slot => slot <= now);
  if (reached.length) return Math.max(...reached);
  return slotAt(manilaDay(now - 24 * 3_600_000), 16);
}

export type ReportingState = "UP_TO_DATE" | "AWAITING" | "MISSED" | "NO_RECORDS";
export interface ReportingRow { institutionId: string; name: string; available: number | null; lastRecordAt: string | null; state: ReportingState; slot: number }

export const reportingLabel = (row: ReportingRow) => {
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(row.slot));
  return row.state === "UP_TO_DATE" ? "Up to date" : row.state === "AWAITING" ? `Saving ${time} record` : row.state === "MISSED" ? `Missed ${time} record` : "No saved records";
};

// One row per reporting blood bank: live available units plus whether its latest scheduled stock
// record was saved. A missing record is shown as missed, never filled in from current stock.
export function reportingRows(banks: { institutionId: string; name: string; available: number | null }[], snapshots: CensusSnapshot[], now: number): ReportingRow[] {
  const slot = latestReachedSlot(now);
  return banks.map(bank => {
    const records = snapshots.filter(row => row.institutionId === bank.institutionId && isCheckpoint(row) && Date.parse(row.scheduledFor) <= now);
    const latest = records.sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor))[0];
    const state: ReportingState = !latest ? (now < slot + WINDOW_MS ? "AWAITING" : "NO_RECORDS")
      : Date.parse(latest.scheduledFor) === slot ? "UP_TO_DATE"
        : now < slot + WINDOW_MS ? "AWAITING" : "MISSED";
    return { ...bank, lastRecordAt: latest?.capturedAt ?? null, state, slot };
  });
}

// Open requests first (soonest needed first), then closed requests (most recently needed first).
export function replenishmentOrder(rows: PrcSupplyRequest[]): PrcSupplyRequest[] {
  const open = (row: PrcSupplyRequest) => OPEN_SUPPLY_STATUSES.includes(row.status);
  return [...rows].sort((a, b) => Number(open(b)) - Number(open(a)) || (open(a) ? Date.parse(a.requiredBy) - Date.parse(b.requiredBy) : Date.parse(b.requiredBy) - Date.parse(a.requiredBy)));
}
