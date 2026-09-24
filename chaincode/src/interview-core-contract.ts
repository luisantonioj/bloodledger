import { createHash } from "node:crypto";
import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import policyJson from "../policy/interview-core-v2.json";
import policyV21Json from "../policy/interview-core-v2-1.json";

const AUTHORIZED_MSP_ID = "MediatrixMSP";
const AUTHORIZED_ENROLLMENT_ID = "api-gateway";
const AUTHORIZED_IDENTITY_TYPE = "client";
const AUTHORIZED_ROLE = "API_GATEWAY";
const ROLE_ATTRIBUTE = "bloodledger.role";
const INSTITUTION_ATTRIBUTE = "bloodledger.institution_id";
const POLICY_VERSION = "INTERVIEW_DERIVED_CORE_V2";
const POLICY_VERSION_V21 = "INTERVIEW_DERIVED_CORE_V2_1";
const COMPONENT_SCHEMA = "COMPONENT_ASSET_V2";
const RESERVATION_SCHEMA = "RESERVATION_ASSET_V2";
const CASE_SCHEMA = "RECONCILIATION_CASE_V2";
const COMPONENT_ID_PATTERN = /^COMP_[A-Z0-9_-]{1,56}$/;
const DONATION_ID_PATTERN = /^DON_[A-Z0-9_-]{1,56}$/;
const RESERVATION_ID_PATTERN = /^RES_[A-Z0-9_-]{1,56}$/;
const CASE_ID_PATTERN = /^RECON_[A-Z0-9_-]{1,56}$/;
const ACTOR_ID_PATTERN = /^USR_[A-Z0-9_-]{1,48}$/;
const CORRELATION_ID_PATTERN = /^CORR_[A-Z0-9_-]{1,59}$/;
const IDEMPOTENCY_KEY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;
const EVIDENCE_ID_PATTERN = /^EVD_[A-Z0-9_-]{1,56}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

type BloodType =
  | "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE"
  | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE";
type ComponentType =
  | "WHOLE_BLOOD" | "PACKED_RED_BLOOD_CELLS" | "FRESH_FROZEN_PLASMA" | "PLATELETS" | "CRYOPRECIPITATE";
type PolicyVersion = typeof POLICY_VERSION | typeof POLICY_VERSION_V21;
type ComponentStatus =
  | "AVAILABLE" | "RESERVED" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED"
  | "RELEASED" | "EXPIRED" | "RECONCILIATION_HOLD" | "COMPROMISED";
type ReservationPurpose = "TRANSFER" | "LOCAL_RELEASE";
type ReservationStatus = "ACTIVE" | "DISPATCHED" | "IN_TRANSIT" | "RECEIVED" | "COMPLETED" | "CANCELLED" | "COMPROMISED";
type Role = "ROLE_01" | "ROLE_02" | "ROLE_03" | "ROLE_04";

interface ActorPolicy { institutionId: string; role: Role; }
interface ComponentAsset {
  schemaVersion: typeof COMPONENT_SCHEMA;
  componentId: string;
  donationId: string;
  issuerInstitutionId: string;
  donationNoDigest: string;
  componentType: ComponentType;
  bloodType: BloodType;
  collectedAt: string;
  labelExpiry: string;
  custodyInstitutionId: string;
  status: ComponentStatus;
  reservationId?: string;
  reservationPurpose?: ReservationPurpose;
  reconciliationCaseId?: string;
  version: number;
  actorUserId: string;
  policyVersion: PolicyVersion;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
  captureMethod?: "OCR";
  bloodTypeEvidenceSource?: string;
  componentEvidenceSource?: string;
}
interface ReservationAsset {
  schemaVersion: typeof RESERVATION_SCHEMA;
  reservationId: string;
  purpose: ReservationPurpose;
  sourceInstitutionId: string;
  destinationInstitutionId?: string;
  bloodType: BloodType;
  componentType: ComponentType;
  quantity: number;
  selectedComponentIds: string[];
  status: ReservationStatus;
  preparedEvidenceDigest?: string;
  preparedEvidenceId?: string;
  preparedAt?: string;
  compromiseReasonCode?: string;
  compromisePolicyVersion?: string;
  version: number;
  actorUserId: string;
  policyVersion: PolicyVersion;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}
interface ReconciliationCaseAsset {
  schemaVersion: typeof CASE_SCHEMA;
  caseId: string;
  componentId: string;
  institutionId: string;
  previousStatus: "AVAILABLE" | "RESERVED";
  reservationId?: string;
  reasonCode: string;
  status: "OPEN" | "RESOLVED";
  resolutionCode?: string;
  version: number;
  actorUserId: string;
  policyVersion: PolicyVersion;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}
interface IdempotencyRecord { operation: string; requestDigest: string; response: string; }
interface TransferAssetV2 {
  schemaVersion: "TRANSFER_ASSET_V2";
  transferId: string;
  sourceInstitutionId: string;
  destinationInstitutionId: string;
  bloodType: BloodType;
  componentType: ComponentType;
  quantity: number;
  urgency: "ROUTINE" | "URGENT" | "CRITICAL";
  requestTime: string;
  status: "PENDING";
  version: number;
  actorUserId: string;
  policyVersion: PolicyVersion;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}

const policy = policyJson as {
  classification: "SIMULATION_ONLY";
  policyVersion: PolicyVersion;
  allowedIssuerInstitutionIds: string[];
  bloodTypes: BloodType[];
  componentTypes: ComponentType[];
  nearExpiryEnabled: false;
  reconciliationPolicyVersion: "SYNTHETIC_RECONCILIATION_REASONS_V1";
  reconciliationReasonCodes: string[];
  compromisePolicyVersion: "SYNTHETIC_COMPROMISE_REASONS_V1";
  compromiseReasonCodes: string[];
  actors: Record<string, ActorPolicy>;
};
const policyV21 = policyV21Json as typeof policy & { policyVersion: typeof POLICY_VERSION_V21 };

@Info({
  title: "InterviewCoreContract",
  description: "Sprint 6 deterministic simulation-only component custody, FEFO, release, and reconciliation contract",
})
export class InterviewCoreContract extends Contract {
  public constructor() { super("InterviewCoreContract"); }

  @Transaction()
  @Returns("string")
  public async SubmitTransferRequest(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorUserId", "bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "idempotencyKey", "policyVersion", "quantity", "requestTime", "sourceInstitutionId", "transferId", "urgency"]);
    this.assertGateway(ctx); this.assertCommon(input);
    this.assertId(String(input.transferId), /^TRF_[A-Z0-9_-]{1,56}$/, "TRANSFER_INPUT_INVALID");
    this.assertActor(input.actorUserId);
    const actor = this.assertActor(input.actorUserId);
    if (actor.role !== "ROLE_03" || actor.institutionId !== String(input.destinationInstitutionId) || input.sourceInstitutionId !== "INST_MEDIATRIX") this.fail("TRANSFER_NOT_AUTHORIZED");
    if (!this.policyFor(input).bloodTypes.includes(input.bloodType as BloodType) || !this.policyFor(input).componentTypes.includes(input.componentType as ComponentType)) this.fail("TRANSFER_INPUT_INVALID");
    if (!Number.isSafeInteger(input.quantity) || Number(input.quantity) < 1 || !["ROUTINE", "URGENT", "CRITICAL"].includes(String(input.urgency))) this.fail("TRANSFER_INPUT_INVALID");
    this.parseUtc(input.requestTime); this.parseUtc(input.eventTime);
    const requestDigest = this.digest(input); const prior = await this.readIdempotent(ctx, String(input.idempotencyKey), "SUBMIT_TRANSFER", requestDigest); if (prior !== undefined) return prior;
    const key = this.transferKey(String(input.transferId)); if ((await ctx.stub.getState(key)).length > 0) this.fail("TRANSFER_DUPLICATE");
    const transfer: TransferAssetV2 = { schemaVersion: "TRANSFER_ASSET_V2", transferId: String(input.transferId), sourceInstitutionId: String(input.sourceInstitutionId), destinationInstitutionId: String(input.destinationInstitutionId), bloodType: input.bloodType as BloodType, componentType: input.componentType as ComponentType, quantity: Number(input.quantity), urgency: input.urgency as TransferAssetV2["urgency"], requestTime: String(input.requestTime), status: "PENDING", version: 1, actorUserId: String(input.actorUserId), policyVersion: input.policyVersion as PolicyVersion, createdAt: String(input.eventTime), updatedAt: String(input.eventTime), correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID() };
    const response = this.serialize(transfer); await ctx.stub.putState(key, Buffer.from(response, "utf8")); await this.writeIdempotent(ctx, String(input.idempotencyKey), "SUBMIT_TRANSFER", requestDigest, response); this.emit(ctx, "TransferRequested", { transferId: transfer.transferId, status: transfer.status, version: transfer.version, eventTime: transfer.createdAt, correlationId: transfer.correlationId }); return response;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadTransferRequest(ctx: Context, transferId: string): Promise<string> {
    this.assertGateway(ctx); this.assertId(transferId, /^TRF_[A-Z0-9_-]{1,56}$/, "TRANSFER_INPUT_INVALID"); const stored = await ctx.stub.getState(this.transferKey(transferId)); if (stored.length === 0) this.fail("TRANSFER_NOT_FOUND"); return Buffer.from(stored).toString("utf8");
  }

  @Transaction()
  @Returns("string")
  public async RegisterComponent(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, [
      "actorUserId", "bloodType", "collectedAt", "componentId", "componentType",
      "correlationId", "custodyInstitutionId", "donationId", "donationNoDigest",
      "eventTime", "expiresAt", "idempotencyKey", "issuerInstitutionId", "policyVersion",
    ]);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertId(String(input.componentId), COMPONENT_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    this.assertId(String(input.donationId), DONATION_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    this.assertHash(input.donationNoDigest, "COMPONENT_DONATION_REFERENCE_INVALID");
    this.assertActorForInstitution(input.actorUserId, input.issuerInstitutionId, ["ROLE_01", "ROLE_02"]);
    if (!policy.allowedIssuerInstitutionIds.includes(String(input.issuerInstitutionId))) this.fail("COMPONENT_ISSUER_UNAPPROVED");
    if (input.custodyInstitutionId !== input.issuerInstitutionId) this.fail("COMPONENT_INSTITUTION_INVALID");
    if (!policy.bloodTypes.includes(input.bloodType as BloodType)) this.fail("COMPONENT_BLOOD_TYPE_UNSUPPORTED");
    if (!this.policyFor(input).componentTypes.includes(input.componentType as ComponentType)) this.fail("COMPONENT_TYPE_UNSUPPORTED");
    const collectedMs = this.parseUtc(input.collectedAt);
    const expiryMs = this.parseUtc(input.expiresAt);
    const eventMs = this.parseUtc(input.eventTime);
    if (expiryMs <= collectedMs || eventMs < collectedMs) this.fail("COMPONENT_TIME_INVALID");
    const requestDigest = this.digest(input);
    const prior = await this.readIdempotent(ctx, String(input.idempotencyKey), "REGISTER_COMPONENT", requestDigest);
    if (prior !== undefined) return prior;
    const key = this.componentKey(String(input.componentId));
    if ((await ctx.stub.getState(key)).length > 0) this.fail("COMPONENT_DUPLICATE");
    const identityKey = this.identityKey(String(input.issuerInstitutionId), String(input.donationNoDigest), String(input.componentType));
    if ((await ctx.stub.getState(identityKey)).length > 0) this.fail("COMPONENT_DUPLICATE_DONATION_TYPE");
    const donationPrefix = `component:identity:${String(input.issuerInstitutionId)}:${String(input.donationNoDigest)}:`;
    const existingTypes = await this.listIdentityTypes(ctx, donationPrefix);
    if ((input.componentType === "WHOLE_BLOOD" && existingTypes.length > 0) ||
        (input.componentType !== "WHOLE_BLOOD" && existingTypes.includes("WHOLE_BLOOD"))) {
      this.fail("COMPONENT_WHOLE_BLOOD_EXCLUSIVE");
    }
    const asset: ComponentAsset = {
      schemaVersion: COMPONENT_SCHEMA,
      componentId: String(input.componentId), donationId: String(input.donationId),
      issuerInstitutionId: String(input.issuerInstitutionId), donationNoDigest: String(input.donationNoDigest),
      componentType: input.componentType as ComponentType, bloodType: input.bloodType as BloodType,
      collectedAt: String(input.collectedAt), labelExpiry: String(input.expiresAt),
      custodyInstitutionId: String(input.custodyInstitutionId), status: "AVAILABLE",
      version: 1, actorUserId: String(input.actorUserId), policyVersion: input.policyVersion as PolicyVersion,
      createdAt: String(input.eventTime), updatedAt: String(input.eventTime),
      correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID(),
    };
    const response = this.serialize(asset);
    await ctx.stub.putState(key, Buffer.from(response, "utf8"));
    await ctx.stub.putState(identityKey, Buffer.from(asset.componentId, "utf8"));
    await this.writeIdempotent(ctx, String(input.idempotencyKey), "REGISTER_COMPONENT", requestDigest, response);
    this.emit(ctx, "ComponentRegistered", { componentId: asset.componentId, status: asset.status, version: asset.version, eventTime: asset.createdAt, correlationId: asset.correlationId });
    return response;
  }

  /** OCR-only inbound registration. Issuer and receiving custody are intentionally independent. */
  @Transaction()
  @Returns("string")
  public async RegisterInboundComponent(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, [
      "actorInstitutionId", "actorUserId", "bloodType", "bloodTypeEvidenceSource", "captureEvidenceDigest", "captureMethod", "componentEvidenceSource", "componentId", "componentType", "correlationId", "custodyInstitutionId", "donationId", "donationNoDigest", "eventTime", "expiresAt", "idempotencyKey", "issuerInstitutionId", "policyVersion", "collectedAt",
    ]);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertId(String(input.componentId), COMPONENT_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    this.assertId(String(input.donationId), DONATION_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    this.assertHash(input.donationNoDigest, "COMPONENT_DONATION_REFERENCE_INVALID");
    this.assertHash(input.captureEvidenceDigest, "COMPONENT_CAPTURE_EVIDENCE_INVALID");
    this.assertActorForInstitution(input.actorUserId, input.custodyInstitutionId, ["ROLE_01", "ROLE_02"]);
    if (input.actorInstitutionId !== input.custodyInstitutionId || input.captureMethod !== "OCR") this.fail("INBOUND_CAPTURE_INVALID");
    if (!policy.allowedIssuerInstitutionIds.includes(String(input.issuerInstitutionId))) this.fail("COMPONENT_ISSUER_UNAPPROVED");
    if (!policy.bloodTypes.includes(input.bloodType as BloodType)) this.fail("COMPONENT_BLOOD_TYPE_UNSUPPORTED");
    if (!this.policyFor(input).componentTypes.includes(input.componentType as ComponentType)) this.fail("COMPONENT_TYPE_UNSUPPORTED");
    if (!["OCR_LABEL", "OPERATOR_CONFIRMED"].includes(String(input.bloodTypeEvidenceSource)) || !["OCR_LABEL", "BAG_TYPE", "OPERATOR_CONFIRMED"].includes(String(input.componentEvidenceSource))) this.fail("INBOUND_CAPTURE_EVIDENCE_INVALID");
    const collectedMs = this.parseUtc(input.collectedAt); const expiryMs = this.parseUtc(input.expiresAt); this.parseUtc(input.eventTime);
    if (expiryMs <= collectedMs) this.fail("COMPONENT_TIME_INVALID");
    const requestDigest = this.digest(input); const prior = await this.readIdempotent(ctx, String(input.idempotencyKey), "REGISTER_INBOUND_COMPONENT", requestDigest); if (prior !== undefined) return prior;
    if ((await ctx.stub.getState(this.componentKey(String(input.componentId)))).length > 0) this.fail("COMPONENT_DUPLICATE");
    const identityKey = this.identityKey(String(input.issuerInstitutionId), String(input.donationNoDigest), String(input.componentType));
    if ((await ctx.stub.getState(identityKey)).length > 0) this.fail("COMPONENT_DUPLICATE_DONATION_TYPE");
    const donationPrefix = `component:identity:${String(input.issuerInstitutionId)}:${String(input.donationNoDigest)}:`;
    const existingTypes = await this.listIdentityTypes(ctx, donationPrefix);
    if ((input.componentType === "WHOLE_BLOOD" && existingTypes.length > 0) || (input.componentType !== "WHOLE_BLOOD" && existingTypes.includes("WHOLE_BLOOD"))) this.fail("COMPONENT_WHOLE_BLOOD_EXCLUSIVE");
    const asset: ComponentAsset = { schemaVersion: COMPONENT_SCHEMA, componentId: String(input.componentId), donationId: String(input.donationId), issuerInstitutionId: String(input.issuerInstitutionId), donationNoDigest: String(input.donationNoDigest), componentType: input.componentType as ComponentType, bloodType: input.bloodType as BloodType, collectedAt: String(input.collectedAt), labelExpiry: String(input.expiresAt), custodyInstitutionId: String(input.custodyInstitutionId), status: "AVAILABLE", version: 1, actorUserId: String(input.actorUserId), policyVersion: input.policyVersion as PolicyVersion, createdAt: String(input.eventTime), updatedAt: String(input.eventTime), correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID(), captureMethod: "OCR", bloodTypeEvidenceSource: String(input.bloodTypeEvidenceSource), componentEvidenceSource: String(input.componentEvidenceSource) };
    const response = this.serialize(asset); await ctx.stub.putState(this.componentKey(asset.componentId), Buffer.from(response, "utf8")); await ctx.stub.putState(identityKey, Buffer.from(asset.componentId, "utf8")); await this.writeIdempotent(ctx, String(input.idempotencyKey), "REGISTER_INBOUND_COMPONENT", requestDigest, response); this.emit(ctx, "InboundComponentRegistered", { componentId: asset.componentId, issuerInstitutionId: asset.issuerInstitutionId, custodyInstitutionId: asset.custodyInstitutionId, status: asset.status, version: asset.version, eventTime: asset.createdAt, correlationId: asset.correlationId }); return response;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadComponentByIdentity(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorUserId", "componentType", "donationNoDigest", "issuerInstitutionId"]);
    this.assertGateway(ctx); this.assertActor(input.actorUserId); this.assertHash(input.donationNoDigest, "COMPONENT_DONATION_REFERENCE_INVALID"); if (!this.policyFor(input).componentTypes.includes(input.componentType as ComponentType)) this.fail("COMPONENT_TYPE_UNSUPPORTED");
    const key = this.identityKey(String(input.issuerInstitutionId), String(input.donationNoDigest), String(input.componentType)); const stored = await ctx.stub.getState(key); return stored.length === 0 ? "" : Buffer.from(stored).toString("utf8");
  }

  @Transaction()
  @Returns("string")
  public async RecordInboundReceipt(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorInstitutionId", "actorUserId", "captureEvidenceDigest", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId"]);
    this.assertCommon(input); this.assertGateway(ctx); this.assertId(String(input.reservationId), RESERVATION_ID_PATTERN, "RESERVATION_INPUT_INVALID"); this.assertHash(input.captureEvidenceDigest, "COMPONENT_CAPTURE_EVIDENCE_INVALID");
    if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) this.fail("RESERVATION_VERSION_INVALID");
    const reservation = await this.readReservation(ctx, String(input.reservationId)); const actor = this.assertActor(input.actorUserId);
    if (!(actor.role === "ROLE_01" || actor.role === "ROLE_02") || actor.institutionId !== reservation.destinationInstitutionId || input.actorInstitutionId !== reservation.destinationInstitutionId || reservation.purpose !== "TRANSFER" || reservation.status !== "IN_TRANSIT") this.fail("RESERVATION_NOT_AUTHORIZED");
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    const prior = await this.readIdempotent(ctx, String(input.idempotencyKey), "RECEIVE_INBOUND_COMPONENT", this.digest(input)); if (prior !== undefined) return prior;
    for (const id of reservation.selectedComponentIds) { const component = await this.readComponent(ctx, id); if (component.status !== "IN_TRANSIT" || component.reservationId !== reservation.reservationId) this.fail("COMPONENT_STATE_CONFLICT"); await ctx.stub.putState(this.componentKey(id), Buffer.from(this.serialize({ ...component, status: "RECEIVED", version: component.version + 1, actorUserId: String(input.actorUserId), updatedAt: String(input.eventTime), correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID() } satisfies ComponentAsset), "utf8")); }
    const updated = { ...reservation, status: "RECEIVED" as const, version: reservation.version + 1, actorUserId: String(input.actorUserId), updatedAt: String(input.eventTime), correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID() };
    const response = this.serialize(updated); await ctx.stub.putState(this.reservationKey(reservation.reservationId), Buffer.from(response, "utf8")); await this.writeIdempotent(ctx, String(input.idempotencyKey), "RECEIVE_INBOUND_COMPONENT", this.digest(input), response); this.emit(ctx, "InboundReceiptRecorded", { reservationId: reservation.reservationId, status: updated.status, version: updated.version, eventTime: updated.updatedAt, correlationId: updated.correlationId }); return response;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadComponent(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorUserId", "componentId"]);
    this.assertGateway(ctx);
    this.assertId(String(input.componentId), COMPONENT_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    const asset = await this.readComponent(ctx, String(input.componentId));
    const actor = this.assertActor(input.actorUserId);
    const canSee = actor.role === "ROLE_01" || actor.role === "ROLE_02"
      ? actor.institutionId === asset.custodyInstitutionId
      : actor.role === "ROLE_03" && actor.institutionId === (await this.destinationForReservation(ctx, asset.reservationId));
    if (!canSee) this.fail("COMPONENT_NOT_AUTHORIZED");
    return this.serialize(asset);
  }

  @Transaction()
  @Returns("string")
  public async ReserveComponents(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, [
      "actorUserId", "bloodType", "componentType", "correlationId", "destinationInstitutionId",
      "eventTime", "expectedComponentVersions", "idempotencyKey", "policyVersion", "purpose",
      "quantity", "reservationId", "sourceInstitutionId", "selectedComponentIds",
    ]);
    this.assertGateway(ctx); this.assertCommon(input);
    this.assertId(String(input.reservationId), RESERVATION_ID_PATTERN, "RESERVATION_INPUT_INVALID");
    const purpose = input.purpose as ReservationPurpose;
    if (purpose !== "TRANSFER" && purpose !== "LOCAL_RELEASE") this.fail("RESERVATION_PURPOSE_INVALID");
    if (purpose === "TRANSFER" && typeof input.destinationInstitutionId !== "string") this.fail("RESERVATION_INSTITUTION_INVALID");
    if (purpose === "LOCAL_RELEASE" && input.destinationInstitutionId !== undefined && input.destinationInstitutionId !== null) this.fail("RESERVATION_INSTITUTION_INVALID");
    if (input.sourceInstitutionId !== this.actorInstitution(input.actorUserId)) this.fail("RESERVATION_NOT_AUTHORIZED");
    const actor = this.assertActor(input.actorUserId);
    if (purpose === "TRANSFER" && actor.role !== "ROLE_02") this.fail("RESERVATION_NOT_AUTHORIZED");
    if (purpose === "LOCAL_RELEASE" && !["ROLE_01", "ROLE_02"].includes(actor.role)) this.fail("RESERVATION_NOT_AUTHORIZED");
    if (!policy.bloodTypes.includes(input.bloodType as BloodType)) this.fail("COMPONENT_BLOOD_TYPE_UNSUPPORTED");
    if (!this.policyFor(input).componentTypes.includes(input.componentType as ComponentType)) this.fail("COMPONENT_TYPE_UNSUPPORTED");
    if (!Number.isSafeInteger(input.quantity) || Number(input.quantity) < 1) this.fail("RESERVATION_QUANTITY_INVALID");
    if (!Array.isArray(input.selectedComponentIds) || !Array.isArray(input.expectedComponentVersions) ||
        input.selectedComponentIds.length !== Number(input.quantity) || input.expectedComponentVersions.length !== input.selectedComponentIds.length ||
        new Set(input.selectedComponentIds).size !== input.selectedComponentIds.length) this.fail("RESERVATION_COMPONENTS_INVALID");
    for (const id of input.selectedComponentIds) this.assertId(String(id), COMPONENT_ID_PATTERN, "RESERVATION_COMPONENTS_INVALID");
    const requestDigest = this.digest(input);
    const prior = await this.readIdempotent(ctx, String(input.idempotencyKey), "RESERVE_COMPONENTS", requestDigest);
    if (prior !== undefined) return prior;
    if ((await ctx.stub.getState(this.reservationKey(String(input.reservationId)))).length > 0) this.fail("RESERVATION_DUPLICATE");
    const eventMs = this.parseUtc(input.eventTime);
    const eligible = await this.listEligible(ctx, String(input.sourceInstitutionId), input.bloodType as BloodType, input.componentType as ComponentType, eventMs);
    const expectedIds = eligible.slice(0, Number(input.quantity)).map((item) => item.componentId);
    if (eligible.length < Number(input.quantity)) this.fail("RESERVATION_INSUFFICIENT_STOCK");
    const selectedIds = input.selectedComponentIds as unknown[];
    const expectedVersions = input.expectedComponentVersions as unknown[];
    if (expectedIds.some((id, index) => id !== String(selectedIds[index]))) this.fail("RESERVATION_FEFO_VIOLATION");
    for (let index = 0; index < expectedIds.length; index += 1) {
      const asset = eligible[index];
      if (asset.version !== Number(expectedVersions[index])) this.fail("RESERVATION_VERSION_CONFLICT");
      await ctx.stub.putState(this.componentKey(asset.componentId), Buffer.from(this.serialize({
        ...asset, status: "RESERVED", reservationId: String(input.reservationId), reservationPurpose: purpose,
        version: asset.version + 1, actorUserId: String(input.actorUserId), updatedAt: String(input.eventTime),
        correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID(),
      } satisfies ComponentAsset), "utf8"));
    }
    const reservation: ReservationAsset = {
      schemaVersion: RESERVATION_SCHEMA, reservationId: String(input.reservationId), purpose,
      sourceInstitutionId: String(input.sourceInstitutionId),
      ...(purpose === "TRANSFER" ? { destinationInstitutionId: String(input.destinationInstitutionId) } : {}),
      bloodType: input.bloodType as BloodType, componentType: input.componentType as ComponentType,
      quantity: Number(input.quantity), selectedComponentIds: expectedIds, status: "ACTIVE", version: 1,
      actorUserId: String(input.actorUserId), policyVersion: input.policyVersion as PolicyVersion, createdAt: String(input.eventTime),
      updatedAt: String(input.eventTime), correlationId: String(input.correlationId), lastTransactionId: ctx.stub.getTxID(),
    };
    const response = this.serialize(reservation);
    await ctx.stub.putState(this.reservationKey(reservation.reservationId), Buffer.from(response, "utf8"));
    await this.writeIdempotent(ctx, String(input.idempotencyKey), "RESERVE_COMPONENTS", requestDigest, response);
    this.emit(ctx, "ComponentsReserved", { reservationId: reservation.reservationId, componentIds: expectedIds, status: reservation.status, version: 1, eventTime: reservation.createdAt, correlationId: reservation.correlationId });
    return response;
  }

  @Transaction()
  @Returns("string")
  public async PrepareReservation(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReservationAction(inputJson, ["preparedEvidenceDigest", "preparedEvidenceId", "preparedAt"]);
    const reservation = await this.readReservation(ctx, input.reservationId);
    this.assertReservationActor(input.actorUserId, reservation, ["ROLE_01", "ROLE_02"]);
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    if (reservation.status !== "ACTIVE") this.fail("RESERVATION_TRANSITION_INVALID");
    this.assertHash(input.preparedEvidenceDigest, "RESERVATION_EVIDENCE_INVALID");
    this.assertId(input.preparedEvidenceId, EVIDENCE_ID_PATTERN, "RESERVATION_EVIDENCE_INVALID");
    if (this.parseUtc(input.preparedAt) > this.parseUtc(input.eventTime)) this.fail("RESERVATION_EVIDENCE_INVALID");
    const updated: ReservationAsset = { ...reservation, preparedEvidenceDigest: input.preparedEvidenceDigest, preparedEvidenceId: input.preparedEvidenceId, preparedAt: input.preparedAt, version: reservation.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    return this.applyAction(ctx, input, "PREPARE_RESERVATION", updated, "ReservationPrepared");
  }

  @Transaction()
  @Returns("string")
  public async DispatchReservation(ctx: Context, inputJson: string): Promise<string> {
    return this.transitionReservation(ctx, inputJson, "DISPATCH_RESERVATION", "DISPATCHED", "ACTIVE", ["ROLE_01", "ROLE_02"], "ReservationDispatched");
  }

  @Transaction()
  @Returns("string")
  public async StartReservationTransit(ctx: Context, inputJson: string): Promise<string> {
    return this.transitionReservation(ctx, inputJson, "START_RESERVATION_TRANSIT", "IN_TRANSIT", "DISPATCHED", ["ROLE_01", "ROLE_02"], "ReservationInTransit");
  }

  @Transaction()
  @Returns("string")
  public async RecordReservationReceipt(ctx: Context, inputJson: string): Promise<string> {
    return this.transitionReservation(ctx, inputJson, "RECEIVE_RESERVATION", "RECEIVED", "IN_TRANSIT", ["ROLE_03"], "ReservationReceived");
  }

  @Transaction()
  @Returns("string")
  public async CompleteLocalRelease(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReservationAction(inputJson, []);
    const reservation = await this.readReservation(ctx, input.reservationId);
    this.assertReservationActor(input.actorUserId, reservation, ["ROLE_01", "ROLE_02"]);
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    if (reservation.purpose !== "LOCAL_RELEASE" || reservation.status !== "ACTIVE" || reservation.preparedEvidenceDigest === undefined) this.fail("RELEASE_PREPARATION_REQUIRED");
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "COMPLETE_LOCAL_RELEASE", this.digest(input));
    if (prior !== undefined) return prior;
    const updated: ReservationAsset = { ...reservation, status: "COMPLETED", version: reservation.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    for (const id of reservation.selectedComponentIds) {
      const component = await this.readComponent(ctx, id);
      if (component.status !== "RESERVED" || component.reservationId !== reservation.reservationId) this.fail("COMPONENT_STATE_CONFLICT");
      await ctx.stub.putState(this.componentKey(id), Buffer.from(this.serialize({ ...component, status: "RELEASED", reservationId: undefined, reservationPurpose: undefined, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() } satisfies ComponentAsset), "utf8"));
    }
    return this.applyAction(ctx, input, "COMPLETE_LOCAL_RELEASE", updated, "LocalReleaseCompleted");
  }

  @Transaction()
  @Returns("string")
  public async CancelReservation(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReservationAction(inputJson, []);
    const reservation = await this.readReservation(ctx, input.reservationId);
    this.assertReservationActor(input.actorUserId, reservation, ["ROLE_01", "ROLE_02", "ROLE_03"]);
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    if (reservation.status !== "ACTIVE") this.fail("RESERVATION_TRANSITION_INVALID");
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "CANCEL_RESERVATION", this.digest(input));
    if (prior !== undefined) return prior;
    for (const id of reservation.selectedComponentIds) {
      const component = await this.readComponent(ctx, id);
      if (component.status === "RESERVED" && component.reservationId === reservation.reservationId) {
        await ctx.stub.putState(this.componentKey(id), Buffer.from(this.serialize({ ...component, status: "AVAILABLE", reservationId: undefined, reservationPurpose: undefined, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() } satisfies ComponentAsset), "utf8"));
      }
    }
    const updated: ReservationAsset = { ...reservation, status: "CANCELLED", version: reservation.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    return this.applyAction(ctx, input, "CANCEL_RESERVATION", updated, "ReservationCancelled");
  }

  @Transaction()
  @Returns("string")
  public async PlaceReconciliationHold(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseComponentAction(inputJson, ["caseId", "reasonCode"]);
    const component = await this.readComponent(ctx, input.componentId);
    if (component.version !== Number(input.expectedVersion)) this.fail("COMPONENT_VERSION_CONFLICT");
    this.assertActorForInstitution(input.actorUserId, component.custodyInstitutionId, ["ROLE_01", "ROLE_02"]);
    if (!["AVAILABLE", "RESERVED"].includes(component.status)) this.fail("RECONCILIATION_TRANSITION_INVALID");
    this.assertId(input.caseId, CASE_ID_PATTERN, "RECONCILIATION_INPUT_INVALID");
    this.assertReconciliationReason(input.reasonCode, component.policyVersion);
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "PLACE_RECONCILIATION_HOLD", this.digest(input));
    if (prior !== undefined) return prior;
    const existing = await ctx.stub.getState(this.caseKey(input.caseId));
    if (existing.length > 0) this.fail("RECONCILIATION_DUPLICATE");
    const previousStatus = component.status as "AVAILABLE" | "RESERVED";
    const caseAsset: ReconciliationCaseAsset = { schemaVersion: CASE_SCHEMA, caseId: input.caseId, componentId: component.componentId, institutionId: component.custodyInstitutionId, previousStatus, ...(component.reservationId === undefined ? {} : { reservationId: component.reservationId }), reasonCode: input.reasonCode, status: "OPEN", version: 1, actorUserId: input.actorUserId, policyVersion: component.policyVersion, createdAt: input.eventTime, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    const updated = { ...component, status: "RECONCILIATION_HOLD" as const, reconciliationCaseId: input.caseId, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    await ctx.stub.putState(this.componentKey(component.componentId), Buffer.from(this.serialize(updated), "utf8"));
    await ctx.stub.putState(this.caseKey(caseAsset.caseId), Buffer.from(this.serialize(caseAsset), "utf8"));
    await this.writeIdempotent(ctx, input.idempotencyKey, "PLACE_RECONCILIATION_HOLD", this.digest(input), this.serialize(caseAsset));
    return this.serialize(caseAsset);
  }

  @Transaction()
  @Returns("string")
  public async ResolveReconciliationHold(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseComponentAction(inputJson, ["caseId", "resolutionCode"]);
    const caseStored = await ctx.stub.getState(this.caseKey(input.caseId));
    if (caseStored.length === 0) this.fail("RECONCILIATION_NOT_FOUND");
    const caseAsset = this.parseState<ReconciliationCaseAsset>(caseStored, CASE_SCHEMA);
    const component = await this.readComponent(ctx, input.componentId);
    this.assertActorForInstitution(input.actorUserId, component.custodyInstitutionId, ["ROLE_01", "ROLE_02"]);
    if (component.version !== Number(input.expectedVersion)) this.fail("COMPONENT_VERSION_CONFLICT");
    if (caseAsset.status !== "OPEN" || caseAsset.componentId !== component.componentId || component.status !== "RECONCILIATION_HOLD") this.fail("RECONCILIATION_TRANSITION_INVALID");
    this.assertReason(input.resolutionCode);
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "RESOLVE_RECONCILIATION_HOLD", this.digest(input));
    if (prior !== undefined) return prior;
    let restored: "AVAILABLE" | "RESERVED" = "AVAILABLE";
    if (caseAsset.reservationId !== undefined) {
      const reservation = await this.readReservation(ctx, caseAsset.reservationId);
      if (reservation.status === "ACTIVE" && reservation.selectedComponentIds.includes(component.componentId)) restored = "RESERVED";
    }
    const updated = { ...component, status: restored, reconciliationCaseId: undefined, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    const resolved = { ...caseAsset, status: "RESOLVED" as const, resolutionCode: input.resolutionCode, version: caseAsset.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    await ctx.stub.putState(this.componentKey(component.componentId), Buffer.from(this.serialize(updated), "utf8"));
    await ctx.stub.putState(this.caseKey(caseAsset.caseId), Buffer.from(this.serialize(resolved), "utf8"));
    await this.writeIdempotent(ctx, input.idempotencyKey, "RESOLVE_RECONCILIATION_HOLD", this.digest(input), this.serialize(resolved));
    return this.serialize(resolved);
  }

  @Transaction()
  @Returns("string")
  public async EvaluateComponentExpiry(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseComponentAction(inputJson, ["evaluationTime"]);
    const component = await this.readComponent(ctx, input.componentId);
    this.assertActorForInstitution(input.actorUserId, component.custodyInstitutionId, ["ROLE_01", "ROLE_02"]);
    const expectedVersion = Number(input.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || component.version !== expectedVersion) this.fail("COMPONENT_VERSION_CONFLICT");
    const evaluationMs = this.parseUtc(input.evaluationTime);
    if (component.status === "EXPIRED" || !["AVAILABLE", "RESERVED"].includes(component.status)) this.fail("COMPONENT_EXPIRY_TRANSITION_INVALID");
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "EVALUATE_COMPONENT_EXPIRY", this.digest(input));
    if (prior !== undefined) return prior;
    if (evaluationMs < this.parseUtc(component.labelExpiry)) return this.serialize(component);
    const updated = { ...component, status: "EXPIRED" as const, reservationId: undefined, reservationPurpose: undefined, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    await ctx.stub.putState(this.componentKey(component.componentId), Buffer.from(this.serialize(updated), "utf8"));
    await this.writeIdempotent(ctx, input.idempotencyKey, "EVALUATE_COMPONENT_EXPIRY", this.digest(input), this.serialize(updated));
    return this.serialize(updated);
  }

  @Transaction()
  @Returns("string")
  public async MarkReservationCompromised(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReservationAction(inputJson, ["reasonCode"]);
    const reservation = await this.readReservation(ctx, input.reservationId);
    this.assertReservationActor(input.actorUserId, reservation, ["ROLE_01", "ROLE_02", "ROLE_03"]);
    this.assertCompromiseReason(input.reasonCode, reservation.policyVersion);
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, "COMPROMISE_RESERVATION", this.digest(input));
    if (prior !== undefined) return prior;
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    if (!["DISPATCHED", "IN_TRANSIT", "RECEIVED"].includes(reservation.status)) this.fail("RESERVATION_TRANSITION_INVALID");
    const components: ComponentAsset[] = [];
    for (const id of reservation.selectedComponentIds) {
      const component = await this.readComponent(ctx, id);
      if (component.reservationId !== reservation.reservationId || component.status !== reservation.status) this.fail("COMPONENT_STATE_CONFLICT");
      components.push(component);
    }
    for (const component of components) {
      const updated = { ...component, status: "COMPROMISED" as const, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
      await ctx.stub.putState(this.componentKey(component.componentId), Buffer.from(this.serialize(updated), "utf8"));
    }
    const updatedReservation = { ...reservation, status: "COMPROMISED" as const, compromiseReasonCode: input.reasonCode, compromisePolicyVersion: this.policyFor(input).compromisePolicyVersion, version: reservation.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    return this.applyAction(ctx, input, "COMPROMISE_RESERVATION", updatedReservation, "ReservationCompromised");
  }

  private async transitionReservation(ctx: Context, inputJson: string, operation: string, next: ReservationStatus, current: ReservationStatus, roles: Role[], eventName: string): Promise<string> {
    const input = this.parseReservationAction(inputJson, []);
    const reservation = await this.readReservation(ctx, input.reservationId);
    this.assertReservationActor(input.actorUserId, reservation, roles);
    if (reservation.version !== Number(input.expectedVersion)) this.fail("RESERVATION_VERSION_CONFLICT");
    if (reservation.status !== current) this.fail("RESERVATION_TRANSITION_INVALID");
    if (next === "DISPATCHED" && reservation.preparedEvidenceDigest === undefined) this.fail("RELEASE_PREPARATION_REQUIRED");
    if (next === "RECEIVED" && reservation.purpose !== "TRANSFER") this.fail("RESERVATION_TRANSITION_INVALID");
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, operation, this.digest(input));
    if (prior !== undefined) return prior;
    for (const id of reservation.selectedComponentIds) {
      const component = await this.readComponent(ctx, id);
      const expected: ComponentStatus = current === "ACTIVE" ? "RESERVED" : current === "DISPATCHED" ? "DISPATCHED" : "IN_TRANSIT";
      if (component.status !== expected || component.reservationId !== reservation.reservationId) this.fail("COMPONENT_STATE_CONFLICT");
      const componentNext = next === "DISPATCHED" ? "DISPATCHED" : next === "IN_TRANSIT" ? "IN_TRANSIT" : "RECEIVED";
      await ctx.stub.putState(this.componentKey(id), Buffer.from(this.serialize({ ...component, status: componentNext, version: component.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() } satisfies ComponentAsset), "utf8"));
    }
    const updated = { ...reservation, status: next, version: reservation.version + 1, actorUserId: input.actorUserId, updatedAt: input.eventTime, correlationId: input.correlationId, lastTransactionId: ctx.stub.getTxID() };
    return this.applyAction(ctx, input, operation, updated, eventName);
  }

  private parseReservationAction(inputJson: string, extra: string[]): Record<string, string> {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorUserId", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", "reservationId", ...extra]);
    this.assertCommon(input); this.assertId(String(input.reservationId), RESERVATION_ID_PATTERN, "RESERVATION_INPUT_INVALID");
    if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) this.fail("RESERVATION_VERSION_INVALID");
    for (const key of extra) if (typeof input[key] !== "string") this.fail("RESERVATION_INPUT_INVALID");
    return input as Record<string, string>;
  }

  private parseComponentAction(inputJson: string, extra: string[]): Record<string, string> & { expectedVersion: number } {
    const input = this.parseExactObject<Record<string, unknown>>(inputJson, ["actorUserId", "componentId", "correlationId", "eventTime", "expectedVersion", "idempotencyKey", "policyVersion", ...extra]);
    this.assertCommon(input); this.assertId(String(input.componentId), COMPONENT_ID_PATTERN, "COMPONENT_INPUT_INVALID");
    if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) this.fail("COMPONENT_VERSION_INVALID");
    for (const key of extra) if (typeof input[key] !== "string") this.fail("COMPONENT_INPUT_INVALID");
    return input as Record<string, string> & { expectedVersion: number };
  }

  private async applyAction(ctx: Context, input: Record<string, string>, operation: string, asset: ReservationAsset, eventName: string): Promise<string> {
    const requestDigest = this.digest(input);
    const prior = await this.readIdempotent(ctx, input.idempotencyKey, operation, requestDigest);
    if (prior !== undefined) return prior;
    const response = this.serialize(asset);
    await ctx.stub.putState(this.reservationKey(asset.reservationId), Buffer.from(response, "utf8"));
    await this.writeIdempotent(ctx, input.idempotencyKey, operation, requestDigest, response);
    this.emit(ctx, eventName, { reservationId: asset.reservationId, status: asset.status, version: asset.version, eventTime: asset.updatedAt, correlationId: asset.correlationId });
    return response;
  }

  private assertReservationActor(actorUserId: string, reservation: ReservationAsset, roles: Role[]): void {
    const actor = this.assertActor(actorUserId);
    if (!roles.includes(actor.role)) this.fail("RESERVATION_NOT_AUTHORIZED");
    if (actor.role === "ROLE_03") {
      if (reservation.purpose !== "TRANSFER" || actor.institutionId !== reservation.destinationInstitutionId) this.fail("RESERVATION_NOT_AUTHORIZED");
    } else if (actor.institutionId !== reservation.sourceInstitutionId) {
      this.fail("RESERVATION_NOT_AUTHORIZED");
    }
  }

  private async destinationForReservation(ctx: Context, reservationId: string | undefined): Promise<string | undefined> {
    if (reservationId === undefined) return undefined;
    const stored = await ctx.stub.getState(this.reservationKey(reservationId));
    if (stored.length === 0) return undefined;
    return (this.parseState<ReservationAsset>(stored, RESERVATION_SCHEMA)).destinationInstitutionId;
  }

  private async listEligible(ctx: Context, institutionId: string, bloodType: BloodType, componentType: ComponentType, eventMs: number): Promise<ComponentAsset[]> {
    const entries = await ctx.stub.getStateByRange("component:asset:", "component:asset;");
    const assets: ComponentAsset[] = [];
    try {
      while (true) {
        const next = await entries.next(); if (next.done) break;
        const value = this.parseState<ComponentAsset>(Buffer.from(next.value.value), COMPONENT_SCHEMA);
        if (value.status === "AVAILABLE" && value.custodyInstitutionId === institutionId && value.bloodType === bloodType && value.componentType === componentType && this.parseUtc(value.labelExpiry) > eventMs) assets.push(value);
      }
    } finally { await entries.close(); }
    return assets.sort((a, b) => this.parseUtc(a.labelExpiry) - this.parseUtc(b.labelExpiry) || a.componentId.localeCompare(b.componentId));
  }

  private async listIdentityTypes(ctx: Context, prefix: string): Promise<string[]> {
    const entries = await ctx.stub.getStateByRange(prefix, `${prefix}\uffff`); const types: string[] = [];
    try {
      while (true) { const next = await entries.next(); if (next.done) break; const key = next.value.key; const type = key.slice(prefix.length); if (type.length > 0) types.push(type); }
    } finally { await entries.close(); }
    return types;
  }

  private async readComponent(ctx: Context, componentId: string): Promise<ComponentAsset> {
    const stored = await ctx.stub.getState(this.componentKey(componentId));
    if (stored.length === 0) this.fail("COMPONENT_NOT_FOUND");
    return this.parseState<ComponentAsset>(stored, COMPONENT_SCHEMA);
  }

  private async readReservation(ctx: Context, reservationId: string): Promise<ReservationAsset> {
    const stored = await ctx.stub.getState(this.reservationKey(reservationId));
    if (stored.length === 0) this.fail("RESERVATION_NOT_FOUND");
    return this.parseState<ReservationAsset>(stored, RESERVATION_SCHEMA);
  }

  private assertGateway(ctx: Context): void {
    const identity = ctx.clientIdentity;
    if (identity.getMSPID() !== AUTHORIZED_MSP_ID || identity.getAttributeValue("hf.EnrollmentID") !== AUTHORIZED_ENROLLMENT_ID || identity.getAttributeValue("hf.Type") !== AUTHORIZED_IDENTITY_TYPE || identity.getAttributeValue(ROLE_ATTRIBUTE) !== AUTHORIZED_ROLE || identity.getAttributeValue(INSTITUTION_ATTRIBUTE) !== "INST_MEDIATRIX") this.fail("CORE_NOT_AUTHORIZED");
  }

  private assertActorForInstitution(actorUserId: unknown, institutionId: unknown, roles: Role[]): ActorPolicy {
    const actor = this.assertActor(actorUserId); if (!roles.includes(actor.role) || actor.institutionId !== String(institutionId)) this.fail("CORE_NOT_AUTHORIZED"); return actor;
  }

  private assertActor(actorUserId: unknown): ActorPolicy { this.assertId(String(actorUserId), ACTOR_ID_PATTERN, "CORE_INPUT_INVALID"); const actor = policy.actors[String(actorUserId)]; if (actor === undefined) this.fail("CORE_NOT_AUTHORIZED"); return actor; }
  private actorInstitution(actorUserId: unknown): string { return this.assertActor(actorUserId).institutionId; }

  private policyFor(input: Record<string, unknown>): typeof policy | typeof policyV21 {
    return input.policyVersion === POLICY_VERSION_V21 ? policyV21 : policy;
  }
  private assertCommon(input: Record<string, unknown>): void {
    this.assertId(String(input.actorUserId), ACTOR_ID_PATTERN, "CORE_INPUT_INVALID");
    this.assertId(String(input.correlationId), CORRELATION_ID_PATTERN, "CORE_INPUT_INVALID");
    this.assertId(String(input.idempotencyKey), IDEMPOTENCY_KEY_PATTERN, "CORE_INPUT_INVALID");
    this.parseUtc(input.eventTime); if (input.policyVersion !== POLICY_VERSION && input.policyVersion !== POLICY_VERSION_V21) this.fail("CORE_POLICY_MISMATCH");
  }
  private assertReason(value: string): void { this.assertId(value, REASON_PATTERN, "CORE_REASON_INVALID"); }
  private assertCompromiseReason(value: string, policyVersion: PolicyVersion): void {
    const activePolicy = policyVersion === POLICY_VERSION_V21 ? policyV21 : policy;
    if (!activePolicy.compromiseReasonCodes.includes(value)) this.fail("COMPROMISE_REASON_INVALID");
  }
  private assertReconciliationReason(value: string, policyVersion: PolicyVersion): void {
    const activePolicy = policyVersion === POLICY_VERSION_V21 ? policyV21 : policy;
    if (!activePolicy.reconciliationReasonCodes.includes(value)) this.fail("RECONCILIATION_REASON_INVALID");
  }
  private assertHash(value: unknown, errorCode: string): void { if (typeof value !== "string" || !HASH_PATTERN.test(value)) this.fail(errorCode); }
  private assertId(value: string, pattern: RegExp, errorCode: string): void { if (!pattern.test(value)) this.fail(errorCode); }
  private parseUtc(value: unknown): number { if (typeof value !== "string") this.fail("CORE_TIME_INVALID"); const ms = Date.parse(value); if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) this.fail("CORE_TIME_INVALID"); return ms; }

  private parseExactObject<T extends Record<string, unknown>>(inputJson: string, expectedKeys: string[]): T {
    let parsed: unknown; try { parsed = JSON.parse(inputJson); } catch { this.fail("CORE_INPUT_INVALID"); }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) this.fail("CORE_INPUT_INVALID");
    const keys = Object.keys(parsed).sort(); const expected = [...expectedKeys].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) this.fail("CORE_FIELD_NOT_ALLOWED");
    return parsed as T;
  }
  private parseState<T>(stored: Uint8Array, schemaVersion: string): T { let value: unknown; try { value = JSON.parse(Buffer.from(stored).toString("utf8")); } catch { this.fail("CORE_STATE_INVALID"); } if (typeof value !== "object" || value === null || (value as Record<string, unknown>).schemaVersion !== schemaVersion) this.fail("CORE_STATE_INVALID"); return value as T; }
  private async readIdempotent(ctx: Context, key: string, operation: string, digest: string): Promise<string | undefined> { const stored = await ctx.stub.getState(this.idempotencyKey(key)); if (stored.length === 0) return undefined; const record = this.parseState<IdempotencyRecord>(stored, "CORE_IDEMPOTENCY_V2"); if (record.operation !== operation || record.requestDigest !== digest) this.fail("CORE_IDEMPOTENCY_CONFLICT"); return record.response; }
  private async writeIdempotent(ctx: Context, key: string, operation: string, requestDigest: string, response: string): Promise<void> { await ctx.stub.putState(this.idempotencyKey(key), Buffer.from(this.serialize({ schemaVersion: "CORE_IDEMPOTENCY_V2", operation, requestDigest, response }), "utf8")); }
  private emit(ctx: Context, eventName: string, payload: object): void { ctx.stub.setEvent(eventName, Buffer.from(this.serialize(payload), "utf8")); }
  private digest(value: object): string { return createHash("sha256").update(this.serialize(value), "utf8").digest("hex"); }
  private serialize(value: object): string { return JSON.stringify(value); }
  private componentKey(id: string): string { return `component:asset:${id}`; }
  private transferKey(id: string): string { return `transfer:v2:asset:${id}`; }
  private reservationKey(id: string): string { return `reservation:asset:${id}`; }
  private caseKey(id: string): string { return `reconciliation:case:${id}`; }
  private identityKey(issuer: string, digest: string, componentType: string): string { return `component:identity:${issuer}:${digest}:${componentType}`; }
  private idempotencyKey(id: string): string { return `core-v2:idempotency:${id}`; }
  private fail(errorCode: string): never { throw new Error(errorCode); }
}
