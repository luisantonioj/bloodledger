import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { encryptDonationNumber, type DonationKeyring } from "./donation-crypto.js";
import type { WebPrincipal } from "./session.js";
import type { V2CommandStore, V2ResourceType } from "./v2-command.js";
import type { CensusStore } from "./census-worker.js";
import type { V2ProjectionReader } from "./database-v2.js";
import { validateInboundOcrInput } from "./inbound-ocr-policy.js";
import { isReconciliationReasonCode, RECONCILIATION_POLICY_VERSION, RECONCILIATION_REASONS } from "./reconciliation-policy.js";
import { DOH_CENSUS_DISPLAY_ORDER, DOH_CENSUS_DISPLAY_POLICY_VERSION } from "./report-policy.js";

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

export interface V2RouteDependencies {
  store: V2CommandStore;
  restore: (request: FastifyRequest) => Promise<{ principal: WebPrincipal }>;
  keyring?: DonationKeyring;
  census?: CensusStore;
  projection?: V2ProjectionReader;
  webOrigin: string;
  clock: () => Date;
  enabledIssuerInstitutionIds?: readonly string[];
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
  const restore = dependencies.restore;
  const sameOrigin = (request: FastifyRequest) => { if (request.headers.origin !== dependencies.webOrigin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted."); };
  const enqueue = async (request: FastifyRequest, reply: FastifyReply, resourceType: V2ResourceType, resourceId: string, operation: string, payload: Record<string, unknown>, principal: WebPrincipal, payloadSha256?: string) => {
    const idempotencyKey = requiredHeader(request);
    const correlationId = requiredBodyString(payload, "correlationId", CORRELATION_PATTERN);
    const acceptedAt = dependencies.clock().toISOString();
    const result = await dependencies.store.enqueue({ commandId: generatedId("CMD_", idempotencyKey), idempotencyKey, resourceType, resourceId, operation, payload, payloadSha256, correlationId, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, acceptedAt });
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
    const version = contractVersion(request);
    const components = await dependencies.projection.listComponents(principal.institutionId, principal.roleId);
    return { scope: "INSTITUTION", components: version === "V2" ? components.filter((component) => component.componentType !== "CRYOPRECIPITATE") : components, classification: "SIMULATION_ONLY" as const };
  });

  app.get<{ Params: { componentId: string } }>("/api/v2/components/:componentId", async (request) => {
    const { principal } = await restore(request);
    if (!dependencies.projection) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The component projection is not available.");
    if (!COMPONENT_ID_PATTERN.test(request.params.componentId)) throw new ApiFailure(400, "V2_COMPONENT_ID_INVALID", "Component ID is invalid.");
    if (principal.roleId === "ROLE-04") throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Regulatory readers receive aggregate reports, not component records.");
    const version = contractVersion(request);
    const component = await dependencies.projection.getComponent(request.params.componentId, principal.institutionId, principal.roleId);
    if (!component) throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    if (version === "V2" && component.componentType === "CRYOPRECIPITATE") throw new ApiFailure(404, "V2_COMPONENT_NOT_FOUND", "The component was not found in the authorized scope.");
    return component;
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
    const existing = await dependencies.projection.findComponentByIdentity(capture.issuerInstitutionId, encrypted.lookupHmac, capture.componentType);
    const captureId = generatedId("INCAP_", idempotencyKey);
    if (existing) {
      if (existing.institutionId !== principal.institutionId) throw new ApiFailure(409, "INBOUND_COMPONENT_CONFLICT", "The component is already held by another custody institution.");
      if (existing.inventoryStatus === "IN_TRANSIT" && existing.reservationId && existing.reservationVersion) {
        const payload = { reservationId: existing.reservationId, expectedVersion: existing.reservationVersion, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, eventTime: capture.eventTime, correlationId: capture.correlationId, captureId, captureEvidenceDigest: encrypted.lookupHmac };
        return enqueue(request, reply, "INBOUND_CAPTURE", captureId, "RECEIVE_INBOUND_COMPONENT", payload, principal);
      }
      if (existing.inventoryStatus === "IN_TRANSIT") throw new ApiFailure(409, "INBOUND_RECEIPT_REQUIRED", "The matching in-transit component requires its transfer receipt workflow before intake can continue.");
      return reply.status(200).send({ captureId, resolution: "ALREADY_REGISTERED", componentId: existing.componentId, status: existing.inventoryStatus, classification: "SIMULATION_ONLY" as const });
    }
    const componentId = generatedId("COMP_", idempotencyKey);
    const donationId = `DON_${hash(`${capture.issuerInstitutionId}:${encrypted.lookupHmac}`).slice(0, 40)}`;
    const payload = { captureId, componentId, donationId, issuerInstitutionId: capture.issuerInstitutionId, donationNoCiphertext: encrypted.ciphertext, donationNoNonce: encrypted.nonce, donationNoAuthTag: encrypted.authTag, donationNoEncryptionKeyVersion: encrypted.encryptionKeyVersion, donationNoLookupHmac: encrypted.lookupHmac, componentType: capture.componentType, bloodType: capture.bloodType, collectedAt: capture.collectedAt, expiresAt: capture.expiresAt, custodyInstitutionId: principal.institutionId, actorUserId: principal.userId, actorInstitutionId: principal.institutionId, eventTime: capture.eventTime, correlationId: capture.correlationId, capturedAt: capture.capturedAt, confirmedAt: capture.confirmedAt, bloodTypeEvidenceSource: capture.bloodTypeEvidence.source, componentEvidenceSource: capture.componentEvidence.source, ocrEngine: capture.ocrEvidence.engine, ocrEngineVersion: capture.ocrEvidence.engineVersion, donationNumberConfidence: capture.ocrEvidence.fieldConfidence.donationNumber, bloodTypeConfidence: capture.ocrEvidence.fieldConfidence.bloodType, policyVersion: version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2" };
    await dependencies.projection.recordInboundCapture?.(captureId, payload, dependencies.clock().toISOString());
    const payloadSha256 = createHash("sha256").update(JSON.stringify({ capture, captureId, componentId, donationId, custodyInstitutionId: principal.institutionId }), "utf8").digest("hex");
    return enqueue(request, reply, "INBOUND_CAPTURE", captureId, "REGISTER_INBOUND_COMPONENT", payload, principal, payloadSha256);
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
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-03"]);
    const body = request.body;
    if (!hasKeys(body, ["bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "quantity", "requestTime", "sourceInstitutionId", "transferId", "urgency"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    if (body.sourceInstitutionId !== "INST_MEDIATRIX" || body.destinationInstitutionId !== principal.institutionId) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Transfer requests must target the authenticated recipient institution.");
    const version = contractVersion(request);
    const transferId = requiredBodyString(body, "transferId", TRANSFER_ID_PATTERN); const bloodType = requiredBodyString(body, "bloodType"); const componentType = requiredBodyString(body, "componentType"); const urgency = requiredBodyString(body, "urgency");
    const supportedComponents = version === "V2.1" ? COMPONENT_TYPES_V21 : COMPONENT_TYPES;
    if (!(BLOOD_TYPES as readonly string[]).includes(bloodType) || !(supportedComponents as readonly string[]).includes(componentType) || !(URGENCIES as readonly string[]).includes(urgency) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1) throw new ApiFailure(400, "V2_INPUT_INVALID", "Transfer request input is invalid.");
    const payload = { transferId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), urgency, requestTime: requiredUtc(body, "requestTime"), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2" };
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
    const payload = { releaseId, sourceInstitutionId: principal.institutionId, bloodType, componentType, quantity: Number(body.quantity), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2" };
    return enqueue(request, reply, "LOCAL_RELEASE", releaseId, "RESERVE_LOCAL_RELEASE", payload, principal);
  });

  app.post("/api/v2/reconciliation", async (request, reply) => {
    sameOrigin(request); const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    const body = request.body;
    if (!hasKeys(body, ["caseId", "componentId", "correlationId", "reasonCode"])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reconciliation input is invalid.");
    const version = contractVersion(request);
    const componentId = requiredBodyString(body, "componentId", COMPONENT_ID_PATTERN); const caseId = requiredBodyString(body, "caseId", CASE_ID_PATTERN); const reasonCode = requiredBodyString(body, "reasonCode");
    if (!isReconciliationReasonCode(reasonCode)) throw new ApiFailure(400, "RECONCILIATION_REASON_INVALID", "The reconciliation reason is not supported by the active synthetic policy.");
    const payload = { componentId, caseId, reasonCode, reconciliationPolicyVersion: RECONCILIATION_POLICY_VERSION, actorUserId: principal.userId, eventTime: dependencies.clock().toISOString(), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2" };
    return enqueue(request, reply, "RECONCILIATION", caseId, "PLACE_RECONCILIATION_HOLD", payload, principal);
  });

  app.get("/api/v2/reconciliation/reasons", async (request) => {
    const { principal } = await restore(request); authorized(principal, ["ROLE-01", "ROLE-02"]);
    return { policyVersion: RECONCILIATION_POLICY_VERSION, reasons: RECONCILIATION_REASONS, effect: "RECONCILIATION_HOLD_ONLY", freeTextAllowed: false, classification: "SIMULATION_ONLY" as const };
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
    if (!hasKeys(body, allowedActionKeys[action] ?? [])) throw new ApiFailure(400, "V2_INPUT_INVALID", "Reservation action input is invalid.");
    if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) throw new ApiFailure(400, "V2_VERSION_INVALID", "Expected version is invalid.");
    const roleMap: Record<string, readonly WebPrincipal["roleId"][]> = { prepare: ["ROLE-01", "ROLE-02"], dispatch: ["ROLE-01", "ROLE-02"], transit: ["ROLE-01", "ROLE-02"], receive: ["ROLE-03"], cancel: ["ROLE-01", "ROLE-02", "ROLE-03"], "local-release-complete": ["ROLE-01", "ROLE-02"], compromise: ["ROLE-01", "ROLE-02", "ROLE-03"] };
    const roles = roleMap[action]; if (!roles) throw new ApiFailure(404, "V2_ACTION_NOT_FOUND", "Reservation action is not supported."); authorized(principal, roles);
    if (!dependencies.projection?.getReservation) throw new ApiFailure(503, "V2_PROJECTION_UNAVAILABLE", "The reservation projection is not available.");
    const scopedReservation = await dependencies.projection.getReservation(request.params.reservationId, principal.institutionId, principal.roleId);
    if (!scopedReservation) throw new ApiFailure(404, "V2_RESERVATION_NOT_FOUND", "The reservation was not found in the authorized scope.");
    const version = contractVersion(request);
    requireReservationContract(version, [scopedReservation]);
    const operationByAction: Record<string, string> = { prepare: "PREPARE_RESERVATION", dispatch: "DISPATCH_RESERVATION", transit: "START_RESERVATION_TRANSIT", receive: "RECEIVE_RESERVATION", cancel: "CANCEL_RESERVATION", compromise: "COMPROMISE_RESERVATION", "local-release-complete": "COMPLETE_LOCAL_RELEASE" };
    const payload: Record<string, unknown> = { reservationId: request.params.reservationId, expectedVersion: Number(body.expectedVersion), actorUserId: principal.userId, eventTime: requiredUtc(body, "eventTime"), correlationId: requiredBodyString(body, "correlationId", CORRELATION_PATTERN), policyVersion: version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2" };
    for (const key of ["preparedEvidenceDigest", "preparedEvidenceId", "preparedAt", "reasonCode"] as const) if (body[key] !== undefined) payload[key] = body[key];
    return enqueue(request, reply, "TRANSFER", request.params.reservationId, operationByAction[action], payload, principal);
  });
}
