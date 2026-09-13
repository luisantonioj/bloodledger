import { Pool, type PoolClient } from "pg";
import { ApiFailure } from "./errors.js";
import { sha256, stableIdentifier } from "./hash.js";
import type { ScanRepository } from "./repository.js";
import type {
  AcceptedScan,
  CaptureInput,
  ForecastRecord,
  Principal,
  ScanEvent,
  ScanStatus,
} from "./types.js";

type Row = Record<string, unknown>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapScan(row: Row): ScanEvent {
  const method = String(row.capture_method) as CaptureInput["captureMethod"];
  const ocrEvidence = method === "OCR"
    ? {
        engine: "TESSERACT_JS" as const,
        engineVersion: "7.0.0" as const,
        fieldConfidence: {
          unitId: Number(row.unit_id_confidence),
          bloodType: Number(row.blood_type_confidence),
          component: Number(row.component_confidence),
          collectedAt: Number(row.collected_at_confidence),
          expiresAt: Number(row.expires_at_confidence),
        },
      }
    : null;
  return {
    eventId: String(row.event_id),
    correlationId: String(row.correlation_id),
    idempotencyKey: String(row.idempotency_key),
    payloadSha256: String(row.payload_sha256),
    institutionId: String(row.institution_id),
    actorUserId: String(row.actor_user_id),
    unit: {
      unitId: String(row.unit_id),
      bloodType: String(row.blood_type) as CaptureInput["unit"]["bloodType"],
      component: String(row.component) as CaptureInput["unit"]["component"],
      collectedAt: iso(row.collected_at),
      expiresAt: iso(row.expires_at),
    },
    captureMethod: method,
    capturePolicyVersion: "SYNTHETIC_CAPTURE_V1",
    ocrEvidence,
    capturedAt: iso(row.captured_at),
    confirmedAt: iso(row.confirmed_at),
    receivedAt: iso(row.received_at),
    classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
    status: String(row.status) as ScanStatus,
    attemptCount: Number(row.attempt_count),
    nextAttemptAt: iso(row.next_attempt_at),
    ledgerTransactionId: nullableString(row.ledger_transaction_id),
    ledgerCommittedAt: row.ledger_committed_at ? iso(row.ledger_committed_at) : null,
    safeErrorCode: nullableString(row.safe_error_code),
    version: Number(row.version),
  };
}

export function createPoolFromEnvironment(environment: NodeJS.ProcessEnv = process.env): Pool {
  const required = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_APP_USER", "POSTGRES_APP_PASSWORD"] as const;
  for (const name of required) {
    if (!environment[name]) throw new Error(`Missing required database setting: ${name}`);
  }
  return new Pool({
    host: environment.POSTGRES_HOST,
    port: Number(environment.POSTGRES_PORT),
    database: environment.POSTGRES_DB,
    user: environment.POSTGRES_APP_USER,
    password: environment.POSTGRES_APP_PASSWORD,
    max: Number(environment.POSTGRES_POOL_SIZE ?? "10"),
    application_name: "bloodledger_sprint4",
  });
}

export class PostgresScanRepository implements ScanRepository {
  constructor(private readonly pool: Pool) {}

  async health(): Promise<boolean> {
    const result = await this.pool.query<{ ok: number }>("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  private async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async acceptScan(
    principal: Principal,
    idempotencyKey: string,
    capture: CaptureInput,
    receivedAt: Date,
  ): Promise<AcceptedScan> {
    const payloadSha256 = sha256({ capture, institutionId: principal.institutionId, actorUserId: principal.actorUserId });
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [idempotencyKey]);
      const existing = await client.query<Row>(
        "SELECT * FROM app.scan_events WHERE idempotency_key = $1 FOR UPDATE",
        [idempotencyKey],
      );
      if (existing.rows[0]) {
        if (String(existing.rows[0].payload_sha256) !== payloadSha256) {
          throw new ApiFailure(409, "SCAN_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different capture.");
        }
        return { event: mapScan(existing.rows[0]), replayed: true };
      }
      const eventId = stableIdentifier("SCAN", sha256({ idempotencyKey, payloadSha256 }));
      const correlationId = stableIdentifier("CORR", sha256({ eventId, receivedAt: receivedAt.toISOString() }));
      const confidence = capture.ocrEvidence?.fieldConfidence;
      const inserted = await client.query<Row>(`
        INSERT INTO app.scan_events (
          event_id, idempotency_key, payload_sha256, correlation_id,
          institution_id, actor_user_id, unit_id, blood_type, component,
          collected_at, expires_at, capture_method, capture_policy_version,
          ocr_engine, ocr_engine_version, unit_id_confidence, blood_type_confidence,
          component_confidence, collected_at_confidence, expires_at_confidence,
          captured_at, confirmed_at, received_at, classification,
          recommendation_eligibility, status, next_attempt_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
          'QUEUED', $23
        ) RETURNING *
      `, [
        eventId, idempotencyKey, payloadSha256, correlationId,
        principal.institutionId, principal.actorUserId, capture.unit.unitId,
        capture.unit.bloodType, capture.unit.component, capture.unit.collectedAt, capture.unit.expiresAt,
        capture.captureMethod, capture.capturePolicyVersion, capture.ocrEvidence?.engine ?? null,
        capture.ocrEvidence?.engineVersion ?? null, confidence?.unitId ?? null,
        confidence?.bloodType ?? null, confidence?.component ?? null,
        confidence?.collectedAt ?? null, confidence?.expiresAt ?? null,
        capture.capturedAt, capture.confirmedAt, receivedAt.toISOString(),
        "SIMULATION_ONLY", "DISABLED_UNAPPROVED_POLICY",
      ]);
      return { event: mapScan(inserted.rows[0]), replayed: false };
    });
  }

  async findScan(eventId: string, institutionId: string): Promise<ScanEvent | null> {
    const result = await this.pool.query<Row>(
      "SELECT * FROM app.scan_events WHERE event_id = $1 AND institution_id = $2",
      [eventId, institutionId],
    );
    return result.rows[0] ? mapScan(result.rows[0]) : null;
  }

  async listForecasts(institutionId: string, manilaDate: string): Promise<ForecastRecord[]> {
    const result = await this.pool.query<Row>(`
      SELECT fr.run_key, df.*
      FROM app.forecast_runs fr
      JOIN app.demand_forecasts df ON df.run_id = fr.run_id
      WHERE fr.run_status = 'COMPLETED'
        AND df.institution_id = $1
        AND fr.run_id = (
          SELECT fr2.run_id
          FROM app.forecast_runs fr2
          JOIN app.demand_forecasts df2 ON df2.run_id = fr2.run_id
          WHERE fr2.run_status = 'COMPLETED' AND df2.institution_id = $1
          ORDER BY (df2.horizon_date = $2::date) DESC, fr2.generated_at DESC
          LIMIT 1
        )
      ORDER BY df.blood_type, df.component
    `, [institutionId, manilaDate]);
    return result.rows.map((row) => ({
      runKey: String(row.run_key),
      institutionId: String(row.institution_id),
      bloodType: String(row.blood_type) as ForecastRecord["bloodType"],
      component: String(row.component) as ForecastRecord["component"],
      horizonDate: String(row.horizon_date).slice(0, 10),
      pointForecast: Number(row.point_forecast),
      lowerForecast: Number(row.lower_forecast),
      upperForecast: Number(row.upper_forecast),
      classification: "SIMULATION_ONLY",
      recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
      generatedAt: iso(row.generated_at),
      stale: String(row.horizon_date).slice(0, 10) !== manilaDate || String(row.forecast_status) !== "AVAILABLE" || String(row.stale_after).slice(0, 10) < manilaDate,
    }));
  }

  async recoverExpiredLeases(now: Date): Promise<number> {
    const result = await this.pool.query(`
      UPDATE app.scan_events
      SET status = 'RETRY_WAIT', lease_owner = NULL, lease_expires_at = NULL,
          safe_error_code = 'SYNC_LEASE_EXPIRED', next_attempt_at = $1,
          version = version + 1, updated_at = $1
      WHERE status = 'SUBMITTING' AND lease_expires_at <= $1
    `, [now.toISOString()]);
    return result.rowCount ?? 0;
  }

  async claimProjection(now: Date): Promise<ScanEvent | null> {
    const result = await this.pool.query<Row>(`
      SELECT * FROM app.scan_events
      WHERE status = 'LEDGER_COMMITTED_PROJECTION_PENDING'
      ORDER BY ledger_committed_at, event_id
      LIMIT 1
    `);
    return result.rows[0] ? mapScan(result.rows[0]) : null;
  }

  async claimLedger(workerId: string, now: Date): Promise<ScanEvent | null> {
    return this.transaction(async (client) => {
      const claimed = await client.query<Row>(`
        SELECT * FROM app.scan_events
        WHERE status IN ('QUEUED', 'RETRY_WAIT') AND next_attempt_at <= $1
        ORDER BY captured_at, event_id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `, [now.toISOString()]);
      if (!claimed.rows[0]) return null;
      const updated = await client.query<Row>(`
        UPDATE app.scan_events
        SET status = 'SUBMITTING', attempt_count = attempt_count + 1,
            lease_owner = $2, lease_expires_at = $3, safe_error_code = NULL,
            version = version + 1, updated_at = $1
        WHERE event_id = $4
        RETURNING *
      `, [now.toISOString(), workerId, new Date(now.getTime() + 60_000).toISOString(), claimed.rows[0].event_id]);
      return mapScan(updated.rows[0]);
    });
  }

  async markLedgerCommitted(event: ScanEvent, transactionId: string, committedAt: Date): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`
        UPDATE app.scan_events
        SET status = 'LEDGER_COMMITTED_PROJECTION_PENDING', ledger_transaction_id = $2,
            ledger_committed_at = $3, lease_owner = NULL, lease_expires_at = NULL,
            safe_error_code = NULL, version = version + 1, updated_at = $3
        WHERE event_id = $1 AND status = 'SUBMITTING'
      `, [event.eventId, transactionId, committedAt.toISOString()]);
      await client.query(`
        INSERT INTO app.scan_event_attempts (
          event_id, attempt_number, outcome, started_at, finished_at, ledger_transaction_id
        ) VALUES ($1, $2, 'LEDGER_COMMITTED', $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [event.eventId, event.attemptCount, event.receivedAt, committedAt.toISOString(), transactionId]);
    });
  }

  async projectCommitted(event: ScanEvent, projectedAt: Date): Promise<void> {
    if (!event.ledgerTransactionId) throw new Error("Cannot project an event without ledger evidence");
    await this.transaction(async (client) => {
      await client.query(`
        INSERT INTO app.inventory_projection (
          unit_id, institution_id, blood_type, component, collected_at, expires_at,
          inventory_status, policy_version, ledger_version, ledger_transaction_id,
          correlation_id, source_event_id, projected_at, classification
        ) VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE', 'SYNTHETIC_INVENTORY_V1',
          1, $7, $8, $9, $10, 'SIMULATION_ONLY')
        ON CONFLICT (source_event_id) DO NOTHING
      `, [
        event.unit.unitId, event.institutionId, event.unit.bloodType, event.unit.component,
        event.unit.collectedAt, event.unit.expiresAt, event.ledgerTransactionId,
        event.correlationId, event.eventId, projectedAt.toISOString(),
      ]);
      await client.query(`
        UPDATE app.scan_events
        SET status = 'COMMITTED', safe_error_code = NULL,
            version = version + 1, updated_at = $2
        WHERE event_id = $1 AND status = 'LEDGER_COMMITTED_PROJECTION_PENDING'
      `, [event.eventId, projectedAt.toISOString()]);
      await client.query(`
        INSERT INTO app.scan_event_attempts (
          event_id, attempt_number, outcome, started_at, finished_at, ledger_transaction_id
        ) VALUES ($1, $2, 'PROJECTION_COMMITTED', $3, $3, $4)
        ON CONFLICT DO NOTHING
      `, [event.eventId, event.attemptCount, projectedAt.toISOString(), event.ledgerTransactionId]);
    });
  }

  async recordProjectionFailure(event: ScanEvent, safeErrorCode: string, finishedAt: Date): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`
        UPDATE app.scan_events
        SET safe_error_code = $2, version = version + 1, updated_at = $3
        WHERE event_id = $1 AND status = 'LEDGER_COMMITTED_PROJECTION_PENDING'
      `, [event.eventId, safeErrorCode, finishedAt.toISOString()]);
      await client.query(`
        INSERT INTO app.scan_event_attempts (
          event_id, attempt_number, outcome, safe_error_code, started_at, finished_at,
          ledger_transaction_id
        ) VALUES ($1, $2, 'PROJECTION_RETRY', $3, $4, $4, $5)
        ON CONFLICT DO NOTHING
      `, [event.eventId, event.attemptCount, safeErrorCode, finishedAt.toISOString(), event.ledgerTransactionId]);
    });
  }

  async scheduleRetry(event: ScanEvent, safeErrorCode: string, nextAttemptAt: Date, finishedAt: Date): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`
        UPDATE app.scan_events
        SET status = 'RETRY_WAIT', next_attempt_at = $2, safe_error_code = $3,
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = $4
        WHERE event_id = $1 AND status = 'SUBMITTING'
      `, [event.eventId, nextAttemptAt.toISOString(), safeErrorCode, finishedAt.toISOString()]);
      await client.query(`
        INSERT INTO app.scan_event_attempts (
          event_id, attempt_number, outcome, safe_error_code, started_at, finished_at
        ) VALUES ($1, $2, 'RETRY_SCHEDULED', $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [event.eventId, event.attemptCount, safeErrorCode, event.receivedAt, finishedAt.toISOString()]);
    });
  }

  async markTerminal(
    event: ScanEvent,
    status: "FAILED" | "CONFLICT",
    safeErrorCode: string,
    finishedAt: Date,
  ): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`
        UPDATE app.scan_events
        SET status = $2, safe_error_code = $3, lease_owner = NULL,
            lease_expires_at = NULL, version = version + 1, updated_at = $4
        WHERE event_id = $1 AND status = 'SUBMITTING'
      `, [event.eventId, status, safeErrorCode, finishedAt.toISOString()]);
      await client.query(`
        INSERT INTO app.scan_event_attempts (
          event_id, attempt_number, outcome, safe_error_code, started_at, finished_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [event.eventId, event.attemptCount, status, safeErrorCode, event.receivedAt, finishedAt.toISOString()]);
    });
  }
}
