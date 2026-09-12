import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { encryptDonationNumber, type DonationKeyring, validateDonationNumber } from "./donation-crypto.js";
import type { WebPrincipal } from "./session.js";
import type { V2CommandStore, V2ResourceType } from "./v2-command.js";
import type { CensusStore } from "./census-worker.js";
import type { V2ProjectionReader } from "./database-v2.js";

const IDEMPOTENCY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;
const CORRELATION_PATTERN = /^CORR_[0-9A-F]{32}$/;
const COMPONENT_ID_PATTERN = /^COMP_[A-Z0-9_-]{1,56}$/;
const TRANSFER_ID_PATTERN = /^TRF_[A-Z0-9_-]{1,56}$/;
const RESERVATION_ID_PATTERN = /^RES_[A-Z0-9_-]{1,56}$/;
const CASE_ID_PATTERN = /^RECON_[A-Z0-9_-]{1,56}$/;
const INSTITUTION_PATTERN = /^INST_[A-Z0-9_-]{1,59}$/;
const BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
const COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS"] as const;
const URGENCIES = ["ROUTINE", "URGENT", "CRITICAL"] as const;

export interface V2RouteDependencies {
  store: V2CommandStore;
  restore: (request: FastifyRequest) => Promise<{ principal: WebPrincipal }>;
  keyring?: DonationKeyring;
  census?: CensusStore;
  projection?: V2ProjectionReader;
  webOrigin: string;
  clock: () => Date;
}

function hash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase(); }
function generatedId(prefix: string, idempotencyKey: string): string { return `${prefix}${hash(idempotencyKey).slice(0, 40)}`; }
function hasKeys(body: unknown, expected: readonly string[]): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body).sort(); const sorted = [...expected].sort();
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index]);
}
function requiredHeader(request: FastifyRequest): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || !IDEMPOTENCY_PATTERN.test(value)) throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.");
  return value;
}
function requiredBodyString(body: Record<string, unknown>, key: string, pattern?: RegExp): string {
  const value = body[key];
  if (typeof value !== "string" || (pattern && !pattern.test(value))) throw new ApiFailure(400, "V2_INPUT_INVALID", "The V2 command input is invalid.");
  return value;
}
function requiredUtc(body: Record<string, unknown>, key: string): string {
  const value = requiredBodyString(body, key);
  const parsed = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new ApiFailure(400, "V2_TIME_INVALID", "The V2 timestamp is invalid.");
  return value;
}
function authorized(principal: WebPrincipal, allowed: readonly WebPrincipal["roleId"][]): void {
  if (!allowed.includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "The requested V2 operation is not permitted for this role.");
}
function safeCommand(command: Awaited<ReturnType<V2CommandStore["enqueue"]>>["command"], request: FastifyRequest) {
  return {
    commandId: command.commandId,
    resourceType: command.resourceType,
    resourceId: command.resourceId,
    status: command.status,
    statusUrl: `/api/v2/commands/${encodeURIComponent(command.commandId)}`,
    acceptedAt: command.acceptedAt,
    correlationId: command.correlationId,
    safeErrorCode: command.safeErrorCode,
    classification: "SIMULATION_ONLY" as const,
    replayed: Boolean((request as FastifyRequest & { v2Replayed?: boolean }).v2Replayed),
  };
}

export function registerV2Routes(app: FastifyInstance, dependencies: V2RouteDependencies): void {
  const restore = dependencies.restore;
  const sameOrigin = (request: FastifyRequest) => { if (request.headers.origin !== dependencies.webOrigin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted."); };
  const enqueue = async (request: FastifyRequest, reply: FastifyReply, resourceType: V2ResourceType, resourceId: string, operation: string, payload: Record<string, unknown>, principal: WebPrincipal) => {
    const idempotencyKey = requiredHeader(request);
    const correlationId = requiredBodyString(payload, "correlationId", CORRELATION_PATTERN);
    const acceptedAt = dependencies.clock().toISOString();
    const result = await dependencies.store.enqueue({ commandId: generatedId("CMD_", idempotencyKey), idempotencyKey, resourceType, resourceId, operation, payload, correlationId, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, acceptedAt });
    (request as FastifyRequest & { v2Replayed?: boolean }).v2Replayed = result.replayed;
    return reply.status(202).send(safeCommand(result.command, request));
  };

  app.get<{ Params: { commandId: string } }>("/api/v2/commands/:commandId", async (request) => {
    const { principal } = await restore(request);
    const command = await dependencies.store.get(request.params.commandId, principal.institutionId, principal.roleId);
    if (!command) throw new ApiFailure(404, "V2_COMMAND_NOT_FOUND", "The command was not found in the authorized scope.");
    return safeCommand(command, request);
  });

  app.get("/api/v2/components", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The component projection is not available.");
    if (principal.roleId === "ROLE-04") throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not component records.");
    return { scope: "INSTITUTION", components: await dependencies.projection.listComponents(principal.institutionId, principal.roleId), classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Params: { componentId: string } }>("/api/v2/components/:componentId", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The component projection is not available.");
    if (!COMPONENT_ID_PATTERN.test(request.params.componentId)) throw new ApiFailure(400, "V2_COMPONENT_ID_INVALID", "Component ID is invalid.");
    if (principal.roleId === "ROLE-04") throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not component records.");
    const component = await dependencies.projection.getComponent(request.params.componentId, principal.institutionId, principal.roleId);
    if (!component) throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    return component;
  });

  app.post("/api/v2/components", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    if (!dependencies.keyring) throw new ApiFailure(503, "V2_KEYS_UNAVAILABLE", "Donation encryption keys are not available.");
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "collectedAt", "componentType", "correlationId", "donationId", "donationNumber", "eventTime", "expiresAt", "issuerInstitutionId"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Component registration input is invalid.");
    const donationNumber = requiredBodyString(body, "donationNumber"); validateDonationNumber(donationNumber);
    const issuer = requiredBodyString(body, "issuerInstitutionId", INSTITUTION_PATTERN);
    if (issuer !== principal.institutionId) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Component registration is restricted to the custody institution.");
    const componentType = requiredBodyString(body, "componentType"); if (!(COMPONENT_TYPES as readonly string[]).includes(componentType)) throw new ApiFailure(400, "V2_COMPONENT_TYPE_INVALID", "Component type is not supported.");
    const bloodType = requiredBodyString(body, "bloodType"); if (!(BLOOD_TYPES as readonly string[]).includes(bloodType)) throw new ApiFailure(400, "V2_BLOOD_TYPE_INVALID", "Blood type is not supported.");
    const encrypted = encryptDonationNumber(donationNumber, dependencies.keyring);
    const componentId = generatedId("COMP_", requiredHeader(request));
    const payload = { componentId, donationId: requiredBodyString(body, "donationId", /^DON_[A-Z0-9_-]{1,56}$/), issuerInstitutionId: issuer, donationNoCiphertext: encrypted.ciphertext, donationNoNonce: encrypted.nonce, donationNoAuthTag: encrypted.authTag, donationNoEncryptionKeyVersion: encrypted.encryptionKeyVersion, donationNoLookupHmac: encrypted.lookupHmac, componentType, bloodType, collectedAt: requiredUtc(body, "collectedAt"), expiresAt: requiredUtc(body, "expiresAt"), custodyInstitutionId: principal.institutionId, actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    return enqueue(request, reply, "COMPONENT", componentId, "REGISTER_COMPONENT", payload, principal);
  });

  app.post("/api/v2/transfers", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-03"]);
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "quantity", "requestTime", "sourceInstitutionId", "transferId", "urgency"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    if (body.sourceInstitutionId !== "INST_MEDIATRIX" || body.destinationInstitutionId !== principal.institutionId) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Transfer requests must target the authenticated recipient institution.");
    const transferId = requiredBodyString(body, "transferId", TRANSFER_ID_PATTERN); const bloodType = requiredBodyString(body, "bloodType"); const componentType = requiredBodyString(body, "componentType"); const urgency = requiredBodyString(body, "urgency");
    if (!(BLOOD_TYPES as readonly string[]).includes(bloodType) || !(COMPONENT_TYPES as readonly string[]).includes(componentType) || !(URGENCIES as readonly string[]).includes(urgency) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    const payload = { transferId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), urgency, requestTime: requiredUtc(body, "requestTime"), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    return enqueue(request, reply, "TRANSFER", transferId, "SUBMIT_TRANSFER", payload, principal);
  });

  app.post<{ Params: { transferId: string; action: string } }>("/api/v2/transfers/:transferId/:action", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request);
    if (!TRANSFER_ID_PATTERN.test(request.params.transferId)) throw new ApiFailure(400, "V2_TRANSFER_ID_INVALID", "Transfer ID is invalid.");
    const action = request.params.action.toLowerCase();
    const roleMap: Record<string, readonly WebPrincipal["roleId"][]> = { approve: ["ROLE-02"], prepare: ["ROLE-01", "ROLE-02"], dispatch: ["ROLE-01", "ROLE-02"], transit: ["ROLE-01", "ROLE-02"], receipt: ["ROLE-03"], delay: ["ROLE-01", "ROLE-02", "ROLE-03"], compromise: ["ROLE-01", "ROLE-02", "ROLE-03"], cancel: ["ROLE-02", "ROLE-03"], reject: ["ROLE-02"] };
    const roles = roleMap[action]; if (!roles) throw new ApiFailure(404, "V2_ACTION_NOT_FOUND", "Transfer action is not supported."); authorized(principal, roles);
    const actionKeys = action === "delay" || action === "compromise" || action === "cancel" || action === "reject" ? ["correlationId", "eventTime", "expectedVersion", "reasonCode"] : ["correlationId", "eventTime", "expectedVersion"];
    if (!hasKeys(request.body, actionKeys)) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer action input is invalid.");
    const body = request.body as Record<string, unknown>; if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw new ApiFailure(400, "V2_VERSION_INVALID", "Expected version is invalid.");
    const payload: Record<string, unknown> = { transferId: request.params.transferId, expectedVersion: Number(body.expectedVersion), actorUserId: principal.userId, actorInstitutionId: principal.institutionId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    if (body.reasonCode !== undefined) payload.reasonCode = requiredBodyString(body, "reasonCode", /^[A-Z][A-Z0-9_]{2,63}$/);
    return enqueue(request, reply, "TRANSFER", request.params.transferId, action.toUpperCase(), payload, principal);
  });

  app.post("/api/v2/local-releases", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "componentType", "correlationId", "eventTime", "quantity", "releaseId"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Local-release input is invalid.");
    const releaseId = requiredBodyString(body, "releaseId", /^REL_[A-Z0-9_-]{1,56}$/); const bloodType = requiredBodyString(body, "bloodType"); const componentType = requiredBodyString(body, "componentType");
    if (!(BLOOD_TYPES as readonly string[]).includes(bloodType) || !(COMPONENT_TYPES as readonly string[]).includes(componentType) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Local-release input is invalid.");
    const payload = { releaseId, sourceInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    return enqueue(request, reply, "LOCAL_RELEASE", releaseId, "RESERVE_LOCAL_RELEASE", payload, principal);
  });

  app.post("/api/v2/reconciliation", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const body = request.body;
    if (!hasKeys(body, ["caseId", "componentId", "correlationId", "reasonCode"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reconciliation input is invalid.");
    const componentId = requiredBodyString(body, "componentId", COMPONENT_ID_PATTERN); const caseId = requiredBodyString(body, "caseId", CASE_ID_PATTERN); const reasonCode = requiredBodyString(body, "reasonCode", /^[A-Z][A-Z0-9_]{2,63}$/);
    const payload = { componentId, caseId, reasonCode, actorUserId: principal.userId, eventTime: dependencies.clock().toISOString(), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    return enqueue(request, reply, "RECONCILIATION", caseId, "PLACE_RECONCILIATION_HOLD", payload, principal);
  });

  app.post("/api/v2/reports/doh-census/catch-up", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    if (!dependencies.census) throw new ApiFailure(503, "DISABLED_UNAPPROVED_REPORT_FORMAT", "The report policy has not been approved.");
    if (!hasKeys(request.body, ["scheduledFor"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "A scheduled census time is required.");
    const scheduledFor = requiredUtc(request.body as Record<string, unknown>, "scheduledFor");
    const snapshot = await dependencies.census.capture(principal.institutionId, new Date(scheduledFor), "MANUAL", dependencies.clock());
    return reply.status(201).send(snapshot);
  });

  app.get<{ Params: { snapshotId: string } }>("/api/v2/reports/doh-census/:snapshotId", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.census) throw new ApiFailure(503, "DISABLED_UNAPPROVED_REPORT_FORMAT", "The report policy has not been approved.");
    const snapshot = await dependencies.census.get(request.params.snapshotId, principal.roleId === "ROLE-04" ? undefined : principal.institutionId);
    if (!snapshot) throw new ApiFailure(404, "CENSUS_NOT_FOUND", "The census snapshot was not found in the authorized scope.");
    return snapshot;
  });

  app.get<{ Params: { snapshotId: string; componentType: string } }>("/api/v2/reports/doh-census/:snapshotId/:componentType.tsv", async (request, reply) => {
    const { principal } = await restore(request);
    if (!dependencies.census) throw new ApiFailure(503, "DISABLED_UNAPPROVED_REPORT_FORMAT", "The report policy has not been approved.");
    if (!(COMPONENT_TYPES as readonly string[]).includes(request.params.componentType)) throw new ApiFailure(400, "V2_COMPONENT_TYPE_INVALID", "Component type is not supported.");
    const tsv = await dependencies.census.copyRow(request.params.snapshotId, request.params.componentType as typeof COMPONENT_TYPES[number], principal.roleId === "ROLE-04" ? undefined : principal.institutionId);
    if (!tsv) throw new ApiFailure(404, "CENSUS_NOT_FOUND", "The census snapshot was not found in the authorized scope.");
    return reply.type("text/tab-separated-values; charset=utf-8").header("content-disposition", `attachment; filename="${request.params.snapshotId}-${request.params.componentType}.tsv"`).send(tsv);
  });

  app.post<{ Params: { reservationId: string; action: string } }>("/api/v2/reservations/:reservationId/:action", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request);
    if (!RESERVATION_ID_PATTERN.test(request.params.reservationId)) throw new ApiFailure(400, "V2_RESERVATION_ID_INVALID", "Reservation ID is invalid.");
    const action = request.params.action.toLowerCase();
    const body = request.body;
    const allowedActionKeys: Record<string, readonly string[]> = {
      prepare: ["correlationId", "eventTime", "expectedVersion", "preparedAt", "preparedEvidenceDigest", "preparedEvidenceId"],
      compromise: ["correlationId", "eventTime", "expectedVersion", "reasonCode"],
      cancel: ["correlationId", "eventTime", "expectedVersion"],
      dispatch: ["correlationId", "eventTime", "expectedVersion"],
      transit: ["correlationId", "eventTime", "expectedVersion"],
      receive: ["correlationId", "eventTime", "expectedVersion"],
      "local-release-complete": ["correlationId", "eventTime", "expectedVersion"],
    };
    if (!hasKeys(body, allowedActionKeys[action] ?? [])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reservation action input is invalid.");
    if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw new ApiFailure(400, "V2_VERSION_INVALID", "Expected version is invalid.");
    const roleMap: Record<string, readonly WebPrincipal["roleId"][]> = { prepare: ["ROLE-01", "ROLE-02"], dispatch: ["ROLE-01", "ROLE-02"], transit: ["ROLE-01", "ROLE-02"], receive: ["ROLE-03"], cancel: ["ROLE-01", "ROLE-02", "ROLE-03"], "local-release-complete": ["ROLE-01", "ROLE-02"], compromise: ["ROLE-01", "ROLE-02", "ROLE-03"] };
    const roles = roleMap[action]; if (!roles) throw new ApiFailure(404, "V2_ACTION_NOT_FOUND", "Reservation action is not supported."); authorized(principal, roles);
    const payload: Record<string, unknown> = { reservationId: request.params.reservationId, expectedVersion: Number(body.expectedVersion), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN) };
    for (const key of ["preparedEvidenceDigest", "preparedEvidenceId", "preparedAt", "reasonCode"] as const) if (body[key] !== undefined) payload[key] = body[key];
    return enqueue(request, reply, "TRANSFER", request.params.reservationId, action.toUpperCase(), payload, principal);
  });
}
