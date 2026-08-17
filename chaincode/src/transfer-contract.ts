import { createHash } from "node:crypto";
import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import inventoryPolicyJson from "../policy/synthetic-inventory-v1.json";
import transferPolicyJson from "../policy/synthetic-transfer-v1.json";

const AUTHORIZED_MSP_ID = "MediatrixMSP";
const AUTHORIZED_ENROLLMENT_ID = "api-gateway";
const AUTHORIZED_IDENTITY_TYPE = "client";
const AUTHORIZED_ROLE = "API_GATEWAY";
const ROLE_ATTRIBUTE = "bloodledger.role";
const INSTITUTION_ATTRIBUTE = "bloodledger.institution_id";
const TRANSFER_SCHEMA_VERSION = "TRANSFER_ASSET_V1";
const INVENTORY_SCHEMA_V2 = "INVENTORY_ASSET_V2";
const TRANSFER_ID_PATTERN = /^TRF_[A-Z0-9_-]{1,56}$/;
const UNIT_ID_PATTERN = /^UNIT_[A-Z0-9_-]{1,56}$/;
const ACTOR_ID_PATTERN = /^USR_[A-Z0-9_-]{1,48}$/;
const CORRELATION_ID_PATTERN = /^CORR_[A-Z0-9_-]{1,59}$/;
const IDEMPOTENCY_KEY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;
const LOCATION_ID_PATTERN = /^LOC_[A-Z0-9_-]{1,56}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

type BloodType = "A_POSITIVE" | "O_POSITIVE";
type Component = "PLATELETS" | "RED_BLOOD_CELLS";
type Urgency = "ROUTINE" | "URGENT" | "CRITICAL";
type TransferStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELAYED"
  | "RECEIVED"
  | "COMPROMISED"
  | "CANCELLED";
type InventoryStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "COMPROMISED"
  | "EXPIRED";
type ActorRole = "HOSPITAL_ADMIN" | "MEDICAL_TECHNOLOGIST" | "SECONDARY_HOSPITAL_USER";

interface ActorPolicy {
  institutionId: string;
  role: ActorRole;
}

interface BloodUnitAsset {
  schemaVersion: "INVENTORY_ASSET_V1" | typeof INVENTORY_SCHEMA_V2;
  unitId: string;
  bloodType: BloodType;
  component: Component;
  collectedAt: string;
  expiresAt: string;
  institutionId: string;
  actorUserId: string;
  status: InventoryStatus;
  policyVersion: string;
  transferPolicyVersion?: string;
  reservedForTransferId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}

interface LocationEvidenceSummary {
  evidenceId: string;
  evidenceDigest: string;
  phase: "DISPATCH" | "RECEIPT";
  capturedAt: string;
  source: "DEVICE" | "FACILITY_FALLBACK";
  facilityMatched: boolean;
  fallback: boolean;
  policyVersion: "SYNTHETIC_LOCATION_V1";
}

export interface TransferAsset {
  schemaVersion: typeof TRANSFER_SCHEMA_VERSION;
  transferId: string;
  sourceInstitutionId: string;
  destinationInstitutionId: string;
  bloodType: BloodType;
  component: Component;
  quantity: number;
  urgency: Urgency;
  requestTime: string;
  status: TransferStatus;
  selectedUnitIds: string[];
  dispatchEvidence?: LocationEvidenceSummary;
  receiptEvidence?: LocationEvidenceSummary;
  reasonCode?: string;
  actorUserId: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1";
  recommendationDigest?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}

interface SubmitTransferInput {
  transferId: string;
  sourceInstitutionId: string;
  destinationInstitutionId: string;
  bloodType: BloodType;
  component: Component;
  quantity: number;
  urgency: Urgency;
  requestTime: string;
  actorUserId: string;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: string;
  inventoryPolicyVersion: string;
}

interface ApproveTransferInput {
  transferId: string;
  selectedUnitIds: string[];
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: string;
  inventoryPolicyVersion: string;
  recommendationDigest?: string;
}

interface BasicTransitionInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: string;
}

interface ReasonTransitionInput extends BasicTransitionInput {
  reasonCode: string;
}

interface LocationTransitionInput extends BasicTransitionInput {
  locationEvidence: LocationEvidenceSummary;
}

interface IdempotencyRecord {
  operation: string;
  requestDigest: string;
  response: string;
}

const inventoryPolicy = inventoryPolicyJson as {
  institutionId: string;
  policyVersion: "SYNTHETIC_INVENTORY_V1";
  bloodTypes: BloodType[];
  components: Record<Component, object>;
};
const transferPolicy = transferPolicyJson as {
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  sourceInstitutionId: string;
  maximumRequestQuantity: number;
  reservationReallocationEnabled: boolean;
  receivedUnitsBecomeAvailable: boolean;
  recipientInstitutionIds: string[];
  actors: Record<string, ActorPolicy>;
};

@Info({
  title: "TransferContract",
  description: "Sprint 3 deterministic synthetic transfer and custody contract",
})
export class TransferContract extends Contract {
  public constructor() {
    super("TransferContract");
  }

  @Transaction()
  @Returns("string")
  public async SubmitTransferRequest(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<SubmitTransferInput>(inputJson, [
      "actorUserId", "bloodType", "component", "correlationId",
      "destinationInstitutionId", "eventTime", "idempotencyKey",
      "inventoryPolicyVersion", "policyVersion", "quantity", "requestTime",
      "sourceInstitutionId", "transferId", "urgency",
    ]);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertPattern(input.transferId, TRANSFER_ID_PATTERN, "TRF_INPUT_INVALID");
    if (
      input.sourceInstitutionId !== transferPolicy.sourceInstitutionId ||
      !transferPolicy.recipientInstitutionIds.includes(input.destinationInstitutionId)
    ) this.fail("TRF_INSTITUTION_INVALID");
    const actor = this.assertActor(input.actorUserId);
    if (
      actor.role !== "SECONDARY_HOSPITAL_USER" ||
      actor.institutionId !== input.destinationInstitutionId
    ) this.fail("TRF_NOT_AUTHORIZED");
    if (!inventoryPolicy.bloodTypes.includes(input.bloodType)) this.fail("TRF_BLOOD_TYPE_UNSUPPORTED");
    if (!Object.hasOwn(inventoryPolicy.components, input.component)) this.fail("TRF_COMPONENT_UNSUPPORTED");
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > transferPolicy.maximumRequestQuantity) {
      this.fail("TRF_QUANTITY_INVALID");
    }
    if (!["ROUTINE", "URGENT", "CRITICAL"].includes(input.urgency)) this.fail("TRF_URGENCY_INVALID");
    const requestMs = this.parseUtc(input.requestTime);
    const eventMs = this.parseUtc(input.eventTime);
    if (requestMs > eventMs) this.fail("TRF_TIME_INVALID");

    const response = await this.withIdempotency(ctx, "SUBMIT", input, async () => {
      if ((await ctx.stub.getState(this.transferKey(input.transferId))).length > 0) this.fail("TRF_DUPLICATE");
      const transfer: TransferAsset = {
        schemaVersion: TRANSFER_SCHEMA_VERSION,
        transferId: input.transferId,
        sourceInstitutionId: input.sourceInstitutionId,
        destinationInstitutionId: input.destinationInstitutionId,
        bloodType: input.bloodType,
        component: input.component,
        quantity: input.quantity,
        urgency: input.urgency,
        requestTime: input.requestTime,
        status: "PENDING",
        selectedUnitIds: [],
        actorUserId: input.actorUserId,
        policyVersion: transferPolicy.policyVersion,
        inventoryPolicyVersion: inventoryPolicy.policyVersion,
        version: 1,
        createdAt: input.eventTime,
        updatedAt: input.eventTime,
        correlationId: input.correlationId,
        lastTransactionId: ctx.stub.getTxID(),
      };
      await this.writeTransfer(ctx, transfer);
      this.emit(ctx, transfer, "TransferRequested");
      return this.serialize(transfer);
    });
    return response;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadTransfer(ctx: Context, transferId: string): Promise<string> {
    this.assertGateway(ctx);
    this.assertPattern(transferId, TRANSFER_ID_PATTERN, "TRF_INPUT_INVALID");
    return this.serialize(await this.readTransfer(ctx, transferId));
  }

  @Transaction()
  @Returns("string")
  public async ApproveTransfer(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseOptionalExactObject<ApproveTransferInput>(inputJson, [
      "actorUserId", "correlationId", "eventTime", "expectedVersion",
      "idempotencyKey", "inventoryPolicyVersion", "policyVersion",
      "selectedUnitIds", "transferId",
    ], ["recommendationDigest"]);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertAdmin(input.actorUserId);
    this.assertExpectedVersion(input.expectedVersion);
    if (input.inventoryPolicyVersion !== inventoryPolicy.policyVersion) this.fail("TRF_POLICY_MISMATCH");
    if (!Array.isArray(input.selectedUnitIds) || new Set(input.selectedUnitIds).size !== input.selectedUnitIds.length) {
      this.fail("TRF_UNITS_INVALID");
    }
    for (const unitId of input.selectedUnitIds) this.assertPattern(unitId, UNIT_ID_PATTERN, "TRF_UNITS_INVALID");
    if (input.recommendationDigest !== undefined && !HASH_PATTERN.test(input.recommendationDigest)) {
      this.fail("TRF_RECOMMENDATION_INVALID");
    }
    const eventMs = this.parseUtc(input.eventTime);

    return this.withIdempotency(ctx, "APPROVE", input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, ["PENDING"], input.eventTime);
      if (input.selectedUnitIds.length !== transfer.quantity) this.fail("TRF_INSUFFICIENT_STOCK");
      const eligible = await this.listEligibleUnits(ctx, transfer, eventMs);
      if (eligible.length < transfer.quantity) this.fail("TRF_INSUFFICIENT_STOCK");
      const expectedIds = eligible.slice(0, transfer.quantity).map((asset) => asset.unitId);
      if (expectedIds.some((unitId, index) => unitId !== input.selectedUnitIds[index])) {
        this.fail("TRF_FEFO_VIOLATION");
      }
      for (const asset of eligible.slice(0, transfer.quantity)) {
        await this.writeUnit(ctx, this.changeUnit(asset, "RESERVED", transfer.transferId, input));
      }
      const updated = this.changeTransfer(ctx, transfer, "APPROVED", input, {
        selectedUnitIds: expectedIds,
        ...(input.recommendationDigest === undefined ? {} : { recommendationDigest: input.recommendationDigest }),
      });
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, "TransferApproved");
      return this.serialize(updated);
    });
  }

  @Transaction()
  @Returns("string")
  public async RejectTransfer(ctx: Context, inputJson: string): Promise<string> {
    return this.reasonTransition(ctx, inputJson, "REJECT", ["PENDING"], "REJECTED", ["HOSPITAL_ADMIN"]);
  }

  @Transaction()
  @Returns("string")
  public async CancelTransfer(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReasonInput(inputJson);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertExpectedVersion(input.expectedVersion);
    const actor = this.assertActor(input.actorUserId);
    return this.withIdempotency(ctx, "CANCEL", input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, ["PENDING", "APPROVED"], input.eventTime);
      const allowed = actor.role === "HOSPITAL_ADMIN" || (
        transfer.status === "PENDING" &&
        actor.role === "SECONDARY_HOSPITAL_USER" &&
        actor.institutionId === transfer.destinationInstitutionId
      );
      if (!allowed) this.fail("TRF_NOT_AUTHORIZED");
      if (transfer.status === "APPROVED") await this.updateSelectedUnits(ctx, transfer, "RESERVED", "AVAILABLE", input);
      const updated = this.changeTransfer(ctx, transfer, "CANCELLED", input, { reasonCode: input.reasonCode });
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, "TransferCancelled");
      return this.serialize(updated);
    });
  }

  @Transaction()
  @Returns("string")
  public async RecordDispatch(ctx: Context, inputJson: string): Promise<string> {
    return this.locationTransition(ctx, inputJson, "DISPATCH", ["APPROVED"], "DISPATCHED", "RESERVED", "DISPATCHED", "dispatchEvidence", ["HOSPITAL_ADMIN", "MEDICAL_TECHNOLOGIST"]);
  }

  @Transaction()
  @Returns("string")
  public async StartTransit(ctx: Context, inputJson: string): Promise<string> {
    return this.basicTransition(ctx, inputJson, "START_TRANSIT", ["DISPATCHED"], "IN_TRANSIT", "DISPATCHED", "IN_TRANSIT", ["HOSPITAL_ADMIN", "MEDICAL_TECHNOLOGIST"]);
  }

  @Transaction()
  @Returns("string")
  public async MarkTransferDelayed(ctx: Context, inputJson: string): Promise<string> {
    return this.reasonTransition(ctx, inputJson, "DELAY", ["IN_TRANSIT"], "DELAYED", ["HOSPITAL_ADMIN", "MEDICAL_TECHNOLOGIST", "SECONDARY_HOSPITAL_USER"]);
  }

  @Transaction()
  @Returns("string")
  public async ResumeTransfer(ctx: Context, inputJson: string): Promise<string> {
    return this.basicTransition(ctx, inputJson, "RESUME", ["DELAYED"], "IN_TRANSIT", undefined, undefined, ["HOSPITAL_ADMIN", "MEDICAL_TECHNOLOGIST"]);
  }

  @Transaction()
  @Returns("string")
  public async RecordReceipt(ctx: Context, inputJson: string): Promise<string> {
    return this.locationTransition(ctx, inputJson, "RECEIPT", ["IN_TRANSIT", "DELAYED"], "RECEIVED", "IN_TRANSIT", "RECEIVED", "receiptEvidence", ["SECONDARY_HOSPITAL_USER"]);
  }

  @Transaction()
  @Returns("string")
  public async MarkTransferCompromised(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseReasonInput(inputJson);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertExpectedVersion(input.expectedVersion);
    const actor = this.assertActor(input.actorUserId);
    if (!["HOSPITAL_ADMIN", "MEDICAL_TECHNOLOGIST", "SECONDARY_HOSPITAL_USER"].includes(actor.role)) this.fail("TRF_NOT_AUTHORIZED");
    return this.withIdempotency(ctx, "COMPROMISE", input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, ["DISPATCHED", "IN_TRANSIT", "DELAYED", "RECEIVED"], input.eventTime);
      const expectedUnitStatus: InventoryStatus = transfer.status === "RECEIVED" ? "RECEIVED" : transfer.status === "DISPATCHED" ? "DISPATCHED" : "IN_TRANSIT";
      await this.updateSelectedUnits(ctx, transfer, expectedUnitStatus, "COMPROMISED", input);
      const updated = this.changeTransfer(ctx, transfer, "COMPROMISED", input, { reasonCode: input.reasonCode });
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, "TransferCompromised");
      return this.serialize(updated);
    });
  }

  private async basicTransition(
    ctx: Context, inputJson: string, operation: string, allowed: TransferStatus[],
    next: TransferStatus, expectedUnitStatus: InventoryStatus | undefined,
    nextUnitStatus: InventoryStatus | undefined, roles: ActorRole[],
  ): Promise<string> {
    const input = this.parseBasicInput(inputJson);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertExpectedVersion(input.expectedVersion);
    const actor = this.assertActor(input.actorUserId);
    if (!roles.includes(actor.role)) this.fail("TRF_NOT_AUTHORIZED");
    return this.withIdempotency(ctx, operation, input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, allowed, input.eventTime);
      this.assertActorScope(actor, transfer);
      if (expectedUnitStatus !== undefined && nextUnitStatus !== undefined) {
        await this.updateSelectedUnits(ctx, transfer, expectedUnitStatus, nextUnitStatus, input);
      }
      const updated = this.changeTransfer(ctx, transfer, next, input);
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, `Transfer${next}`);
      return this.serialize(updated);
    });
  }

  private async reasonTransition(
    ctx: Context, inputJson: string, operation: string, allowed: TransferStatus[],
    next: TransferStatus, roles: ActorRole[],
  ): Promise<string> {
    const input = this.parseReasonInput(inputJson);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertExpectedVersion(input.expectedVersion);
    const actor = this.assertActor(input.actorUserId);
    if (!roles.includes(actor.role)) this.fail("TRF_NOT_AUTHORIZED");
    return this.withIdempotency(ctx, operation, input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, allowed, input.eventTime);
      this.assertActorScope(actor, transfer);
      const updated = this.changeTransfer(ctx, transfer, next, input, { reasonCode: input.reasonCode });
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, `Transfer${next}`);
      return this.serialize(updated);
    });
  }

  private async locationTransition(
    ctx: Context, inputJson: string, phase: "DISPATCH" | "RECEIPT",
    allowed: TransferStatus[], next: TransferStatus, expectedUnitStatus: InventoryStatus,
    nextUnitStatus: InventoryStatus, evidenceField: "dispatchEvidence" | "receiptEvidence",
    roles: ActorRole[],
  ): Promise<string> {
    const input = this.parseLocationInput(inputJson);
    this.assertGateway(ctx);
    this.assertCommon(input);
    this.assertExpectedVersion(input.expectedVersion);
    const actor = this.assertActor(input.actorUserId);
    if (!roles.includes(actor.role)) this.fail("TRF_NOT_AUTHORIZED");
    this.assertLocation(input.locationEvidence, phase, input.eventTime);
    return this.withIdempotency(ctx, phase, input, async () => {
      const transfer = await this.readTransfer(ctx, input.transferId);
      this.assertTransition(transfer, input.expectedVersion, allowed, input.eventTime);
      this.assertActorScope(actor, transfer);
      await this.updateSelectedUnits(ctx, transfer, expectedUnitStatus, nextUnitStatus, input);
      const updated = this.changeTransfer(ctx, transfer, next, input, {
        [evidenceField]: input.locationEvidence,
      });
      await this.writeTransfer(ctx, updated);
      this.emit(ctx, updated, `Transfer${next}`);
      return this.serialize(updated);
    });
  }

  private parseBasicInput(inputJson: string): BasicTransitionInput {
    return this.parseExactObject(inputJson, [
      "actorUserId", "correlationId", "eventTime", "expectedVersion",
      "idempotencyKey", "policyVersion", "transferId",
    ]);
  }

  private parseReasonInput(inputJson: string): ReasonTransitionInput {
    const input = this.parseExactObject<ReasonTransitionInput>(inputJson, [
      "actorUserId", "correlationId", "eventTime", "expectedVersion",
      "idempotencyKey", "policyVersion", "reasonCode", "transferId",
    ]);
    this.assertPattern(input.reasonCode, REASON_PATTERN, "TRF_REASON_INVALID");
    return input;
  }

  private parseLocationInput(inputJson: string): LocationTransitionInput {
    const input = this.parseExactObject<LocationTransitionInput>(inputJson, [
      "actorUserId", "correlationId", "eventTime", "expectedVersion",
      "idempotencyKey", "locationEvidence", "policyVersion", "transferId",
    ]);
    if (typeof input.locationEvidence !== "object" || input.locationEvidence === null || Array.isArray(input.locationEvidence)) {
      this.fail("TRF_LOCATION_INVALID");
    }
    const evidenceKeys = Object.keys(input.locationEvidence).sort();
    const expected = ["capturedAt", "evidenceDigest", "evidenceId", "facilityMatched", "fallback", "phase", "policyVersion", "source"].sort();
    if (evidenceKeys.length !== expected.length || evidenceKeys.some((key, index) => key !== expected[index])) this.fail("TRF_LOCATION_INVALID");
    return input;
  }

  private assertLocation(
    evidence: LocationEvidenceSummary,
    phase: "DISPATCH" | "RECEIPT",
    eventTime: string,
  ): void {
    this.assertPattern(evidence.evidenceId, LOCATION_ID_PATTERN, "TRF_LOCATION_INVALID");
    this.assertPattern(evidence.evidenceDigest, HASH_PATTERN, "TRF_LOCATION_INVALID");
    const capturedMs = this.parseUtc(evidence.capturedAt);
    if (
      evidence.phase !== phase || evidence.policyVersion !== "SYNTHETIC_LOCATION_V1" ||
      !["DEVICE", "FACILITY_FALLBACK"].includes(evidence.source) ||
      typeof evidence.facilityMatched !== "boolean" || typeof evidence.fallback !== "boolean" ||
      (evidence.source === "DEVICE" && evidence.fallback) ||
      (evidence.source === "FACILITY_FALLBACK" && !evidence.fallback)
    ) this.fail("TRF_LOCATION_INVALID");
    if (capturedMs > this.parseUtc(eventTime)) this.fail("TRF_LOCATION_INVALID");
  }

  private assertCommon(input: { transferId?: string; actorUserId: string; eventTime: string; correlationId: string; idempotencyKey: string; policyVersion: string }): void {
    if (input.transferId !== undefined) this.assertPattern(input.transferId, TRANSFER_ID_PATTERN, "TRF_INPUT_INVALID");
    this.assertPattern(input.actorUserId, ACTOR_ID_PATTERN, "TRF_INPUT_INVALID");
    this.assertPattern(input.correlationId, CORRELATION_ID_PATTERN, "TRF_INPUT_INVALID");
    this.assertPattern(input.idempotencyKey, IDEMPOTENCY_KEY_PATTERN, "TRF_INPUT_INVALID");
    this.parseUtc(input.eventTime);
    if (input.policyVersion !== transferPolicy.policyVersion) this.fail("TRF_POLICY_MISMATCH");
  }

  private assertGateway(ctx: Context): void {
    const identity = ctx.clientIdentity;
    if (
      identity.getMSPID() !== AUTHORIZED_MSP_ID ||
      identity.getAttributeValue("hf.EnrollmentID") !== AUTHORIZED_ENROLLMENT_ID ||
      identity.getAttributeValue("hf.Type") !== AUTHORIZED_IDENTITY_TYPE ||
      identity.getAttributeValue(ROLE_ATTRIBUTE) !== AUTHORIZED_ROLE ||
      identity.getAttributeValue(INSTITUTION_ATTRIBUTE) !== inventoryPolicy.institutionId
    ) this.fail("TRF_NOT_AUTHORIZED");
  }

  private assertActor(actorUserId: string): ActorPolicy {
    this.assertPattern(actorUserId, ACTOR_ID_PATTERN, "TRF_INPUT_INVALID");
    const actor = transferPolicy.actors[actorUserId];
    if (actor === undefined) this.fail("TRF_NOT_AUTHORIZED");
    return actor;
  }

  private assertAdmin(actorUserId: string): void {
    const actor = this.assertActor(actorUserId);
    if (actor.role !== "HOSPITAL_ADMIN" || actor.institutionId !== transferPolicy.sourceInstitutionId) {
      this.fail("TRF_NOT_AUTHORIZED");
    }
  }

  private assertActorScope(actor: ActorPolicy, transfer: TransferAsset): void {
    if (actor.role === "SECONDARY_HOSPITAL_USER" && actor.institutionId !== transfer.destinationInstitutionId) {
      this.fail("TRF_NOT_AUTHORIZED");
    }
    if (actor.role !== "SECONDARY_HOSPITAL_USER" && actor.institutionId !== transfer.sourceInstitutionId) {
      this.fail("TRF_NOT_AUTHORIZED");
    }
  }

  private assertExpectedVersion(value: number): void {
    if (!Number.isSafeInteger(value) || value < 1) this.fail("TRF_VERSION_INVALID");
  }

  private assertTransition(
    transfer: TransferAsset,
    expectedVersion: number,
    allowed: TransferStatus[],
    eventTime: string,
  ): void {
    if (transfer.version !== expectedVersion) this.fail("TRF_VERSION_CONFLICT");
    if (!allowed.includes(transfer.status)) this.fail("TRF_TRANSITION_INVALID");
    if (this.parseUtc(eventTime) < this.parseUtc(transfer.updatedAt)) this.fail("TRF_TIME_INVALID");
  }

  private async listEligibleUnits(ctx: Context, transfer: TransferAsset, eventMs: number): Promise<BloodUnitAsset[]> {
    const assets: BloodUnitAsset[] = [];
    const iterator = await ctx.stub.getStateByRange("inventory:unit:", "inventory:unit;");
    try {
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const entry = next.value;
        let asset: BloodUnitAsset;
        try { asset = JSON.parse(Buffer.from(entry.value).toString("utf8")) as BloodUnitAsset; }
        catch { this.fail("TRF_STATE_INVALID"); }
        if (
          asset.status === "AVAILABLE" && asset.institutionId === transfer.sourceInstitutionId &&
          asset.bloodType === transfer.bloodType && asset.component === transfer.component &&
          asset.policyVersion === transfer.inventoryPolicyVersion && this.parseUtc(asset.expiresAt) > eventMs
        ) assets.push(asset);
      }
    } finally {
      await iterator.close();
    }
    return assets.sort((left, right) => left.expiresAt.localeCompare(right.expiresAt) || left.unitId.localeCompare(right.unitId));
  }

  private async updateSelectedUnits(
    ctx: Context, transfer: TransferAsset, expected: InventoryStatus,
    next: InventoryStatus, input: BasicTransitionInput,
  ): Promise<void> {
    const assets: BloodUnitAsset[] = [];
    for (const unitId of transfer.selectedUnitIds) {
      const asset = await this.readUnit(ctx, unitId);
      if (asset.status !== expected || asset.reservedForTransferId !== transfer.transferId) this.fail("TRF_UNIT_UNAVAILABLE");
      assets.push(asset);
    }
    for (const asset of assets) {
      await this.writeUnit(ctx, this.changeUnit(asset, next, next === "AVAILABLE" ? undefined : transfer.transferId, input));
    }
  }

  private changeUnit(
    asset: BloodUnitAsset, status: InventoryStatus, transferId: string | undefined,
    input: { actorUserId: string; eventTime: string; correlationId: string },
  ): BloodUnitAsset {
    return {
      ...asset,
      schemaVersion: INVENTORY_SCHEMA_V2,
      status,
      institutionId: asset.institutionId,
      actorUserId: input.actorUserId,
      transferPolicyVersion: transferPolicy.policyVersion,
      ...(transferId === undefined ? { reservedForTransferId: undefined } : { reservedForTransferId: transferId }),
      version: asset.version + 1,
      updatedAt: input.eventTime,
      correlationId: input.correlationId,
      lastTransactionId: "",
    };
  }

  private changeTransfer(
    ctx: Context, transfer: TransferAsset, status: TransferStatus,
    input: { actorUserId: string; eventTime: string; correlationId: string },
    additional: Partial<TransferAsset> = {},
  ): TransferAsset {
    return {
      ...transfer,
      ...additional,
      status,
      actorUserId: input.actorUserId,
      version: transfer.version + 1,
      updatedAt: input.eventTime,
      correlationId: input.correlationId,
      lastTransactionId: ctx.stub.getTxID(),
    };
  }

  private async readTransfer(ctx: Context, transferId: string): Promise<TransferAsset> {
    const stored = await ctx.stub.getState(this.transferKey(transferId));
    if (stored.length === 0) this.fail("TRF_NOT_FOUND");
    let transfer: TransferAsset;
    try { transfer = JSON.parse(Buffer.from(stored).toString("utf8")) as TransferAsset; }
    catch { this.fail("TRF_STATE_INVALID"); }
    if (transfer.schemaVersion !== TRANSFER_SCHEMA_VERSION || transfer.transferId !== transferId) this.fail("TRF_STATE_INVALID");
    return transfer;
  }

  private async readUnit(ctx: Context, unitId: string): Promise<BloodUnitAsset> {
    const stored = await ctx.stub.getState(this.unitKey(unitId));
    if (stored.length === 0) this.fail("TRF_UNIT_NOT_FOUND");
    try { return JSON.parse(Buffer.from(stored).toString("utf8")) as BloodUnitAsset; }
    catch { this.fail("TRF_STATE_INVALID"); }
  }

  private async writeTransfer(ctx: Context, transfer: TransferAsset): Promise<void> {
    await ctx.stub.putState(this.transferKey(transfer.transferId), Buffer.from(this.serialize(transfer), "utf8"));
  }

  private async writeUnit(ctx: Context, asset: BloodUnitAsset): Promise<void> {
    const finalized = { ...asset, lastTransactionId: ctx.stub.getTxID() };
    if (finalized.status === "RECEIVED" && finalized.reservedForTransferId !== undefined) {
      const transfer = await this.readTransfer(ctx, finalized.reservedForTransferId);
      finalized.institutionId = transfer.destinationInstitutionId;
    }
    await ctx.stub.putState(this.unitKey(finalized.unitId), Buffer.from(this.serialize(finalized), "utf8"));
  }

  private async withIdempotency(
    ctx: Context, operation: string, input: object, action: () => Promise<string>,
  ): Promise<string> {
    const inputValue = input as { idempotencyKey: string };
    const requestDigest = this.digest(input);
    const key = this.idempotencyKey(inputValue.idempotencyKey);
    const stored = await ctx.stub.getState(key);
    if (stored.length > 0) {
      let record: IdempotencyRecord;
      try { record = JSON.parse(Buffer.from(stored).toString("utf8")) as IdempotencyRecord; }
      catch { this.fail("TRF_STATE_INVALID"); }
      if (record.operation !== operation || record.requestDigest !== requestDigest) this.fail("TRF_IDEMPOTENCY_CONFLICT");
      return record.response;
    }
    const response = await action();
    const record: IdempotencyRecord = { operation, requestDigest, response };
    await ctx.stub.putState(key, Buffer.from(this.serialize(record), "utf8"));
    return response;
  }

  private emit(ctx: Context, transfer: TransferAsset, eventType: string): void {
    ctx.stub.setEvent(eventType, Buffer.from(this.serialize({
      eventType,
      transferId: transfer.transferId,
      sourceInstitutionId: transfer.sourceInstitutionId,
      destinationInstitutionId: transfer.destinationInstitutionId,
      status: transfer.status,
      version: transfer.version,
      eventTime: transfer.updatedAt,
      correlationId: transfer.correlationId,
      policyVersion: transfer.policyVersion,
    }), "utf8"));
  }

  private parseExactObject<T>(inputJson: string, expectedKeys: string[]): T {
    return this.parseOptionalExactObject(inputJson, expectedKeys, []);
  }

  private parseOptionalExactObject<T>(inputJson: string, requiredKeys: string[], optionalKeys: string[]): T {
    let parsed: unknown;
    try { parsed = JSON.parse(inputJson); } catch { this.fail("TRF_INPUT_INVALID"); }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) this.fail("TRF_INPUT_INVALID");
    const keys = Object.keys(parsed).sort();
    const allowed = [...requiredKeys, ...optionalKeys].sort();
    if (requiredKeys.some((key) => !keys.includes(key)) || keys.some((key) => !allowed.includes(key))) {
      this.fail("TRF_FIELD_NOT_ALLOWED");
    }
    return parsed as T;
  }

  private parseUtc(value: string): number {
    if (typeof value !== "string") this.fail("TRF_TIME_INVALID");
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) this.fail("TRF_TIME_INVALID");
    return milliseconds;
  }

  private assertPattern(value: string, pattern: RegExp, errorCode: string): void {
    if (typeof value !== "string" || !pattern.test(value)) this.fail(errorCode);
  }

  private transferKey(transferId: string): string { return `transfer:asset:${transferId}`; }
  private unitKey(unitId: string): string { return `inventory:unit:${unitId}`; }
  private idempotencyKey(key: string): string { return `transfer:idempotency:${key}`; }
  private digest(value: object): string { return createHash("sha256").update(this.serialize(value), "utf8").digest("hex"); }
  private serialize(value: object): string { return JSON.stringify(value); }
  private fail(errorCode: string): never { throw new Error(errorCode); }
}
