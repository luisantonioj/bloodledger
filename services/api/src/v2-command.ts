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
  verificationSessionId?: string;
  operatorVersion?: number;
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
  // Resolves true only for an exact operation of the active approved population manifest.
  assertPopulationRequest?(path: string, body: unknown, idempotencyKey: unknown): Promise<boolean>;
  enqueue(input: V2CommandInput): Promise<{ command: V2Command; replayed: boolean }>;
  get(commandId: string, institutionId: string, userId: string): Promise<V2Command | null>;
  list(institutionId: string, userId: string, limit: number, cursor?: string, idempotencyKey?: string): Promise<{ commands: V2Command[]; nextCursor: string | null }>;
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
    payloadSha256: String(row.payload_sha256),
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
      if (existing.actorInstitutionId !== input.actorInstitutionId || existing.actorUserId !== input.actorUserId) throw new ApiFailure(409, "V2_IDEMPOTENCY_SCOPE_CONFLICT", "Idempotency key belongs to another authenticated scope.");
      if (existing.payloadSha256 !== digest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return { command: existing, replayed: true };
    }
    const command: V2Command = { ...input, payloadSha256: digest, status: "QUEUED", attemptCount: 0, nextAttemptAt: input.acceptedAt, ledgerTransactionId: null, ledgerResult: null, safeErrorCode: null, classification: "SIMULATION_ONLY", updatedAt: input.acceptedAt };
    this.commands.set(command.commandId, command);
    return { command, replayed: false };
  }
  async get(commandId: string, institutionId: string, userId: string): Promise<V2Command | null> {
    const command = this.commands.get(commandId);
    if (!command || command.actorInstitutionId !== institutionId || command.actorUserId !== userId) return null;
    return command;
  }
  async list(institutionId: string, userId: string, limit: number, cursor?: string, idempotencyKey?: string): Promise<{ commands: V2Command[]; nextCursor: string | null }> {
    const matches = [...this.commands.values()].filter((command) => command.actorInstitutionId === institutionId && command.actorUserId === userId && (!cursor || command.commandId > cursor) && (!idempotencyKey || command.idempotencyKey === idempotencyKey)).sort((left, right) => left.commandId.localeCompare(right.commandId));
    const hasMore = matches.length > limit; const commands = matches.slice(0, limit);
    return { commands, nextCursor: hasMore ? commands.at(-1)?.commandId ?? null : null };
  }
  async claim(_workerId: string, now: Date, leaseMs = 30_000): Promise<V2Command | null> {
    const command = [...this.commands.values()].filter((item) => ["QUEUED", "RETRY_WAIT", "LEDGER_COMMITTED_PROJECTION_PENDING"].includes(item.status) && new Date(item.nextAttemptAt) <= now).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.commandId.localeCompare(b.commandId))[0];
    if (!command) return null;
    command.status = "SUBMITTING"; command.attemptCount += 1; command.updatedAt = now.toISOString();
    void leaseMs;
    return command;
  }
  async markLedgerCommitted(commandId: string, transactionId: string, now: Date, result?: unknown): Promise<void> { const command = this.must(commandId); if (command.ledgerTransactionId !== null && command.ledgerTransactionId !== transactionId) throw new Error("V2_LEDGER_COMMITMENT_CONFLICT"); command.status = "LEDGER_COMMITTED_PROJECTION_PENDING"; command.ledgerTransactionId = transactionId; command.ledgerResult = result ?? null; command.updatedAt = now.toISOString(); }
  async markCommitted(commandId: string, now: Date): Promise<void> { const command = this.must(commandId); command.status = "COMMITTED"; command.updatedAt = now.toISOString(); }
  async markRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { const command = this.must(commandId); command.status = "RETRY_WAIT"; command.safeErrorCode = safeErrorCode; command.nextAttemptAt = nextAttemptAt.toISOString(); command.updatedAt = now.toISOString(); }
  async markProjectionRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { const command = this.must(commandId); command.status = "LEDGER_COMMITTED_PROJECTION_PENDING"; command.safeErrorCode = safeErrorCode; command.nextAttemptAt = nextAttemptAt.toISOString(); command.updatedAt = now.toISOString(); }
  async markTerminal(commandId: string, status: "FAILED" | "CONFLICT", safeErrorCode: string, now: Date): Promise<void> { const command = this.must(commandId); command.status = status; command.safeErrorCode = safeErrorCode; command.updatedAt = now.toISOString(); }
  private must(commandId: string): V2Command { const command = this.commands.get(commandId); if (!command) throw new Error("V2_COMMAND_NOT_FOUND"); return command; }
  async markInboundCapture(_commandId: string, _status: "QUEUED" | "FAILED" | "CONFLICT", _safeErrorCode: string | null, _now: Date): Promise<void> { return; }
}

export class PostgresV2CommandStore implements V2CommandStore {
  constructor(private readonly pool: Pool) {}
  async assertPopulationRequest(path: string, body: unknown, idempotencyKey: unknown): Promise<boolean> {
    const run = (await this.pool.query<Record<string, unknown>>("SELECT manifest FROM app.operational_stock_runs WHERE writer_lock")).rows[0];
    if (!run) return false;
    const manifest = run.manifest as { operations: Array<{ path: string; payloadSha256: string; idempotencyKey: string }> };
    const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
    const digest = createHash("sha256").update(stable(body)).digest("hex");
    if (!manifest.operations.some(operation => operation.path === path && operation.idempotencyKey === idempotencyKey && operation.payloadSha256 === digest)) throw new ApiFailure(409, "V2_CONTROLLED_POPULATION_LOCKED", "Inventory writers are quiesced for an approved simulation population.");
    return true;
  }
  async enqueue(input: V2CommandInput): Promise<{ command: V2Command; replayed: boolean }> {
    const digest = input.payloadSha256 ?? payloadDigest(input.payload);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const activeRun = (await client.query<Record<string, unknown>>("SELECT manifest FROM app.operational_stock_runs WHERE writer_lock FOR SHARE")).rows[0];
      if (activeRun) {
        const manifest = activeRun.manifest as { operations: Array<{ commandId: string; account: string }>; principals: Record<string, { userId: string; institutionId: string }> };
        const operation = manifest.operations.find(operation => operation.commandId === input.commandId);
        const actor = operation && manifest.principals[operation.account];
        if (!actor || actor.userId !== input.actorUserId || actor.institutionId !== input.actorInstitutionId) throw new ApiFailure(409, "V2_CONTROLLED_POPULATION_LOCKED", "Inventory writers are quiesced for an approved simulation population.");
      }
      const existing = await client.query<Record<string, unknown>>("SELECT * FROM app.v2_commands WHERE idempotency_key=$1", [input.idempotencyKey]);
      if (existing.rows[0]) {
        if (String(existing.rows[0].actor_institution_id) !== input.actorInstitutionId || String(existing.rows[0].actor_user_id) !== input.actorUserId) throw new ApiFailure(409, "V2_IDEMPOTENCY_SCOPE_CONFLICT", "Idempotency key belongs to another authenticated scope.");
        if (String(existing.rows[0].payload_sha256) !== digest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
        await client.query("COMMIT");
        return { command: commandView(existing.rows[0]), replayed: true };
      }
      const reservationScope=typeof input.payload.reservationId==='string'?(await client.query<Record<string,unknown>>("SELECT r.institution_id,t.destination_institution_id FROM app.v2_reservations r LEFT JOIN app.v2_transfer_requests t USING(transfer_id) WHERE r.reservation_id=$1",[input.payload.reservationId])).rows[0]:undefined;
      const scopes=[input.actorInstitutionId,input.payload.sourceInstitutionId,input.payload.destinationInstitutionId,reservationScope?.institution_id,reservationScope?.destination_institution_id].filter((v):v is string=>typeof v==='string');
      const locked=await client.query<Record<string,unknown>>("SELECT institution_id,status,account_model FROM app.institutions WHERE institution_id=ANY($1::text[]) ORDER BY institution_id FOR UPDATE",[scopes]);
      const activeInstitution={rows:locked.rows.filter(r=>r.institution_id===input.actorInstitutionId)};
      if(input.payload.policyVersion==='SYNTHETIC_INSTITUTION_CORE_V1'&&locked.rows.some(r=>r.status!=='ACTIVE'))throw new ApiFailure(403,'AUTH_SCOPE_FORBIDDEN','A workflow institution is inactive.');
      if(activeInstitution.rows[0]?.account_model==="INSTITUTION_V1"){
        const activeOperator=await client.query("SELECT 1 FROM app.institution_operators o JOIN app.application_users u ON u.user_id=o.account_id WHERE o.operator_id=$1 AND o.institution_id=$2 AND o.status='ACTIVE' AND u.status='ACTIVE' AND o.version=$3 AND EXISTS(SELECT 1 FROM app.application_sessions s WHERE s.user_id=o.account_id AND s.session_id=$4 AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP) FOR UPDATE OF o,u",[input.actorUserId,input.actorInstitutionId,input.operatorVersion,input.verificationSessionId]);
        if(activeInstitution.rows[0].status!=="ACTIVE"||!activeOperator.rows.length)throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Institution/operator is not active.");
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
  async get(commandId: string, institutionId: string, userId: string): Promise<V2Command | null> {
    const result = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_commands WHERE command_id=$1 AND actor_institution_id=$2 AND (actor_user_id=$3 OR actor_user_id IN (SELECT operator_id FROM app.institution_operators WHERE account_id=$3 AND institution_id=$2))", [commandId, institutionId, userId]);
    return result.rows[0] ? commandView(result.rows[0]) : null;
  }
  async list(institutionId: string, userId: string, limit: number, cursor?: string, idempotencyKey?: string): Promise<{ commands: V2Command[]; nextCursor: string | null }> {
    const values: unknown[] = [institutionId, userId]; const conditions = ["actor_institution_id=$1", "(actor_user_id=$2 OR actor_user_id IN (SELECT operator_id FROM app.institution_operators WHERE account_id=$2 AND institution_id=$1))"];
    if (cursor) { values.push(cursor); conditions.push(`command_id>$${values.length}`); }
    if (idempotencyKey) { values.push(idempotencyKey); conditions.push(`idempotency_key=$${values.length}`); }
    values.push(limit + 1);
    const result = await this.pool.query<Record<string, unknown>>(`SELECT * FROM app.v2_commands WHERE ${conditions.join(" AND ")} ORDER BY command_id LIMIT $${values.length}`, values);
    const hasMore = result.rows.length > limit; const commands = result.rows.slice(0, limit).map(commandView);
    return { commands, nextCursor: hasMore ? commands.at(-1)?.commandId ?? null : null };
  }
  async claim(workerId: string, now: Date, leaseMs = 30_000): Promise<V2Command | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE app.v2_commands SET status=CASE WHEN ledger_transaction_id IS NULL THEN 'RETRY_WAIT' ELSE 'LEDGER_COMMITTED_PROJECTION_PENDING' END,lease_owner=NULL,lease_expires_at=NULL,next_attempt_at=$1,updated_at=$1,version=version+1 WHERE status='SUBMITTING' AND lease_expires_at <= $1 AND NOT EXISTS(SELECT 1 FROM app.development_seed_commands s WHERE s.command_id=app.v2_commands.command_id) AND NOT EXISTS(SELECT 1 FROM app.operational_stock_commands s WHERE s.command_id=app.v2_commands.command_id)", [now.toISOString()]);
      const result = await client.query<Record<string, unknown>>(`SELECT * FROM app.v2_commands WHERE status IN ('QUEUED','RETRY_WAIT','LEDGER_COMMITTED_PROJECTION_PENDING') AND next_attempt_at <= $1 AND NOT EXISTS(SELECT 1 FROM app.development_seed_commands s WHERE s.command_id=app.v2_commands.command_id) AND NOT EXISTS(SELECT 1 FROM app.operational_stock_commands s WHERE s.command_id=app.v2_commands.command_id) ORDER BY accepted_at,command_id FOR UPDATE SKIP LOCKED LIMIT 1`, [now.toISOString()]);
      if (!result.rows[0]) { await client.query("COMMIT"); return null; }
      const row = result.rows[0];
      const updated = await client.query<Record<string, unknown>>(`UPDATE app.v2_commands SET status='SUBMITTING',attempt_count=attempt_count+1,lease_owner=$2,lease_expires_at=$3,updated_at=$1,version=version+1 WHERE command_id=$4 RETURNING *`, [now.toISOString(), workerId, new Date(now.getTime() + leaseMs).toISOString(), row.command_id]);
      await client.query("COMMIT");
      return commandView(updated.rows[0] as Record<string, unknown>);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async markLedgerCommitted(commandId: string, transactionId: string, now: Date, result?: unknown): Promise<void> {
    const updated = await this.pool.query("UPDATE app.v2_commands SET status='LEDGER_COMMITTED_PROJECTION_PENDING',ledger_transaction_id=$2,ledger_result=$3,ledger_committed_at=$4,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1 AND ledger_transaction_id IS NULL", [commandId, transactionId, result ?? null, now.toISOString()]);
    if (updated.rowCount === 0) {
      const existing = await this.pool.query<{ ledger_transaction_id: string | null }>("SELECT ledger_transaction_id FROM app.v2_commands WHERE command_id=$1", [commandId]);
      if (!existing.rows[0] || existing.rows[0].ledger_transaction_id !== transactionId) throw new Error("V2_LEDGER_COMMITMENT_CONFLICT");
    }
  }
  async markCommitted(commandId: string, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='COMMITTED',lease_owner=NULL,lease_expires_at=NULL,updated_at=$2,version=version+1 WHERE command_id=$1", [commandId, now.toISOString()]); }
  async markRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='RETRY_WAIT',safe_error_code=$2,next_attempt_at=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1", [commandId, safeErrorCode, nextAttemptAt.toISOString(), now.toISOString()]); }
  async markProjectionRetry(commandId: string, safeErrorCode: string, nextAttemptAt: Date, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status='LEDGER_COMMITTED_PROJECTION_PENDING',safe_error_code=$2,next_attempt_at=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1 AND ledger_transaction_id IS NOT NULL", [commandId, safeErrorCode, nextAttemptAt.toISOString(), now.toISOString()]); }
  async markTerminal(commandId: string, status: "FAILED" | "CONFLICT", safeErrorCode: string, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_commands SET status=$2,safe_error_code=$3,lease_owner=NULL,lease_expires_at=NULL,updated_at=$4,version=version+1 WHERE command_id=$1", [commandId, status, safeErrorCode, now.toISOString()]); }
  async markInboundCapture(commandId: string, status: "QUEUED" | "FAILED" | "CONFLICT", safeErrorCode: string | null, now: Date): Promise<void> { await this.pool.query("UPDATE app.v2_inbound_captures SET status=$2::varchar,resolution=CASE WHEN $2::text='CONFLICT' THEN 'CONFLICT' WHEN $2::text='FAILED' THEN 'REJECTED' ELSE resolution END,safe_error_code=$3::varchar,updated_at=$4 WHERE command_id=$1 OR capture_id=(SELECT resource_id FROM app.v2_commands WHERE command_id=$1)", [commandId, status, safeErrorCode, now.toISOString()]); }
}
