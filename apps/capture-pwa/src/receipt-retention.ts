import type { StoredCommandReceipt } from "./types";
export const TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000;
export const terminalReceipt = (receipt: StoredCommandReceipt) => ["COMMITTED", "FAILED", "CONFLICT"].includes(receipt.status);
export interface ExpiredReceipt { commandId: string; accountId: string; institutionId: string; expired: true }
export type ReceiptEntry = StoredCommandReceipt | ExpiredReceipt;
export function retainedReceipt(next: StoredCommandReceipt, previous?: ReceiptEntry, now = Date.now()): ReceiptEntry {
  if (previous && "expired" in previous) return previous;
  if (!next.accountId || !next.institutionId) throw new Error("CAPTURE_RECEIPT_OWNER_REQUIRED");
  if (previous && (previous.accountId !== next.accountId || previous.institutionId !== next.institutionId || previous.operatorId !== next.operatorId ||
      previous.commandId !== next.commandId || previous.resourceId !== next.resourceId || previous.statusUrl !== next.statusUrl || previous.correlationId !== next.correlationId || previous.acceptedAt !== next.acceptedAt)) throw new Error("CAPTURE_RECEIPT_IDENTITY_MISMATCH");
  // First observation starts the clock, not acceptance; replay never renews it.
  const current = previous && terminalReceipt(previous) ? previous : next;
  const terminalObservedAt = previous?.terminalObservedAt ?? (terminalReceipt(current) ? new Date(now).toISOString() : undefined);
  if (terminalObservedAt && now >= Date.parse(terminalObservedAt) + TERMINAL_RETENTION_MS) return {commandId:current.commandId, accountId:next.accountId, institutionId:next.institutionId, expired:true};
  return {...current, ...(terminalObservedAt ? {terminalObservedAt} : {})};
}
