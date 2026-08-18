import { ApiFailure } from "../src/errors.js";
import type { ScanRepository } from "../src/repository.js";
import type { AcceptedScan, CaptureInput, ForecastRecord, Principal, ScanEvent } from "../src/types.js";

export const fixedNow = new Date("2026-08-17T12:00:00.000Z");
export const fallbackCapture: CaptureInput = {
  captureMethod: "SYNTHETIC_QR_FALLBACK",
  capturePolicyVersion: "SYNTHETIC_CAPTURE_V1",
  capturedAt: "2026-08-17T11:59:00.000Z",
  confirmedAt: "2026-08-17T11:59:30.000Z",
  unit: {
    unitId: "UNIT_SYNTH_S4_API_001",
    bloodType: "A_POSITIVE",
    component: "RED_BLOOD_CELLS",
    collectedAt: "2026-08-17T00:00:00.000Z",
    expiresAt: "2026-08-20T00:00:00.000Z",
  },
  ocrEvidence: null,
};

export function scanEvent(overrides: Partial<ScanEvent> = {}): ScanEvent {
  return {
    ...fallbackCapture,
    eventId: "SCAN_0123456789ABCDEF0123456789ABCDEF",
    correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF",
    idempotencyKey: "IDEM_SCAN_API_001",
    payloadSha256: "a".repeat(64),
    actorUserId: "USR_SYNTH_CAPTURE",
    institutionId: "INST_MEDIATRIX",
    receivedAt: fixedNow.toISOString(),
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    status: "QUEUED",
    attemptCount: 0,
    nextAttemptAt: fixedNow.toISOString(),
    ledgerTransactionId: null,
    ledgerCommittedAt: null,
    safeErrorCode: null,
    version: 1,
    ...overrides,
  };
}

export class MemoryRepository implements ScanRepository {
  event: ScanEvent | null = null;
  payload: string | null = null;
  forecasts: ForecastRecord[] = [];
  recovered = 0;
  projection: ScanEvent | null = null;
  ledgerClaim: ScanEvent | null = null;
  projectionFailure = false;
  actions: Array<Record<string, unknown>> = [];

  async health(): Promise<boolean> { return true; }

  async acceptScan(
    principal: Principal,
    idempotencyKey: string,
    capture: CaptureInput,
    receivedAt: Date,
  ): Promise<AcceptedScan> {
    const payload = JSON.stringify({ principal, capture });
    if (this.event) {
      if (this.event.idempotencyKey !== idempotencyKey || this.payload !== payload) {
        throw new ApiFailure(409, "SCAN_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different capture.");
      }
      return { event: this.event, replayed: true };
    }
    this.payload = payload;
    this.event = scanEvent({ idempotencyKey, receivedAt: receivedAt.toISOString() });
    return { event: this.event, replayed: false };
  }

  async findScan(eventId: string, institutionId: string): Promise<ScanEvent | null> {
    return this.event?.eventId === eventId && this.event.institutionId === institutionId ? this.event : null;
  }

  async listForecasts(): Promise<ForecastRecord[]> { return this.forecasts; }
  async recoverExpiredLeases(): Promise<number> { const value = this.recovered; this.recovered = 0; return value; }
  async claimProjection(): Promise<ScanEvent | null> { const value = this.projection; this.projection = null; return value; }
  async claimLedger(): Promise<ScanEvent | null> { const value = this.ledgerClaim; this.ledgerClaim = null; return value; }
  async markLedgerCommitted(event: ScanEvent, transactionId: string, committedAt: Date): Promise<void> {
    this.actions.push({ action: "ledger", event, transactionId, committedAt: committedAt.toISOString() });
  }
  async projectCommitted(event: ScanEvent, projectedAt: Date): Promise<void> {
    if (this.projectionFailure) throw new Error("synthetic projection failure");
    this.actions.push({ action: "projection", event, projectedAt: projectedAt.toISOString() });
  }
  async recordProjectionFailure(event: ScanEvent, safeErrorCode: string, finishedAt: Date): Promise<void> {
    this.actions.push({ action: "projection-retry", event, safeErrorCode, finishedAt: finishedAt.toISOString() });
  }
  async scheduleRetry(event: ScanEvent, safeErrorCode: string, nextAttemptAt: Date): Promise<void> {
    this.actions.push({ action: "retry", event, safeErrorCode, nextAttemptAt: nextAttemptAt.toISOString() });
  }
  async markTerminal(event: ScanEvent, status: "FAILED" | "CONFLICT", safeErrorCode: string): Promise<void> {
    this.actions.push({ action: "terminal", event, status, safeErrorCode });
  }
}
