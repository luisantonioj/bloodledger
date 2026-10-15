import type { Pool, PoolClient } from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { identityTransaction, lockActiveOperator } from "./operator-verification.js";
import type { WebPrincipal } from "./session.js";

// PA-DEF-06 / ADR-044 SYNTHETIC_PRC_SUPPLY_V1: off-chain PRC supply coordination. A request never
// changes inventory; supplied units enter only through confirmed inbound OCR capture.
export const PRC_SUPPLY_POLICY_VERSION = "SYNTHETIC_PRC_SUPPLY_V1";
export const PRC_BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
export const PRC_COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"] as const;
export const PRC_URGENCIES = ["ROUTINE", "URGENT", "CRITICAL"] as const;
export const PRC_DECLINE_REASONS = ["NO_STOCK", "OUT_OF_SCOPE", "DUPLICATE_REQUEST", "DEADLINE_NOT_FEASIBLE"] as const;
export const PRC_ACTIONS = ["cancel", "acknowledge", "fulfil", "decline"] as const;
export type PrcAction = (typeof PRC_ACTIONS)[number];
const MAX_QUANTITY = 10;
const MIN_LEAD_MS = 60 * 60_000;
const MAX_LEAD_MS = 30 * 24 * 60 * 60_000;
const REQUEST_ID = /^PRCSR_[A-Z0-9]{40}$/;
const REFERENCE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const CURSOR = /^PRCS_[A-Za-z0-9_-]{1,140}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Row = Record<string, unknown>;
const invalid = (): never => { throw new ApiFailure(400, "PRC_SUPPLY_INPUT_INVALID", "The PRC supply request input is invalid."); };
const forbidden = (): never => { throw new ApiFailure(403, "PRC_SUPPLY_NOT_AUTHORIZED", "This PRC supply action is not permitted for the account."); };
const notFound = (): never => { throw new ApiFailure(404, "PRC_SUPPLY_NOT_FOUND", "The PRC supply request was not found in the authorized scope."); };
const conflict = (code: string): never => { throw new ApiFailure(409, code, "The PRC supply action conflicts with the current request state."); };

function exact(value: unknown, keys: readonly string[]): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const actual = Object.keys(value as Row).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) invalid();
  return value as Row;
}
function correlation(body: Row): string {
  if (typeof body.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(body.correlationId)) invalid();
  return body.correlationId as string;
}
function expectedVersion(body: Row): number {
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) invalid();
  return Number(body.expectedVersion);
}
function oneOf<T extends readonly string[]>(value: unknown, values: T): T[number] {
  if (typeof value !== "string" || !values.includes(value)) invalid();
  return value as T[number];
}

export interface SubmitInput { bloodType: string; componentType: string; requestedQuantity: number; urgency: string; requiredBy: string; correlationId: string }

export function validateSubmission(value: unknown, now: Date): SubmitInput {
  const body = exact(value, ["bloodType", "componentType", "requestedQuantity", "urgency", "requiredBy", "correlationId"]);
  const requestedQuantity = body.requestedQuantity;
  if (!Number.isSafeInteger(requestedQuantity) || Number(requestedQuantity) < 1 || Number(requestedQuantity) > MAX_QUANTITY) invalid();
  if (typeof body.requiredBy !== "string" || !UTC.test(body.requiredBy) || new Date(body.requiredBy).toISOString() !== body.requiredBy) invalid();
  const lead = Date.parse(body.requiredBy as string) - now.getTime();
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) throw new ApiFailure(400, "PRC_SUPPLY_REQUIRED_BY_OUT_OF_WINDOW", "Required by must be between 1 hour and 30 days after submission.");
  return { bloodType: oneOf(body.bloodType, PRC_BLOOD_TYPES), componentType: oneOf(body.componentType, PRC_COMPONENT_TYPES), requestedQuantity: Number(requestedQuantity), urgency: oneOf(body.urgency, PRC_URGENCIES), requiredBy: body.requiredBy as string, correlationId: correlation(body) };
}

export interface ActionInput { expectedVersion: number; correlationId: string; prcReference?: string; fulfilledQuantity?: number; reasonCode?: string }

export function validateAction(action: PrcAction, value: unknown): ActionInput {
  const extra = action === "acknowledge" ? ["prcReference"] : action === "fulfil" ? ["fulfilledQuantity"] : action === "decline" ? ["reasonCode"] : [];
  const body = exact(value, ["expectedVersion", "correlationId", ...extra]);
  const input: ActionInput = { expectedVersion: expectedVersion(body), correlationId: correlation(body) };
  if (action === "acknowledge") { if (typeof body.prcReference !== "string" || !REFERENCE.test(body.prcReference)) invalid(); input.prcReference = body.prcReference as string; }
  if (action === "fulfil") { if (!Number.isSafeInteger(body.fulfilledQuantity) || Number(body.fulfilledQuantity) < 1) invalid(); input.fulfilledQuantity = Number(body.fulfilledQuantity); }
  if (action === "decline") input.reasonCode = oneOf(body.reasonCode, PRC_DECLINE_REASONS);
  return input;
}

// Allowed source states and resulting state for each action.
export const PRC_TRANSITIONS: Record<PrcAction, { from: readonly string[]; to: string; actor: "REQUESTER" | "PRC" }> = {
  cancel: { from: ["SUBMITTED"], to: "CANCELLED", actor: "REQUESTER" },
  acknowledge: { from: ["SUBMITTED"], to: "ACKNOWLEDGED", actor: "PRC" },
  fulfil: { from: ["ACKNOWLEDGED"], to: "FULFILLED", actor: "PRC" },
  decline: { from: ["SUBMITTED", "ACKNOWLEDGED"], to: "DECLINED", actor: "PRC" },
};

export function isRequester(principal: WebPrincipal): boolean {
  return principal.accountCategory === "BLOOD_BANK" && Boolean(principal.operatorId) && principal.roleId === "ROLE-02";
}
export function isPrcResponder(principal: WebPrincipal): boolean {
  return principal.accountCategory === "PRC" && Boolean(principal.operatorId) && (principal.administrativeCapabilities ?? []).includes("prc-supply:respond");
}
// Reads: the requesting blood bank (account or ROLE-01/02 operator) sees its own requests; PRC sees all.
export function readScope(principal: WebPrincipal): { all: true } | { institutionId: string } {
  if (principal.accountCategory === "PRC") return { all: true };
  if (principal.accountCategory === "BLOOD_BANK" && ["ROLE-01", "ROLE-02"].includes(principal.roleId)) return { institutionId: principal.institutionId };
  return forbidden();
}

const iso = (value: unknown) => value === null || value === undefined ? null : new Date(String(value)).toISOString();
const text = (value: unknown) => value === null || value === undefined ? null : String(value);

export function presentRequest(row: Row) {
  return {
    requestId: String(row.request_id),
    requestingInstitution: { institutionId: String(row.requesting_institution_id), displayName: text(row.institution_name) },
    bloodType: String(row.blood_type),
    componentType: String(row.component_type),
    requestedQuantity: Number(row.requested_quantity),
    fulfilledQuantity: row.fulfilled_quantity === null || row.fulfilled_quantity === undefined ? null : Number(row.fulfilled_quantity),
    urgency: String(row.urgency),
    requiredBy: iso(row.required_by)!,
    status: String(row.status),
    prcReference: text(row.prc_reference),
    referenceProvenance: row.prc_reference ? "PRC_RECORDED_IN_SYSTEM" as const : null,
    declineReason: text(row.decline_reason),
    submittedAt: iso(row.submitted_at)!,
    acknowledgedAt: iso(row.acknowledged_at),
    closedAt: iso(row.closed_at),
    version: Number(row.version),
    ledger: { status: "NOT_APPLICABLE" as const },
    policyVersion: PRC_SUPPLY_POLICY_VERSION,
    classification: "SIMULATION_ONLY" as const,
  };
}

export function decodePrcCursor(value: unknown): { submittedAt: string; requestId: string } | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !CURSOR.test(value)) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  const [submittedAt, requestId, extra] = Buffer.from(value.slice(5), "base64url").toString("utf8").split("|");
  if (extra !== undefined || !requestId || !REQUEST_ID.test(requestId) || !UTC.test(submittedAt ?? "") || new Date(submittedAt).toISOString() !== submittedAt) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
  return { submittedAt, requestId };
}
const encodePrcCursor = (row: { submittedAt: string; requestId: string }) => `PRCS_${Buffer.from(`${row.submittedAt}|${row.requestId}`, "utf8").toString("base64url")}`;

const SELECT = "SELECT p.*,i.display_name AS institution_name FROM app.prc_supply_requests p JOIN app.institutions i ON i.institution_id=p.requesting_institution_id";

export class PostgresPrcSupply {
  constructor(readonly pool: Pool) {}

  async list(principal: WebPrincipal, limit: number, cursor: { submittedAt: string; requestId: string } | null) {
    const scope = readScope(principal);
    const values: unknown[] = ["institutionId" in scope ? scope.institutionId : null, cursor?.submittedAt ?? null, cursor?.requestId ?? null, limit + 1];
    const result = await this.pool.query<Row>(`${SELECT} WHERE ($1::text IS NULL OR p.requesting_institution_id=$1) AND ($2::timestamptz IS NULL OR (p.submitted_at,p.request_id)<($2::timestamptz,$3::text)) ORDER BY p.submitted_at DESC,p.request_id DESC LIMIT $4`, values);
    const rows = result.rows.slice(0, limit).map(presentRequest);
    const last = rows.at(-1);
    return { scope: "institutionId" in scope ? "INSTITUTION" as const : "PRC_ALL" as const, rows, nextCursor: result.rows.length > limit && last ? encodePrcCursor(last) : null, policyVersion: PRC_SUPPLY_POLICY_VERSION, classification: "SIMULATION_ONLY" as const };
  }

  async detail(principal: WebPrincipal, requestId: string) {
    const scope = readScope(principal);
    if (!REQUEST_ID.test(requestId)) invalid();
    const result = await this.pool.query<Row>(`${SELECT} WHERE p.request_id=$1 AND ($2::text IS NULL OR p.requesting_institution_id=$2)`, [requestId, "institutionId" in scope ? scope.institutionId : null]);
    if (!result.rows[0]) notFound();
    // Audit trail of this request's actions; PRC actions are visible to the requester, never other requests.
    const history = await this.pool.query<Row>("SELECT a.action,a.prior_status,a.resulting_status,a.reason_code,a.actor_id,a.actor_institution_id,a.created_at,u.display_name FROM app.account_audit a LEFT JOIN app.application_users u ON u.user_id=a.actor_id WHERE a.subject_id=$1 AND a.action LIKE 'PRC_SUPPLY_%' ORDER BY a.created_at,a.audit_id", [requestId]);
    return {
      ...presentRequest(result.rows[0]),
      history: history.rows.map((row) => ({ action: String(row.action), priorStatus: text(row.prior_status), resultingStatus: text(row.resulting_status), reasonCode: text(row.reason_code), actor: { reference: String(row.actor_id), institutionId: text(row.actor_institution_id), displayName: text(row.display_name) }, recordedAt: iso(row.created_at)! })),
    };
  }

  // Idempotent, audited off-chain write: the same actor and key with the same body replays the stored result.
  private async audited(client: PoolClient, principal: WebPrincipal, action: string, subjectId: string, body: unknown, idempotencyKey: string, correlationId: string, now: Date, run: () => Promise<{ result: Row; prior: string | null; resulting: string; reason: string | null }>): Promise<Row> {
    if (!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idempotencyKey)) throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`prc-supply:${principal.userId}:${idempotencyKey}`]);
    const digest = sha256({ action, subjectId, body });
    const prior = await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2", [principal.userId, idempotencyKey]);
    if (prior.rows[0]) {
      if (prior.rows[0].payload_sha256 !== digest) conflict("PRC_SUPPLY_IDEMPOTENCY_CONFLICT");
      return { ...(prior.rows[0].result as Row), replayed: true };
    }
    await lockActiveOperator(client, principal);
    const outcome = await run();
    await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,prior_status,resulting_status,reason_code,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [`AUD_${sha256({ actor: principal.userId, idempotencyKey }).slice(0, 40).toUpperCase()}`, principal.userId, principal.institutionId, subjectId, action, outcome.prior, outcome.resulting, outcome.reason, correlationId, idempotencyKey, digest, outcome.result, now]);
    return { ...outcome.result, replayed: false };
  }

  async submit(principal: WebPrincipal, value: unknown, idempotencyKey: string, now: Date): Promise<Row> {
    if (!isRequester(principal)) forbidden();
    const input = validateSubmission(value, now);
    const requestId = `PRCSR_${sha256({ actor: principal.userId, idempotencyKey }).slice(0, 40).toUpperCase()}`;
    return identityTransaction(this.pool, (client) => this.audited(client, principal, "PRC_SUPPLY_SUBMIT", requestId, value, idempotencyKey, input.correlationId, now, async () => {
      await client.query("INSERT INTO app.prc_supply_requests(request_id,requesting_institution_id,blood_type,component_type,requested_quantity,urgency,required_by,status,submitted_by,submitted_at,correlation_id,policy_version,classification) VALUES($1,$2,$3,$4,$5,$6,$7,'SUBMITTED',$8,$9,$10,$11,'SIMULATION_ONLY')",
        [requestId, principal.institutionId, input.bloodType, input.componentType, input.requestedQuantity, input.urgency, input.requiredBy, principal.userId, now, input.correlationId, PRC_SUPPLY_POLICY_VERSION]);
      const row = await client.query<Row>(`${SELECT} WHERE p.request_id=$1`, [requestId]);
      return { result: presentRequest(row.rows[0]), prior: null, resulting: "SUBMITTED", reason: null };
    }));
  }

  async act(principal: WebPrincipal, requestId: string, action: PrcAction, value: unknown, idempotencyKey: string, now: Date): Promise<Row> {
    const transition = PRC_TRANSITIONS[action];
    if (transition.actor === "REQUESTER" ? !isRequester(principal) : !isPrcResponder(principal)) forbidden();
    if (!REQUEST_ID.test(requestId)) invalid();
    const input = validateAction(action, value);
    return identityTransaction(this.pool, (client) => this.audited(client, principal, `PRC_SUPPLY_${action.toUpperCase()}`, requestId, value, idempotencyKey, input.correlationId, now, async () => {
      const current = await client.query<Row>("SELECT * FROM app.prc_supply_requests WHERE request_id=$1 FOR UPDATE", [requestId]);
      const row = current.rows[0];
      // A requester never learns that another institution's request exists.
      if (!row || (transition.actor === "REQUESTER" && row.requesting_institution_id !== principal.institutionId)) notFound();
      if (Number(row!.version) !== input.expectedVersion) conflict("PRC_SUPPLY_VERSION_CONFLICT");
      if (!transition.from.includes(String(row!.status))) conflict("PRC_SUPPLY_TRANSITION_INVALID");
      if (action === "fulfil" && input.fulfilledQuantity! > Number(row!.requested_quantity)) invalid();
      if (action === "acknowledge") {
        const taken = await client.query("SELECT 1 FROM app.prc_supply_requests WHERE prc_reference=$1", [input.prcReference]);
        if (taken.rows.length) conflict("PRC_SUPPLY_REFERENCE_CONFLICT");
        await client.query("UPDATE app.prc_supply_requests SET status='ACKNOWLEDGED',prc_reference=$2,acknowledged_by=$3,acknowledged_at=$4,version=version+1 WHERE request_id=$1", [requestId, input.prcReference, principal.userId, now]);
      } else if (action === "fulfil") {
        await client.query("UPDATE app.prc_supply_requests SET status='FULFILLED',fulfilled_quantity=$2,closed_by=$3,closed_at=$4,version=version+1 WHERE request_id=$1", [requestId, input.fulfilledQuantity, principal.userId, now]);
      } else if (action === "decline") {
        await client.query("UPDATE app.prc_supply_requests SET status='DECLINED',decline_reason=$2,closed_by=$3,closed_at=$4,version=version+1 WHERE request_id=$1", [requestId, input.reasonCode, principal.userId, now]);
      } else {
        await client.query("UPDATE app.prc_supply_requests SET status='CANCELLED',closed_by=$2,closed_at=$3,version=version+1 WHERE request_id=$1", [requestId, principal.userId, now]);
      }
      const updated = await client.query<Row>(`${SELECT} WHERE p.request_id=$1`, [requestId]);
      return { result: presentRequest(updated.rows[0]), prior: String(row!.status), resulting: transition.to, reason: input.reasonCode ?? null };
    }));
  }
}

function pageLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 100) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page size must be between 1 and 100.");
  return Number(value);
}

export function registerPrcSupplyRoutes(app: FastifyInstance, service: PostgresPrcSupply, restore: (request: FastifyRequest) => Promise<{ principal: WebPrincipal }>, origin: string, clock: () => Date): void {
  const sameOrigin = (request: FastifyRequest) => { if (request.headers.origin !== origin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted."); };
  const idempotencyKey = (request: FastifyRequest) => String(request.headers["idempotency-key"] ?? "");
  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/v2/prc-supply-requests", async (request) => service.list((await restore(request)).principal, pageLimit(request.query.limit), decodePrcCursor(request.query.cursor)));
  app.get<{ Params: { requestId: string } }>("/api/v2/prc-supply-requests/:requestId", async (request) => service.detail((await restore(request)).principal, request.params.requestId));
  app.post("/api/v2/prc-supply-requests", async (request) => { sameOrigin(request); return service.submit((await restore(request)).principal, request.body, idempotencyKey(request), clock()); });
  app.post<{ Params: { requestId: string; action: string } }>("/api/v2/prc-supply-requests/:requestId/:action", async (request) => {
    sameOrigin(request);
    if (!(PRC_ACTIONS as readonly string[]).includes(request.params.action)) throw new ApiFailure(404, "PRC_SUPPLY_ACTION_NOT_FOUND", "PRC supply action is not supported.");
    return service.act((await restore(request)).principal, request.params.requestId, request.params.action as PrcAction, request.body, idempotencyKey(request), clock());
  });
}
