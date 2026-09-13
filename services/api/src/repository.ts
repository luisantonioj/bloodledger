import type { AcceptedScan, CaptureInput, ForecastRecord, Principal, ScanEvent } from "./types.js";

export interface ScanRepository {
  health(): Promise<boolean>;
  acceptScan(
    principal: Principal,
    idempotencyKey: string,
    capture: CaptureInput,
    receivedAt: Date,
  ): Promise<AcceptedScan>;
  findScan(eventId: string, institutionId: string): Promise<ScanEvent | null>;
  listForecasts(institutionId: string, manilaDate: string): Promise<ForecastRecord[]>;
  recoverExpiredLeases(now: Date): Promise<number>;
  claimProjection(now: Date): Promise<ScanEvent | null>;
  claimLedger(workerId: string, now: Date): Promise<ScanEvent | null>;
  markLedgerCommitted(event: ScanEvent, transactionId: string, committedAt: Date): Promise<void>;
  projectCommitted(event: ScanEvent, projectedAt: Date): Promise<void>;
  recordProjectionFailure(event: ScanEvent, safeErrorCode: string, finishedAt: Date): Promise<void>;
  scheduleRetry(event: ScanEvent, safeErrorCode: string, nextAttemptAt: Date, finishedAt: Date): Promise<void>;
  markTerminal(event: ScanEvent, status: "FAILED" | "CONFLICT", safeErrorCode: string, finishedAt: Date): Promise<void>;
}
