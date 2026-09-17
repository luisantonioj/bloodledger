import type { Pool } from "pg";
import { createHash } from "node:crypto";
import { ApiFailure } from "./errors.js";

export type V2CommandStatus = "QUEUED" | "SUBMITTING" | "LEDGER_COMMITTED_PROJECTION_PENDING" | "COMMITTED" | "RETRY_WAIT" | "FAILED" | "CONFLICT";
export type V2ResourceType = "COMPONENT" | "INBOUND_CAPTURE" | "TRANSFER" | "LOCAL_RELEASE" | "RECONCILIATION";

export interface V2CommandInput {
  commandId: string;
  idempotencyKey: string;
  resourceType: V2ResourceType;
  resourceId: string;
  operation: string;
  payload: Record<string, unknown>;
  correlationId: string;
  actorUserId: string;
  actorInstitutionId: string;
  acceptedAt: string;
  payloadSha256?: string;
}

export interface V2Command extends V2CommandInput {
  status: V2CommandStatus;
  attemptCount: number;
  nextAttemptAt: string;
  ledgerTransactionId: string | null;
  ledgerResult: unknown | null;
  safeErrorCode: string | null;
  classification: "SIMULATION_ONLY";
  updatedAt: string;
}

export interface V2CommandStore {
  enqueue(input: V2CommandInput): Promise<{ command: V2Command; replayed: boolean }>;
  get(commandId: string, institutionId: string, roleId: string): Promise<V2Command | null>;
  claim(workerId: string, now: Date, leaseMs?: number): Promise<V2Command | null>;
  markLedgerCommitted(commandId: string, transactionId: string, now: Date, result?: unknown): Promise<void>;
  markProjectionRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void>;
  markCommitted(commandId: string, now: Date): Promise<void>;
  markRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void>;
  markTerminal(commandId: string, status: "FAILED" | "CONFLICT", safeErrorCode: string, now: Date): Promise<void>;
  markInboundCapture?(commandId: string, status: "QUEUED" | "FAILED" | "CONFLICT", safeErrorCode: string | null, now: Date): Promise<void>;
}

function payloadDigest(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function commandView(row: Record<string, unknown>): V2Command {
  return {
    commandId: String(row.command_id), idempotencyKey: String(row.idempotency_key), resourceType: String(row.resource_type) as V2ResourceType,
    resourceId: String(row.resource_id), operation: String(row.operation), payload: (row.payload ?? {}) as Record<string, unknown>,
    correlationId: String(row.correlation_id), actorUserId: String(row.actor_user_id), actorInstitutionId: String(row.actor_institution_id),
    acceptedAt: new Date(String(row.accepted_at)).toISOString(), status: String(row.status) as V2CommandStatus,
    attemptCount: Number(row.attempt_count), nextAttemptAt: new Date(String(row.next_attempt_at)).toISOString(),
    ledgerTransactionId: row.ledger_transaction_id === null || row.ledger_transaction_id === undefined ? null : String(row.ledger_transaction_id),
    ledgerResult: row.ledger_result === null || row.ledger_result === undefined ? null : row.ledger_result,
    safeErrorCode: row.safe_error_code === null || row.safe_error_code === undefined ? null : String(row.safe_error_code),
    classification: "SIMULATION_ONLY", updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class InMemoryV2CommandStore implements V2CommandStore {
  private readonly commands = new Map<string, V2Command>();
  async enqueue(input: V2CommandInput): Promise<{ command: V2Command; replayed: boolean }> {
    const digest = input.payloadSha256 ?? payloadDigest(input.payload);
    const existing = [...this.commands.values()].find((command) => command.idempotencyKey === input.idempotencyKey);
    if (existing) {
      if (existing.payloadSha256 !== digest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return { command: existing, replayed: true };
    }
    const command: V2Command = { ...input, payloadSha256: digest, status: "QUEUED", attemptCount: 0, nextAttemptAt: input.acceptedAt, ledgerTransactionId: null, ledgerResult: null, safeErrorCode: null, classification: "SIMULATION_ONLY", updatedAt: input.acceptedAt };
    this.commands.set(command.commandId, command);
    return { command, replayed: false };
  }
  async get(commandId: string, institutionId: string, roleId: string): Promise<V2Command | null> {
    const command = this.commands.get(commandId);
    if (!command || (roleId !== "ROLE-04" && command.actorInstitutionId !== institutionId)) return null;
    return command;
  }
  async claim(_workerId: string, now: Date, leaseMs = 30_000): Promise<V2Command | null> {
    const command = [...this.commands.values()].filter((item) => ["QUEUED", "RETRY_WAIT", "LEDGER_COMMITTED_PROJECTION_PENDING"].includes(item.status) && new Date(item.nextAttemptAt) <= now).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.commandId.localeCompare(b.commandId))[0];
    if (!command) return null;
    command.status = "SUBMITTING"; command.attemptCount += 1; command.updatedAt = now.toISOString();
    void leaseMs;
    return command;
  }
  async markLedgerCommitted(commandId: string, transactionId: string, now: Date, result?: unknown): Promise<void> { const command = this.must(commandId); command.status = "LEDGER_COMMITTED_PROJECTION_PENDING"; command.ledgerTransactionId = transactionId; command.ledgerResult = result ?? null; command.updatedAt = now.toISOString(); }
  async markCommitted(commandId: string, now: Date): Promise<void> { const command = this.must(commandId); command.status = "COMMITTED"; command.updatedAt = now.toISOString(); }
  async markRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { const command = this.must(commandId); command.status = "RETRY_WAIT"; command.safeErrorCode = safeErrorCode; command.nextAttemptAt = nextAttemptAt.toISOString(); command.updatedAt = now.toISOString(); }
  async markProjectionRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { const command = this.must(commandId); command.status = "LEDGER_COMMITTED_PROJECTION_PENDING"; command.safeErrorCode = safeErrorCode; command.nextAttemptAt = nextAttemptAt.toISOString(); command.updatedAt = now.toISOString(); }
  async markTerminal(commandId: string, status: "FAILED" | "CONFLICT", safeErrorCode: string, now: Date): Promise<void> { const command = this.must(commandId); command.status = status; command.safeErrorCode = safeErrorCode; command.updatedAt = now.toISOString(); }
  private must(commandId: string): V2Command { const command = this.commands.get(commandId); if (!command) throw new Error("V2_COMMAND_NOT_FOUND"); return command; }
  async markInboundCapture(_commandId: string, _status: "QUEUED" | "FAILED" | "CONFLICT", _safeErrorCode: string | null, _now: Date): Promise<void> { return; }
}

export class PostgresV2CommandStore implements V2CommandStore {
  constructor(private readonly pool: Pool) {}
  async enqueue(input: V2CommandInput): Promise<{ command: V2Command; replayed: boolean }> {
    const digest = input.payloadSha256 ?? payloadDigest(input.payload);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Record<string, unknown>>("SELECT * FROM app.v2_commands WHERE idempotency_key=$1", [input.idempotencyKey]);
      if (existing.rows[0]) {
        if (String(existing.rows[0].payload_sha256) !== digest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
        await client.query("COMMIT");
        return { command: commandView(existing.rows[0]), replayed: true };
      }
      await client.query(
        `INSERT INTO app.v2_commands(command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,next_attempt_at,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,classification)
         VALUES($1,$2,$3,$4,$5,$6,$7,'QUEUED',$8,$9,$10,$11,$8,$8,'SIMULATION_ONLY')`,
        [input.commandId, input.idempotencyKey, digest, input.resourceType, input.resourceId, input.operation, input.payload, input.acceptedAt, input.correlationId, input.actorUserId, input.actorInstitutionId],
      );
      const inserted = await client.query<Record<string, unknown>>("SELECT * FROM app.v2_commands WHERE command_id=$1", [input.commandId]);
      await client.query("COMMIT");
      return { command: commandView(inserted.rows[0] as Record<string, unknown>), replayed: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async get(commandId: string, institutionId: string, roleId: string): Promise<V2Command | null> {
    const result = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_commands WHERE command_id=$1 AND ($2='ROLE-04' OR actor_institution_id=$3)", [commandId, roleId, institutionId]);
    return result.rows[0] ? commandView(result.rows[0]) : null;
  }
  async claim(workerId: string, now: Date, leaseMs = 30_000): Promise<V2Command | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM app.v2_commands WHERE status IN ('QUEUED','RETRY_WAIT','LEDGER_COMMITTED_PROJECTION_PENDING') AND next_attempt_at <= $1 ORDER BY accepted_at,command_id FOR UPDATE SKIP LOCKED LIMIT 1`, [now.toISOString()]);
      if (!result.rows[0]) { await client.query("COMMIT"); return null; }
      const row = result.rows[0];
      const updated = await client.query<Record<string, unknown>>(`UPDATE app.v2_commands SET status='SUBMITTING',attempt_count=attempt_count+1,lease_owner=$2,lease_expires_at=$3,updated_at=$1,version=version+1 WHERE command_id=$4 RETURNING *`, [now.toISOString(), workerId, new Date(now.getTime() + leaseMs).toISOString(), row.command_id]);
      await client.query("COMMIT");
      return commandView(updated.rows[0] as Record<string, unknown>);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async markLedgerCommitted(commandId: string, transactionId: string, now: Date, result?: unknown): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='LEDGER_COMMITTED_PROJECTION_PENDING',ledger_transaction_id=$2,ledger_result=$3,ledger_committed_at=$4,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1 AND ledger_transaction_id IS NULL", [commandId, transactionId, result ?? null, now.toISOString()]); }
  async markCommitted(commandId: string, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='COMMITTED',lease_owner=NULL,lease_expires_at=NULL,updated_at=$2,version=version+1 WHERE command_id=$1", [commandId, now.toISOString()]); }
  async markRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='RETRY_WAIT',safe_error_code=$2,next_attempt_at=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1", [commandId, safeErrorCode, nextAttemptAt.toISOString(), now.toISOString()]); }
  async markProjectionRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='LEDGER_COMMITTED_PROJECTION_PENDING',safe_error_code=$2,next_attempt_at=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1 AND ledger_transaction_id IS NOT NULL", [commandId, safeErrorCode, nextAttemptAt.toISOString(), now.toISOString()]); }
  async markTerminal(commandId: string, status: "FAILED" | "CONFLICT", safeErrorCode: string, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status=$2,safe_error_code=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1", [commandId, status, safeErrorCode, now.toISOString()]); }
  async markInboundCapture(commandId: string, status: "QUEUED" | "FAILED" | "CONFLICT", safeErrorCode: string | null, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_inbound_captures SET status=$2,resolution=CASE WHEN $2='CONFLICT' THEN 'CONFLICT' WHEN $2='FAILED' THEN 'REJECTED' ELSE resolution END,safe_error_code=$3,updated_at=$4 WHERE command_id=$1 OR capture_id=(SELECT resource_id FROM app.v2_commands WHERE command_id=$1)", [commandId, status, safeErrorCode, now.toISOString()]); }
}
