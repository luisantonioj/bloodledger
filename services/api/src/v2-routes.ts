import { BANK_INSTITUTION_IDS } from "./institution-access.js";
import { selectCorePolicy } from "./persistent-development-policy.js";
import { registerDevelopmentReads, type DevelopmentReader } from "./development-read.js";
import { readInventoryEvidence, validEvidenceDate, type MlInventoryEvidenceReader } from "./inventory-evidence.js";
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { encryptDonationNumber, type DonationKeyring } from "./donation-crypto.js";
import type { WebPrincipal } from "./session.js";
import type { V2CommandStore, V2ResourceType } from "./v2-command.js";
import type { CensusStore } from "./census-worker.js";
import type { V2ProjectionReader } from "./database-v2.js";
import { requireOcrLabelEvidence, validateInboundOcrInput } from "./inbound-ocr-policy.js";
import { resolveLabelIdentity, type LabelIdentity, type SealedDonationNumber } from "./label-identity.js";
import { assembleUnitHistory, decodeHistoryCursor, type UnitHistoryReader } from "./unit-history.js";
import { assembleTransferSummaries, decodeSummaryCursor, type TransferSummaryReader } from "./transfer-summary.js";
import { activityContract, assembleActivityHistory, decodeActivityCursor, type ActivityHistoryReader } from "./activity-history.js";
import { assembleNetworkAvailability, assembleRequestHistory, assembleSummary, bloodBankRoutes, parseHistoryRange, type BloodBankReader } from "./blood-bank-reads.js";
import type { PostgresOutboundVerification } from "./outbound-verification.js";
import { assertReceiptEvidence, RECEIPT_EVIDENCE_ID_PATTERN, type PostgresReceiptVerification } from "./receipt-verification.js";
import { isReconciliationReasonCode, RECONCILIATION_POLICY_VERSION, RECONCILIATION_REASONS } from "./reconciliation-policy.js";
import { COMPROMISE_POLICY_VERSION, COMPROMISE_REASONS, isCompromiseReasonCode } from "./compromise-policy.js";
import { DOH_CENSUS_DISPLAY_ORDER, DOH_CENSUS_DISPLAY_POLICY_VERSION } from "./report-policy.js";
import { COORDINATION_BLOOD_TYPES, COORDINATION_COMPONENT_TYPES, priorityView, redistributionView, surplusView, type CoordinationReader } from "./coordination-views.js";

const IDEMPOTENCY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;
const CORRELATION_PATTERN = /^CORR_[0-9A-F]{32}$/;
const COMPONENT_ID_PATTERN = /^COMP_[A-Z0-9_-]{1,56}$/;
const TRANSFER_ID_PATTERN = /^TRF_[A-Z0-9_-]{1,56}$/;
const RESERVATION_ID_PATTERN = /^RES_[A-Z0-9_-]{1,56}$/;
const CASE_ID_PATTERN = /^RECON_[A-Z0-9_-]{1,56}$/;
const INSTITUTION_PATTERN = /^INST_[A-Z0-9_-]{1,59}$/;
const BLOOD_TYPES = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"] as const;
const COMPONENT_TYPES = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS"] as const;
const COMPONENT_TYPES_V21 = [...COMPONENT_TYPES, "CRYOPRECIPITATE"] as const;
const URGENCIES = ["ROUTINE", "URGENT", "CRITICAL"] as const;
const PAGE_CURSOR_PATTERN = /^RES_[A-Z0-9_-]{1,56}$/;
const CENSUS_CURSOR_PATTERN = /^CENSUS_[A-Z0-9_-]{1,56}$/;
const COMMAND_CURSOR_PATTERN = /^CMD_[A-Z0-9_-]{1,56}$/;
const COMMAND_TIME_TOLERANCE_MS = 5 * 60_000;

export interface V2RouteDependencies {
  store: V2CommandStore;
  developmentRead?: DevelopmentReader;
  restore: (request: FastifyRequest) => Promise<{ principal: WebPrincipal }>;
  keyring?: DonationKeyring;
  census?: CensusStore;
  mlInventory?: MlInventoryEvidenceReader;
  projection?: V2ProjectionReader;
  coordination?: CoordinationReader;
  unitHistory?: UnitHistoryReader;
  transferSummaries?: TransferSummaryReader;
  activityHistory?: ActivityHistoryReader;
  bloodBank?: BloodBankReader;
  outboundVerification?: Pick<PostgresOutboundVerification, "verify">;
  receiptVerification?: Pick<PostgresReceiptVerification, "verify" | "findEvidence">;
  webOrigin: string;
  clock: () => Date;
  enabledIssuerInstitutionIds?: readonly string[];
}

// Read-time comparison of the printed label with the ledger status; it never changes inventory.
// The boundary matches EvaluateComponentExpiry: a label is expired once evaluation time reaches it.
function withExpiryState<T extends { expiresAt: string; inventoryStatus: string }>(component: T, nowMs: number): T & { expiryState: string } {
  const expiryState = component.inventoryStatus === "EXPIRED" ? "EXPIRED"
    : Date.parse(component.expiresAt) > nowMs ? "CURRENT"
    : ["AVAILABLE", "RESERVED"].includes(component.inventoryStatus) ? "LABEL_EXPIRED_PENDING_EVALUATION" : "LABEL_EXPIRED_NOT_IN_INVENTORY";
  return { ...component, expiryState };
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
function contractVersion(request: FastifyRequest): "V2" | "V2.1" {
  const value = request.headers["x-bloodledger-contract-version"];
  if (value === undefined) return "V2";
  if (typeof value !== "string" || (value !== "V2" && value !== "V2.1")) throw new ApiFailure(400, "V2_CONTRACT_VERSION_INVALID", "The requested V2 contract version is not supported.");
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
  selectCorePolicy(principal, "V2.1");
}
function pageLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page size is invalid.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page size must be between 1 and 100.");
  return parsed;
}
function requireReservationContract(version: "V2" | "V2.1", reservations: readonly { components: readonly { componentType: string }[] }[]): void {
  if (version === "V2" && reservations.some((reservation) => reservation.components.some((component) => component.componentType === "CRYOPRECIPITATE"))) throw new ApiFailure(409, "V2_1_CONTRACT_REQUIRED", "This reservation requires the V2.1 component contract.");
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
  // Check before intake can create its provisional capture row. Authentication,
  // action-bound grants and institution authorization still run in each route.
  app.addHook("preHandler", async request => {
    const path = request.url.split("?")[0];
    if (["POST","PUT","PATCH","DELETE"].includes(request.method) && path.startsWith("/api/v2/") && !path.startsWith("/api/v2/auth/")) (request as FastifyRequest & { v2PopulationApproved?: boolean }).v2PopulationApproved = await dependencies.store.assertPopulationRequest?.(path, request.body, request.headers["idempotency-key"]) === true;
  });
  const restore = dependencies.restore;
  if (dependencies.developmentRead) registerDevelopmentReads(app, dependencies.developmentRead, restore, dependencies.webOrigin);
  const sameOrigin = (request: FastifyRequest) => { if (request.headers.origin !== dependencies.webOrigin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted."); };
  // Client command times drive ledger expiry eligibility and RPS wait, so a new command must be near the server clock.
  // Retries of an accepted idempotency key and exact approved population operations keep their recorded times.
  const assertCommandTimes = async (request: FastifyRequest, principal: WebPrincipal, times: readonly unknown[]) => {
    if ((request as FastifyRequest & { v2PopulationApproved?: boolean }).v2PopulationApproved) return;
    if (await dependencies.store.get(generatedId("CMD_", requiredHeader(request)), principal.institutionId, principal.userId)) return;
    const now = dependencies.clock().getTime();
    if (times.some(value => typeof value === "string" && Math.abs(Date.parse(value) - now) > COMMAND_TIME_TOLERANCE_MS)) throw new ApiFailure(400, "V2_COMMAND_TIME_OUT_OF_WINDOW", "The command time must be within five minutes of the server clock.");
  };
  const enqueue = async (request: FastifyRequest, reply: FastifyReply, resourceType: V2ResourceType, resourceId: string, operation: string, payload: Record<string, unknown>, principal: WebPrincipal, payloadSha256?: string) => {
    const idempotencyKey = requiredHeader(request);
    const selectedPolicy = selectCorePolicy(principal, contractVersion(request));
    // Preserve legacy command hashes; only retained development actors need the new authorization version.
    if (["PERSISTENT_DEVELOPMENT_CORE_V1","SYNTHETIC_INSTITUTION_CORE_V1"].includes(selectedPolicy)) payload = { ...payload, policyVersion: selectedPolicy };
    const correlationId = requiredBodyString(payload, "correlationId", CORRELATION_PATTERN);
    await assertCommandTimes(request, principal, [payload.eventTime, payload.requestTime]);
    const acceptedAt = dependencies.clock().toISOString();
    const result = await dependencies.store.enqueue({ commandId: generatedId("CMD_", idempotencyKey), idempotencyKey, resourceType, resourceId, operation, payload, payloadSha256, correlationId, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, acceptedAt, operatorVersion:principal.operatorVersion, verificationSessionId:principal.verificationSessionId });
    (request as FastifyRequest & { v2Replayed?: boolean }).v2Replayed = result.replayed;
    return reply.status(202).send(safeCommand(result.command, request));
  };

  app.get<{ Params: { commandId: string } }>("/api/v2/commands/:commandId", async (request) => {
    const { principal } = await restore(request);
    const command = await dependencies.store.get(request.params.commandId, principal.institutionId, principal.userId);
    if (!command) throw new ApiFailure(404, "V2_COMMAND_NOT_FOUND", "The command was not found in the authorized scope.");
    return safeCommand(command, request);
  });

  app.get<{ Querystring: { limit?: string; cursor?: string; idempotencyKey?: string } }>("/api/v2/commands", async (request) => {
    const { principal } = await restore(request);
    const { cursor, idempotencyKey } = request.query;
    if (cursor !== undefined && !COMMAND_CURSOR_PATTERN.test(cursor)) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
    if (idempotencyKey !== undefined && !IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency key lookup is invalid.");
    const page = await dependencies.store.list(principal.institutionId, principal.userId, pageLimit(request.query.limit), cursor, idempotencyKey);
    return { scope: "ACTOR_INSTITUTION", commands: page.commands.map((command) => safeCommand(command, request)), nextCursor: page.nextCursor, classification: "SIMULATION_ONLY" as const };
  });

  // A failed sealed-label read degrades to TEMPORARILY_UNAVAILABLE rather than failing the inventory read.
  const labelIdentities = async (request: FastifyRequest, componentIds: readonly string[], institutionId: string): Promise<(componentId: string) => LabelIdentity> => {
    let sealed: Map<string, SealedDonationNumber> | null = null;
    try { sealed = dependencies.projection?.listSealedDonationNumbers ? await dependencies.projection.listSealedDonationNumbers(componentIds, institutionId) : null; } catch { request.log.warn({ safeErrorCode: "LABEL_IDENTITY_READ_FAILED" }, "Label identity read failed."); sealed = null; }
    return (componentId) => sealed ? resolveLabelIdentity(sealed.get(componentId), dependencies.keyring) : resolveLabelIdentity(undefined, undefined, true);
  };
  app.get("/api/v2/components", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The component projection is not available.");
    if (!["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not component records.");
    const version = contractVersion(request);
    const components = await dependencies.projection.listComponents(principal.institutionId, principal.roleId);
    const now = dependencies.clock().getTime();
    const visible = version === "V2" ? components.filter((component) => component.componentType !== "CRYOPRECIPITATE") : components;
    const labelFor = await labelIdentities(request, visible.map((component) => component.componentId), principal.institutionId);
    return { scope: "INSTITUTION", components: visible.map((component) => ({ ...withExpiryState(component, now), labelIdentity: labelFor(component.componentId) })), classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/v2/unit-history", async (request) => {
    const { principal } = await restore(request);
    if (!["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not unit history.");
    if (!dependencies.unitHistory) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Unit history is not available.");
    const limit = pageLimit(request.query.limit);
    const cursor = decodeHistoryCursor(request.query.cursor);
    return assembleUnitHistory(principal.institutionId, await dependencies.unitHistory.readUnitHistory(principal.institutionId, limit, cursor), dependencies.keyring);
  });

  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/v2/transfer-summaries", async (request) => {
    const { principal } = await restore(request);
    if (!["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not transfer records.");
    if (!dependencies.transferSummaries) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Transfer summaries are not available.");
    const limit = pageLimit(request.query.limit);
    const cursor = decodeSummaryCursor(request.query.cursor);
    const page = await dependencies.transferSummaries.readTransferSummaries(principal.institutionId, principal.roleId, limit, cursor);
    return assembleTransferSummaries(page.records, page.hasMore);
  });

  // ADR-046 blood-bank completion reads.
  app.get("/api/v2/dashboard/summary", async (request) => {
    const { principal } = await restore(request); bloodBankRoutes(principal).summary();
    if (!dependencies.bloodBank) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The blood-bank summary is not available.");
    const now = dependencies.clock();
    return assembleSummary(await dependencies.bloodBank.summary(principal.institutionId, now), now);
  });
  app.get("/api/v2/network-availability", async (request) => {
    const { principal } = await restore(request); bloodBankRoutes(principal).network();
    if (!dependencies.bloodBank) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Network availability is not available.");
    const now = dependencies.clock();
    return assembleNetworkAvailability(await dependencies.bloodBank.networkAvailability(now), now);
  });
  app.get<{ Querystring: { from?: string; to?: string } }>("/api/v2/analytics/request-history", async (request) => {
    const { principal } = await restore(request); bloodBankRoutes(principal).history();
    if (!dependencies.bloodBank) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Request history is not available.");
    const range = parseHistoryRange(request.query.from, request.query.to);
    return assembleRequestHistory(principal.institutionId, range, await dependencies.bloodBank.requestHistory(principal.institutionId, range.from, range.to), dependencies.clock());
  });
  // ADR-047: outbound scan → server-issued preparation evidence; off-chain, synchronous, idempotent.
  app.post<{ Params: { reservationId: string } }>("/api/v2/reservations/:reservationId/outbound-verifications", async (request) => {
    sameOrigin(request); const { principal } = await restore(request);
    if (!dependencies.outboundVerification) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Outbound verification is not available.");
    return dependencies.outboundVerification.verify(principal, request.params.reservationId, request.body, String(request.headers["idempotency-key"] ?? ""), dependencies.clock());
  });
  // ADR-049: destination scan of every in-transit unit → server-issued receipt evidence; off-chain, synchronous, idempotent.
  app.post<{ Params: { reservationId: string } }>("/api/v2/reservations/:reservationId/receipt-verifications", async (request) => {
    sameOrigin(request); const { principal } = await restore(request);
    if (!dependencies.receiptVerification) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Receipt verification is not available.");
    return dependencies.receiptVerification.verify(principal, request.params.reservationId, request.body, String(request.headers["idempotency-key"] ?? ""), dependencies.clock());
  });

  app.get<{ Querystring: { limit?: string; cursor?: string; contract?: string } }>("/api/v2/activity-history", async (request) => {
    const { principal } = await restore(request);
    if (principal.roleId !== "ROLE-02") throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Activity history requires the assigned audit-reader role.");
    if (!dependencies.activityHistory) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Activity history is not available.");
    const contract = activityContract(request.query.contract);
    const limit = pageLimit(request.query.limit);
    const cursor = decodeActivityCursor(request.query.cursor, contract);
    const page = await dependencies.activityHistory.readActivityHistory(principal.institutionId, limit, cursor, contract === "ACTIVITY_HISTORY_READ_V2");
    return assembleActivityHistory(page.records, page.hasMore, contract);
  });

  app.get<{ Params: { componentId: string } }>("/api/v2/components/:componentId", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The component projection is not available.");
    if (!COMPONENT_ID_PATTERN.test(request.params.componentId)) throw new ApiFailure(400, "V2_COMPONENT_ID_INVALID", "Component ID is invalid.");
    if (!["ROLE-01","ROLE-02","ROLE-03"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not component records.");
    const version = contractVersion(request);
    const component = await dependencies.projection.getComponent(request.params.componentId, principal.institutionId, principal.roleId);
    if (!component) throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    if (version === "V2" && component.componentType === "CRYOPRECIPITATE") throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    const labelFor = await labelIdentities(request, [component.componentId], principal.institutionId);
    return { ...withExpiryState(component, dependencies.clock().getTime()), labelIdentity: labelFor(component.componentId) };
  });

  app.post<{ Params: { componentId: string } }>("/api/v2/components/:componentId/expiry", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const componentId = request.params.componentId;
    if (!COMPONENT_ID_PATTERN.test(componentId)) throw new ApiFailure(400, "V2_COMPONENT_ID_INVALID", "Component ID is invalid.");
    const body = request.body;
    if (!hasKeys(body, ["correlationId", "expectedVersion"]) || !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Expiry evaluation input is invalid.");
    const correlationId = requiredBodyString(body, "correlationId", CORRELATION_PATTERN);
    const version = contractVersion(request);
    const idempotencyKey = requiredHeader(request);
    // The server sets the evaluation time, so a retry replays the stored payload instead of rebuilding it.
    const requestDigest = createHash("sha256").update(JSON.stringify({ componentId, body }), "utf8").digest("hex");
    const previous = await dependencies.store.get(generatedId("CMD_", idempotencyKey), principal.institutionId, principal.userId);
    if (previous) {
      if (previous.operation !== "EVALUATE_COMPONENT_EXPIRY" || previous.resourceId !== componentId || previous.payloadSha256 !== requestDigest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return enqueue(request, reply, "COMPONENT", componentId, "EVALUATE_COMPONENT_EXPIRY", previous.payload, principal, requestDigest);
    }
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Expiry evaluation requires the current inventory projection.");
    const component = await dependencies.projection.getComponent(componentId, principal.institutionId, principal.roleId);
    if (!component || component.institutionId !== principal.institutionId) throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    if (version === "V2" && component.componentType === "CRYOPRECIPITATE") throw new ApiFailure(409, "V2_1_CONTRACT_REQUIRED", "CRYO requires V2.1.");
    if (component.inventoryStatus === "EXPIRED") throw new ApiFailure(409, "COMPONENT_ALREADY_EXPIRED", "The component is already ledger-expired.");
    // Ledger expiry clears only the component side of a reservation, so reserved stock is released first.
    if (component.inventoryStatus === "RESERVED") throw new ApiFailure(409, "COMPONENT_EXPIRY_RESERVATION_ACTIVE", "Cancel the reservation before evaluating expiry.");
    if (component.inventoryStatus !== "AVAILABLE") throw new ApiFailure(409, "COMPONENT_EXPIRY_TRANSITION_INVALID", "Only available inventory can be evaluated for expiry.");
    if (component.inventoryVersion !== Number(body.expectedVersion)) throw new ApiFailure(409, "COMPONENT_VERSION_CONFLICT", "The component changed; refresh before evaluating expiry.");
    const evaluationTime = dependencies.clock().toISOString();
    if (Date.parse(component.expiresAt) > Date.parse(evaluationTime)) throw new ApiFailure(409, "COMPONENT_LABEL_NOT_EXPIRED", "The printed label expiry has not been reached.");
    const payload = { componentId, expectedVersion: Number(body.expectedVersion), evaluationTime, eventTime: evaluationTime, actorUserId: principal.userId, correlationId, policyVersion: selectCorePolicy(principal, version) };
    return enqueue(request, reply, "COMPONENT", componentId, "EVALUATE_COMPONENT_EXPIRY", payload, principal, requestDigest);
  });

  app.get("/api/v2/reservations/compromise-reasons", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-03"]);
    return { policyVersion: COMPROMISE_POLICY_VERSION, reasons: COMPROMISE_REASONS, effect: "QUARANTINE_PENDING_MANUAL_REVIEW", freeTextAllowed: false, classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/v2/reservations", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-03"]);
    if (!dependencies.projection?.listReservations) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The reservation projection is not available.");
    const cursor = request.query.cursor;
    if (cursor !== undefined && !PAGE_CURSOR_PATTERN.test(cursor)) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
    const version = contractVersion(request);
    const page = await dependencies.projection.listReservations(principal.institutionId, principal.roleId, pageLimit(request.query.limit), cursor);
    requireReservationContract(version, page.reservations);
    return { scope: principal.roleId === "ROLE-03" ? "DESTINATION_INSTITUTION" : "SOURCE_INSTITUTION", ...page, classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Params: { reservationId: string } }>("/api/v2/reservations/:reservationId", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-03"]);
    if (!RESERVATION_ID_PATTERN.test(request.params.reservationId)) throw new ApiFailure(400, "V2_RESERVATION_ID_INVALID", "Reservation ID is invalid.");
    if (!dependencies.projection?.getReservation) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The reservation projection is not available.");
    const reservation = await dependencies.projection.getReservation(request.params.reservationId, principal.institutionId, principal.roleId);
    if (!reservation) throw new ApiFailure(404, "V2_RESERVATION_NOT_FOUND", "The reservation was not found in the authorized scope.");
    requireReservationContract(contractVersion(request), [reservation]);
    return reservation;
  });

  app.post("/api/v2/reservations", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request);
    const body = request.body;
    if (!hasKeys(body, ["correlationId", "eventTime", "expectedComponentVersions", "reservationId", "selectedComponentIds", "transferId"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reservation input is invalid.");
    authorized(principal, ["ROLE-02"]);
    const transferId = requiredBodyString(body, "transferId", TRANSFER_ID_PATTERN);
    const reservationId = requiredBodyString(body, "reservationId", RESERVATION_ID_PATTERN);
    const transfer = await dependencies.projection?.getTransferRequest?.(transferId, principal.institutionId);
    if (!transfer) throw new ApiFailure(404, "V2_TRANSFER_NOT_FOUND", "Transfer request not found in source scope.");
    if (transfer.status !== "PENDING") throw new ApiFailure(409, "V2_TRANSFER_STATE_CONFLICT", "Transfer request is not pending.");
    const version = contractVersion(request);
    if (transfer.component_type === "CRYOPRECIPITATE" && version !== "V2.1") throw new ApiFailure(409, "V2_1_CONTRACT_REQUIRED", "CRYO requires V2.1.");
    const selected = body.selectedComponentIds; const versions = body.expectedComponentVersions;
    if (!Array.isArray(selected) || !Array.isArray(versions) || selected.length !== Number(transfer.quantity) || versions.length !== selected.length || new Set(selected).size !== selected.length || selected.some(id => typeof id !== "string" || !COMPONENT_ID_PATTERN.test(id)) || versions.some(value => !Number.isSafeInteger(value) || value < 1)) throw new ApiFailure(400, "V2_INPUT_INVALID", "Selected components and versions are invalid.");
    const payload = { reservationId, transferId, purpose: "TRANSFER", sourceInstitutionId: principal.institutionId, destinationInstitutionId: transfer.destination_institution_id, bloodType: transfer.blood_type, componentType: transfer.component_type, quantity: Number(transfer.quantity), selectedComponentIds: selected, expectedComponentVersions: versions, actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: selectCorePolicy(principal, version) };
    return enqueue(request, reply, "TRANSFER", transferId, "RESERVE_COMPONENTS", payload, principal);
  });

  app.post("/api/v2/components", async (request, reply) => {
    sameOrigin(request); await restore(request);
    throw new ApiFailure(410, "V2_OCR_REQUIRED", "Inbound components must be registered through confirmed OCR capture.");
  });

  app.post("/api/v2/inbound-captures", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    if (!dependencies.keyring) throw new ApiFailure(503, "V2_KEYS_UNAVAILABLE", "Donation encryption keys are not available.");
    const idempotencyKey = requiredHeader(request);
    const version = contractVersion(request);
    const capture = validateInboundOcrInput(request.body, dependencies.enabledIssuerInstitutionIds ?? ["INST_MEDIATRIX"], version);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Inbound identity reconciliation is not available.");
    const encrypted = encryptDonationNumber(capture.donationNumber, dependencies.keyring);
    const captureId = generatedId("INCAP_", idempotencyKey);
    const componentId = generatedId("COMP_", idempotencyKey);
    const donationId = `DON_${hash(`${capture.issuerInstitutionId}:${encrypted.lookupHmac}`).slice(0, 40)}`;
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
    const registrationSha256 = digest({ capture, captureId, componentId, donationId, custodyInstitutionId: principal.institutionId });
    const receiptRequestSha256 = digest({ operation: "RECEIVE_INBOUND_COMPONENT", capture, captureId, custodyInstitutionId: principal.institutionId });
    // A retry returns the command its key created, before identity resolution can report the unit's later state.
    const previous = await dependencies.store.get(generatedId("CMD_", idempotencyKey), principal.institutionId, principal.userId);
    if (previous) {
      const sameCapture = previous.operation === "REGISTER_INBOUND_COMPONENT" ? previous.payloadSha256 === registrationSha256
        : previous.operation === "RECEIVE_INBOUND_COMPONENT" && (typeof previous.payload.captureRequestSha256 === "string" ? previous.payload.captureRequestSha256 === receiptRequestSha256
          // Receipts accepted before captureRequestSha256 existed can only be compared on the fields they recorded.
          : previous.payload.captureEvidenceDigest === encrypted.lookupHmac && previous.payload.eventTime === capture.eventTime && previous.payload.correlationId === capture.correlationId);
      if (!sameCapture) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return enqueue(request, reply, "INBOUND_CAPTURE", captureId, previous.operation, previous.payload, principal, previous.payloadSha256);
    }
    // J5: only new captures are held to OCR_LABEL evidence; the replay above keeps earlier captures retryable.
    requireOcrLabelEvidence(capture);
    const existing = await dependencies.projection.findComponentByIdentity(capture.issuerInstitutionId, encrypted.lookupHmac, capture.componentType);
    if (existing) {
      if (existing.institutionId !== principal.institutionId) {
        const receiptReservation=existing.reservationId&&dependencies.projection.getReservation ? await dependencies.projection.getReservation(existing.reservationId,principal.institutionId,principal.roleId) : null;
        if(existing.inventoryStatus!=="IN_TRANSIT"||receiptReservation?.destinationInstitutionId!==principal.institutionId)throw new ApiFailure(409,"INBOUND_COMPONENT_CONFLICT","The component is outside authorized receipt custody.");
      }
      // ADR-049 (F2): one scanned label no longer receives a whole reservation. Receipts accepted here before then
      // still replay through the key lookup above; new receipts verify every unit, then use `receive`.
      if (existing.inventoryStatus === "IN_TRANSIT") throw new ApiFailure(409, "INBOUND_RECEIPT_REQUIRED", "The matching in-transit component requires its transfer receipt workflow: verify every unit, then receive the reservation.");
      return reply.status(200).send({ captureId, resolution: "ALREADY_REGISTERED", componentId: existing.componentId, status: existing.inventoryStatus, classification: "SIMULATION_ONLY" as const });
    }
    const captureEvidenceDigest = createHash("sha256").update(JSON.stringify({ captureId, donationDigest: encrypted.lookupHmac, ocrEvidence: capture.ocrEvidence, capturedAt: capture.capturedAt, confirmedAt: capture.confirmedAt }), "utf8").digest("hex");
    const payload = { captureMethod: "OCR", captureEvidenceDigest, captureId, componentId, donationId, issuerInstitutionId: capture.issuerInstitutionId, donationNoCiphertext: encrypted.ciphertext, donationNoNonce: encrypted.nonce, donationNoAuthTag: encrypted.authTag, donationNoEncryptionKeyVersion: encrypted.encryptionKeyVersion, donationNoLookupHmac: encrypted.lookupHmac, componentType: capture.componentType, bloodType: capture.bloodType, collectedAt: capture.collectedAt, expiresAt: capture.expiresAt, custodyInstitutionId: principal.institutionId, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, eventTime: capture.eventTime, correlationId: capture.correlationId, capturedAt: capture.capturedAt, confirmedAt: capture.confirmedAt, bloodTypeEvidenceSource: capture.bloodTypeEvidence.source, componentEvidenceSource: capture.componentEvidence.source, ocrEngine: capture.ocrEvidence.engine, ocrEngineVersion: capture.ocrEvidence.engineVersion, donationNumberConfidence: capture.ocrEvidence.fieldConfidence.donationNumber, bloodTypeConfidence: capture.ocrEvidence.fieldConfidence.bloodType, policyVersion: selectCorePolicy(principal, version) };
    await assertCommandTimes(request, principal, [capture.eventTime]);
    await dependencies.projection.recordInboundCapture?.(captureId, payload, dependencies.clock().toISOString());
    return enqueue(request, reply, "INBOUND_CAPTURE", captureId, "REGISTER_INBOUND_COMPONENT", payload, principal, registrationSha256);
  });

  app.get("/api/v2/reports/inbound-intake", async (request) => {
    const { principal } = await restore(request);
    const projection = dependencies.projection;
    if (!projection?.listInboundIntake) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Inbound intake reporting is not available.");
    const scope = principal.roleId === "ROLE-04" ? undefined : principal.institutionId;
    if (principal.roleId !== "ROLE-04" && !["ROLE-01", "ROLE-02"].includes(principal.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Inbound intake reporting is not permitted for this role.");
    return { scope: scope ?? "PERMITTED_INSTITUTIONS", statuses: await projection.listInboundIntake(scope), includedInventoryStatuses: ["AVAILABLE", "RESERVED"], excludedFromInventory: ["QUEUED", "FAILED", "CONFLICT"], classification: "SIMULATION_ONLY" as const };
  });

  app.post("/api/v2/transfers", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, principal.accountId ? ["ROLE-02","ROLE-03"] : ["ROLE-03"]);
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "quantity", "requestTime", "sourceInstitutionId", "transferId", "urgency"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    if ((principal.accountId ? !BANK_INSTITUTION_IDS.includes(String(body.sourceInstitutionId)) || body.sourceInstitutionId === principal.institutionId : body.sourceInstitutionId !== "INST_MEDIATRIX") || body.destinationInstitutionId !== principal.institutionId) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Transfer requests must target the authenticated recipient institution.");
    const version = contractVersion(request);
    const transferId = requiredBodyString(body, "transferId", TRANSFER_ID_PATTERN); const bloodType = requiredBodyString(body, "bloodType"); const componentType = requiredBodyString(body, "componentType"); const urgency = requiredBodyString(body, "urgency");
    const supportedComponents = version === "V2.1" ? COMPONENT_TYPES_V21 : COMPONENT_TYPES;
    if (!(BLOOD_TYPES as readonly string[]).includes(bloodType) || !(supportedComponents as readonly string[]).includes(componentType) || !(URGENCIES as readonly string[]).includes(urgency) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    const payload = { transferId, sourceInstitutionId: String(body.sourceInstitutionId), destinationInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), urgency, requestTime: requiredUtc(body, "requestTime"), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: selectCorePolicy(principal, version) };
    return enqueue(request, reply, "TRANSFER", transferId, "SUBMIT_TRANSFER", payload, principal);
  });

  app.post<{ Params: { transferId: string; action: string } }>("/api/v2/transfers/:transferId/:action", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request);
    if (!TRANSFER_ID_PATTERN.test(request.params.transferId)) throw new ApiFailure(400, "V2_TRANSFER_ID_INVALID", "Transfer ID is invalid.");
    const action = request.params.action.toLowerCase();
    if (["approve", "prepare", "dispatch", "transit", "receipt", "delay", "compromise", "cancel", "reject"].includes(action)) throw new ApiFailure(410, "V2_CANONICAL_WORKFLOW_REQUIRED", "Use the canonical V2 reservation workflow; legacy transfer action aliases are not queued.");
    throw new ApiFailure(404, "V2_ACTION_NOT_FOUND", "Transfer action is not supported.");
  });

  app.post("/api/v2/local-releases", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "componentType", "correlationId", "eventTime", "quantity", "releaseId"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Local-release input is invalid.");
    const version = contractVersion(request);
    const releaseId = requiredBodyString(body, "releaseId", /^REL_[A-Z0-9_-]{1,56}$/); const bloodType = requiredBodyString(body, "bloodType"); const componentType = requiredBodyString(body, "componentType");
    const supportedComponents = version === "V2.1" ? COMPONENT_TYPES_V21 : COMPONENT_TYPES;
    if (!(BLOOD_TYPES as readonly string[]).includes(bloodType) || !(supportedComponents as readonly string[]).includes(componentType) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Local-release input is invalid.");
    const eventTime = requiredUtc(body, "eventTime");
    const correlationId = requiredBodyString(body, "correlationId", CORRELATION_PATTERN);
    const idempotencyKey = requiredHeader(request);
    const requestDigest = createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex");
    const previous = await dependencies.store.get(generatedId("CMD_", idempotencyKey), principal.institutionId, principal.userId);
    if (previous) {
      if (previous.operation !== "RESERVE_LOCAL_RELEASE" || previous.resourceId !== releaseId || previous.payloadSha256 !== requestDigest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return enqueue(request, reply, "LOCAL_RELEASE", releaseId, "RESERVE_LOCAL_RELEASE", previous.payload, principal, requestDigest);
    }
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Local release requires the current inventory projection.");
    const eligible = (await dependencies.projection.listComponents(principal.institutionId, principal.roleId))
      .filter(component => component.institutionId === principal.institutionId && component.inventoryStatus === "AVAILABLE" && component.bloodType === bloodType && component.componentType === componentType && Date.parse(component.expiresAt) > Date.parse(eventTime))
      .sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || a.componentId.localeCompare(b.componentId));
    if (eligible.length < Number(body.quantity)) throw new ApiFailure(409, "RESERVATION_INSUFFICIENT_STOCK", "Eligible stock is insufficient for this release.");
    const selected = eligible.slice(0, Number(body.quantity));
    const payload = { reservationId: generatedId("RES_", idempotencyKey), localReleaseId: releaseId, purpose: "LOCAL_RELEASE", destinationInstitutionId: null, sourceInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), selectedComponentIds: selected.map(component => component.componentId), expectedComponentVersions: selected.map(component => component.inventoryVersion), actorUserId: principal.userId, eventTime, correlationId, policyVersion: selectCorePolicy(principal, version) };
    return enqueue(request, reply, "LOCAL_RELEASE", releaseId, "RESERVE_LOCAL_RELEASE", payload, principal, requestDigest);
  });

  app.post("/api/v2/reconciliation", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const body = request.body;
    if (!hasKeys(body, ["caseId", "componentId", "correlationId", "reasonCode"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reconciliation input is invalid.");
    const version = contractVersion(request);
    const componentId = requiredBodyString(body, "componentId", COMPONENT_ID_PATTERN); const caseId = requiredBodyString(body, "caseId", CASE_ID_PATTERN); const reasonCode = requiredBodyString(body, "reasonCode");
    if (!isReconciliationReasonCode(reasonCode)) throw new ApiFailure(400, "RECONCILIATION_REASON_INVALID", "The reconciliation reason is not supported by the active synthetic policy.");
    // The server sets the event time, so a retry replays the stored payload instead of rebuilding it.
    const requestDigest = createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex");
    const previous = await dependencies.store.get(generatedId("CMD_", requiredHeader(request)), principal.institutionId, principal.userId);
    if (previous) {
      if (previous.operation !== "PLACE_RECONCILIATION_HOLD" || previous.resourceId !== caseId || previous.payloadSha256 !== requestDigest) throw new ApiFailure(409, "V2_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different command.");
      return enqueue(request, reply, "RECONCILIATION", caseId, "PLACE_RECONCILIATION_HOLD", previous.payload, principal, requestDigest);
    }
    // TP-JOP-D13: PlaceReconciliationHold requires expectedVersion. The frozen body has none, so the
    // server records the projected version it accepted against; the chaincode rejects a stale one.
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Reconciliation requires the current inventory projection.");
    const component = await dependencies.projection.getComponent(componentId, principal.institutionId, principal.roleId);
    if (!component || component.institutionId !== principal.institutionId) throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    if (version === "V2" && component.componentType === "CRYOPRECIPITATE") throw new ApiFailure(409, "V2_1_CONTRACT_REQUIRED", "CRYO requires V2.1.");
    const payload = { componentId, caseId, reasonCode, expectedVersion: component.inventoryVersion, reconciliationPolicyVersion: RECONCILIATION_POLICY_VERSION, actorUserId: principal.userId, eventTime: dependencies.clock().toISOString(), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: selectCorePolicy(principal, version) };
    return enqueue(request, reply, "RECONCILIATION", caseId, "PLACE_RECONCILIATION_HOLD", payload, principal, requestDigest);
  });

  app.get("/api/v2/reconciliation/reasons", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    return { policyVersion: RECONCILIATION_POLICY_VERSION, reasons: RECONCILIATION_REASONS, effect: "RECONCILIATION_HOLD_ONLY", freeTextAllowed: false, classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Querystring: { businessDate?: string } }>("/api/v2/analytics/inventory-evidence", async (request) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-03"]);
    if (Object.keys(request.query).some(key => key !== "businessDate") || !validEvidenceDate(request.query.businessDate)) throw new ApiFailure(400, "INVALID_BUSINESS_DATE", "Only a valid businessDate is accepted.");
    if (!dependencies.mlInventory) throw new ApiFailure(503, "ML_INVENTORY_UNAVAILABLE", "Inventory evidence is unavailable.");
    try { return await readInventoryEvidence(dependencies.mlInventory, principal.institutionId, request.query.businessDate, dependencies.clock()); }
    catch { throw new ApiFailure(503, "ML_INVENTORY_UNAVAILABLE", "Inventory evidence is unavailable."); }
  });

  // TP-JOP-D07: read-only decision support. Results explain; they never approve, reserve or dispatch.
  const coordinationReader = (): CoordinationReader => {
    if (!dependencies.coordination) throw new ApiFailure(503, "COORDINATION_UNAVAILABLE", "Decision-support views are unavailable.");
    return dependencies.coordination;
  };
  const coordinationSeries = (query: Record<string, unknown>, allowed: readonly string[]) => {
    if (Object.keys(query).some((key) => !allowed.includes(key)) ||
        !(COORDINATION_BLOOD_TYPES as readonly unknown[]).includes(query.bloodType) ||
        !(COORDINATION_COMPONENT_TYPES as readonly unknown[]).includes(query.componentType)) throw new ApiFailure(400, "V2_INPUT_INVALID", "A supported bloodType and componentType are required.");
    return { bloodType: query.bloodType as (typeof COORDINATION_BLOOD_TYPES)[number], componentType: query.componentType as (typeof COORDINATION_COMPONENT_TYPES)[number] };
  };
  const coordinationRead = async <T>(read: () => Promise<T>): Promise<T> => {
    try { return await read(); }
    catch (error) { if (error instanceof ApiFailure) throw error; throw new ApiFailure(503, "COORDINATION_UNAVAILABLE", "Decision-support views are unavailable."); }
  };

  app.get<{ Querystring: { businessDate?: string } }>("/api/v2/analytics/source-surplus", async (request) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-03"]);
    if (Object.keys(request.query).some(key => key !== "businessDate") || !validEvidenceDate(request.query.businessDate)) throw new ApiFailure(400, "INVALID_BUSINESS_DATE", "Only a valid businessDate is accepted.");
    const reader = coordinationReader(), businessDate = request.query.businessDate;
    return coordinationRead(() => surplusView(reader, principal.institutionId, businessDate, dependencies.clock()));
  });

  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v2/coordination/priority", async (request) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02"]);
    const series = coordinationSeries(request.query, ["bloodType", "componentType"]), reader = coordinationReader();
    return coordinationRead(() => priorityView(reader, principal.institutionId, series.bloodType, series.componentType, dependencies.clock()));
  });

  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v2/coordination/redistribution", async (request) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02"]);
    const series = coordinationSeries(request.query, ["bloodType", "componentType", "requiredQuantity"]), reader = coordinationReader();
    const requiredQuantity = Number(request.query.requiredQuantity);
    if (!/^[1-9][0-9]{0,2}$/.test(request.query.requiredQuantity ?? "") || !Number.isSafeInteger(requiredQuantity)) throw new ApiFailure(400, "V2_INPUT_INVALID", "requiredQuantity must be a whole number from 1 to 999.");
    return coordinationRead(() => redistributionView(reader, principal.institutionId, series.bloodType, series.componentType, requiredQuantity, dependencies.clock()));
  });

  app.post("/api/v2/reports/doh-census/catch-up", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    if (!dependencies.census) throw new ApiFailure(503, "DISABLED_UNAPPROVED_REPORT_FORMAT", "The report policy has not been approved.");
    if (!hasKeys(request.body, ["scheduledFor"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "A scheduled census time is required.");
    const scheduledFor = requiredUtc(request.body as Record<string, unknown>, "scheduledFor");
    const snapshot = await dependencies.census.capture(principal.institutionId, new Date(scheduledFor), "MANUAL", dependencies.clock());
    return reply.status(201).send(snapshot);
  });

  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/v2/reports/doh-census", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-04"]);
    if (!dependencies.census?.list) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Census discovery is not available.");
    const cursor = request.query.cursor;
    if (cursor !== undefined && !CENSUS_CURSOR_PATTERN.test(cursor)) throw new ApiFailure(400, "V2_PAGE_INVALID", "Page cursor is invalid.");
    const page = await dependencies.census.list(principal.roleId === "ROLE-04" ? undefined : principal.institutionId, pageLimit(request.query.limit), cursor);
    return { scope: principal.roleId === "ROLE-04" ? "REGULATORY_AGGREGATE" : "INSTITUTION", displayPolicyVersion: DOH_CENSUS_DISPLAY_POLICY_VERSION, displayBloodTypeOrder: DOH_CENSUS_DISPLAY_ORDER, totalColumn: "CALCULATED", reportAvailability: page.exportAvailable ? "EXPORT_AVAILABLE" : "EXPORT_DISABLED_PENDING_FORMAT", ...page, classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Params: { snapshotId: string } }>("/api/v2/reports/doh-census/:snapshotId", async (request) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-04"]);
    if (!dependencies.census) throw new ApiFailure(503, "DISABLED_UNAPPROVED_REPORT_FORMAT", "The report policy has not been approved.");
    const snapshot = await dependencies.census.get(request.params.snapshotId, principal.roleId === "ROLE-04" ? undefined : principal.institutionId);
    if (!snapshot) throw new ApiFailure(404, "CENSUS_NOT_FOUND", "The census snapshot was not found in the authorized scope.");
    return snapshot;
  });

  app.get<{ Params: { snapshotId: string; componentType: string } }>("/api/v2/reports/doh-census/:snapshotId/:componentType.tsv", async (request, reply) => {
    const { principal } = await restore(request);
    authorized(principal, ["ROLE-01", "ROLE-02", "ROLE-04"]);
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
    // ADR-049: receive may also reference receipt evidence; both evidence fields travel together.
    const receiptEvidenceKeys = ["correlationId", "eventTime", "expectedVersion", "receiptEvidenceDigest", "receiptEvidenceId"];
    const withReceiptEvidence = action === "receive" && hasKeys(body, receiptEvidenceKeys);
    if (!withReceiptEvidence && !hasKeys(body, allowedActionKeys[action] ?? [])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reservation action input is invalid.");
    if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw new ApiFailure(400, "V2_VERSION_INVALID", "Expected version is invalid.");
    // BL-DEC-S6-2026-09-23-01: enforced here before queuing; the independent chaincode check is deferred until after UAT.
    if (action === "compromise" && !isCompromiseReasonCode(body.reasonCode)) throw new ApiFailure(400, "COMPROMISE_REASON_INVALID", "The incident reason is not supported by the active synthetic policy.");
    const roleMap: Record<string, readonly WebPrincipal["roleId"][]> = { prepare: ["ROLE-01", "ROLE-02"], dispatch: ["ROLE-01", "ROLE-02"], transit: ["ROLE-01", "ROLE-02"], receive: ["ROLE-01", "ROLE-02", "ROLE-03"], cancel: ["ROLE-01", "ROLE-02", "ROLE-03"], "local-release-complete": ["ROLE-01", "ROLE-02"], compromise: ["ROLE-01", "ROLE-02", "ROLE-03"] };
    const roles = roleMap[action]; if (!roles) throw new ApiFailure(404, "V2_ACTION_NOT_FOUND", "Reservation action is not supported."); authorized(principal, roles);
    if (!dependencies.projection?.getReservation) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The reservation projection is not available.");
    const scopedReservation = await dependencies.projection.getReservation(request.params.reservationId, principal.institutionId, principal.roleId);
    if (!scopedReservation) throw new ApiFailure(404, "V2_RESERVATION_NOT_FOUND", "The reservation was not found in the authorized scope.");
    const version = contractVersion(request);
    requireReservationContract(version, [scopedReservation]);
    const operationByAction: Record<string, string> = { prepare: "PREPARE_RESERVATION", dispatch: "DISPATCH_RESERVATION", transit: "START_RESERVATION_TRANSIT", receive: "RECEIVE_RESERVATION", cancel: "CANCEL_RESERVATION", compromise: "COMPROMISE_RESERVATION", "local-release-complete": "COMPLETE_LOCAL_RELEASE" };
    const payload: Record<string, unknown> = { reservationId: request.params.reservationId, expectedVersion: Number(body.expectedVersion), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: selectCorePolicy(principal, version) };
    if (action === "receive") {
      const bank = principal.roleId !== "ROLE-03";
      // Only the destination receives; a source bank sees its reservation but cannot receive it.
      if (bank && scopedReservation.destinationInstitutionId !== principal.institutionId) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Only the destination institution receives a reservation.");
      // A bank receipt always proves every unit. Requester receipt without evidence works as before and records none.
      if (bank && !withReceiptEvidence) throw new ApiFailure(409, "RECEIPT_VERIFICATION_REQUIRED", "Verify every in-transit unit before a blood bank receives the reservation.");
      if (withReceiptEvidence) {
        const evidenceId = requiredBodyString(body, "receiptEvidenceId", RECEIPT_EVIDENCE_ID_PATTERN), evidenceDigest = requiredBodyString(body, "receiptEvidenceDigest", /^[0-9a-f]{64}$/);
        if (!dependencies.receiptVerification) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "Receipt verification is not available.");
        assertReceiptEvidence(await dependencies.receiptVerification.findEvidence(evidenceId), { evidenceDigest, reservationId: request.params.reservationId, expectedVersion: Number(body.expectedVersion), institutionId: principal.institutionId });
        // The evidence binds off-chain in the command payload; the ledger payload drops it (chaincode unchanged).
        if (bank) {
          // RecordInboundReceipt is the chaincode receipt for blood-bank destinations; its capture digest is the receipt evidence digest.
          const { reservationId, expectedVersion, actorUserId, eventTime, correlationId, policyVersion } = payload;
          return enqueue(request, reply, "TRANSFER", request.params.reservationId, "RECEIVE_INBOUND_COMPONENT", { reservationId, expectedVersion, actorUserId, actorInstitutionId: principal.institutionId, eventTime, correlationId, policyVersion, captureEvidenceDigest: evidenceDigest, receiptEvidenceId: evidenceId }, principal);
        }
        payload.receiptEvidenceId = evidenceId; payload.receiptEvidenceDigest = evidenceDigest;
      }
    }
    for (const key of ["preparedEvidenceDigest", "preparedEvidenceId", "preparedAt", "reasonCode"] as const) if (body[key] !== undefined) payload[key] = body[key];
    if (action === "compromise") payload.compromisePolicyVersion = COMPROMISE_POLICY_VERSION;
    return enqueue(request, reply, "TRANSFER", request.params.reservationId, operationByAction[action], payload, principal);
  });
}
