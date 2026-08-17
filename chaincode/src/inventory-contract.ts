import { createHash } from "node:crypto";
import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import syntheticPolicy from "../policy/synthetic-inventory-v1.json";

const AUTHORIZED_MSP_ID = "MediatrixMSP";
const AUTHORIZED_ENROLLMENT_ID = "api-gateway";
const AUTHORIZED_IDENTITY_TYPE = "client";
const AUTHORIZED_ROLE = "API_GATEWAY";
const ROLE_ATTRIBUTE = "bloodledger.role";
const INSTITUTION_ATTRIBUTE = "bloodledger.institution_id";
const SCHEMA_VERSION = "INVENTORY_ASSET_V1";
const TRANSFER_SCHEMA_VERSION = "TRANSFER_ASSET_V1";
const UNIT_ID_PATTERN = /^UNIT_[A-Z0-9_-]{1,56}$/;
const ACTOR_ID_PATTERN = /^USR_[A-Z0-9_-]{1,48}$/;
const CORRELATION_ID_PATTERN = /^CORR_[A-Z0-9_-]{1,59}$/;
const IDEMPOTENCY_KEY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;

type BloodType = "A_POSITIVE" | "O_POSITIVE";
type Component = "PLATELETS" | "RED_BLOOD_CELLS";
type InventoryStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "COMPROMISED"
  | "EXPIRED";
type ExpiryResult = "CURRENT" | "NEAR_EXPIRY" | "EXPIRED";

interface RegisterBloodUnitInput {
  unitId: string;
  bloodType: BloodType;
  component: Component;
  collectedAt: string;
  expiresAt: string;
  institutionId: string;
  actorUserId: string;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: string;
}

interface EvaluateExpiryInput {
  unitId: string;
  institutionId: string;
  actorUserId: string;
  evaluationTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: string;
}

export interface BloodUnitAsset {
  schemaVersion: typeof SCHEMA_VERSION | "INVENTORY_ASSET_V2";
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

interface InventoryEvent {
  eventType: "BloodUnitRegistered" | "BloodUnitExpiryEvaluated";
  unitId: string;
  institutionId: string;
  status: InventoryStatus;
  version: number;
  eventTime: string;
  correlationId: string;
  policyVersion: string;
}

interface ExpiryEvaluation {
  result: ExpiryResult;
  asset: BloodUnitAsset;
}

interface IdempotencyRecord {
  operation: "REGISTER" | "EVALUATE_EXPIRY";
  requestDigest: string;
  response: string;
}

const policy = syntheticPolicy as {
  classification: string;
  institutionId: string;
  policyVersion: string;
  bloodTypes: BloodType[];
  components: Record<Component, {
    maximumCollectionToExpirySeconds: number;
    nearExpiryLeadSeconds: number;
  }>;
};

@Info({
  title: "InventoryContract",
  description: "Sprint 2 deterministic inventory contract using a non-clinical synthetic policy",
})
export class InventoryContract extends Contract {
  public constructor() {
    super("InventoryContract");
  }

  @Transaction()
  @Returns("string")
  public async RegisterBloodUnit(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<RegisterBloodUnitInput>(inputJson, [
      "actorUserId", "bloodType", "collectedAt", "component", "correlationId",
      "eventTime", "expiresAt", "idempotencyKey", "institutionId",
      "policyVersion", "unitId",
    ]);
    this.assertAuthorizedSubmitter(ctx, input.institutionId);
    this.assertRegistrationInput(input);

    const requestDigest = this.digest(input);
    const idempotent = await this.readIdempotentResponse(
      ctx,
      input.idempotencyKey,
      "REGISTER",
      requestDigest,
    );
    if (idempotent !== undefined) {
      return idempotent;
    }

    const key = this.assetKey(input.unitId);
    if ((await ctx.stub.getState(key)).length > 0) {
      this.fail("INV_DUPLICATE_UNIT");
    }

    const asset: BloodUnitAsset = {
      schemaVersion: SCHEMA_VERSION,
      unitId: input.unitId,
      bloodType: input.bloodType,
      component: input.component,
      collectedAt: input.collectedAt,
      expiresAt: input.expiresAt,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      status: "AVAILABLE",
      policyVersion: input.policyVersion,
      version: 1,
      createdAt: input.eventTime,
      updatedAt: input.eventTime,
      correlationId: input.correlationId,
      lastTransactionId: ctx.stub.getTxID(),
    };
    const response = this.serialize(asset);
    await ctx.stub.putState(key, Buffer.from(response, "utf8"));
    await this.writeIdempotencyRecord(
      ctx,
      input.idempotencyKey,
      "REGISTER",
      requestDigest,
      response,
    );
    this.emitEvent(ctx, {
      eventType: "BloodUnitRegistered",
      unitId: asset.unitId,
      institutionId: asset.institutionId,
      status: asset.status,
      version: asset.version,
      eventTime: input.eventTime,
      correlationId: input.correlationId,
      policyVersion: input.policyVersion,
    });
    return response;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadBloodUnit(ctx: Context, unitId: string): Promise<string> {
    this.assertAuthorizedSubmitter(ctx, policy.institutionId);
    this.assertPattern(unitId, UNIT_ID_PATTERN, "INV_INPUT_INVALID");
    return this.serialize(await this.readAsset(ctx, unitId));
  }

  @Transaction()
  @Returns("string")
  public async EvaluateBloodUnitExpiry(ctx: Context, inputJson: string): Promise<string> {
    const input = this.parseExactObject<EvaluateExpiryInput>(inputJson, [
      "actorUserId", "correlationId", "evaluationTime", "expectedVersion",
      "idempotencyKey", "institutionId", "policyVersion", "unitId",
    ]);
    this.assertAuthorizedSubmitter(ctx, input.institutionId);
    this.assertEvaluationInput(input);

    const requestDigest = this.digest(input);
    const idempotent = await this.readIdempotentResponse(
      ctx,
      input.idempotencyKey,
      "EVALUATE_EXPIRY",
      requestDigest,
    );
    if (idempotent !== undefined) {
      return idempotent;
    }

    const asset = await this.readAsset(ctx, input.unitId);
    if (asset.institutionId !== input.institutionId && asset.reservedForTransferId === undefined) {
      this.fail("INV_INSTITUTION_MISMATCH");
    }
    if (asset.policyVersion !== input.policyVersion) {
      this.fail("INV_POLICY_MISMATCH");
    }
    if (asset.version !== input.expectedVersion) {
      this.fail("INV_VERSION_CONFLICT");
    }
    if (asset.status === "EXPIRED") {
      this.fail("INV_TRANSITION_INVALID");
    }

    const evaluationMs = this.parseUtc(input.evaluationTime);
    const expiryMs = this.parseUtc(asset.expiresAt);
    const nearExpiryLeadMs =
      policy.components[asset.component].nearExpiryLeadSeconds * 1000;
    let result: ExpiryResult = "CURRENT";
    let resultingAsset = asset;
    if (evaluationMs >= expiryMs) {
      result = "EXPIRED";
      await this.applyTransferExpiryEffects(ctx, asset, input);
      resultingAsset = {
        ...asset,
        status: "EXPIRED",
        actorUserId: input.actorUserId,
        version: asset.version + 1,
        updatedAt: input.evaluationTime,
        correlationId: input.correlationId,
        lastTransactionId: ctx.stub.getTxID(),
      };
      await ctx.stub.putState(
        this.assetKey(asset.unitId),
        Buffer.from(this.serialize(resultingAsset), "utf8"),
      );
    } else if (evaluationMs >= expiryMs - nearExpiryLeadMs) {
      result = "NEAR_EXPIRY";
    }

    const response = this.serialize({ result, asset: resultingAsset } satisfies ExpiryEvaluation);
    await this.writeIdempotencyRecord(
      ctx,
      input.idempotencyKey,
      "EVALUATE_EXPIRY",
      requestDigest,
      response,
    );
    this.emitEvent(ctx, {
      eventType: "BloodUnitExpiryEvaluated",
      unitId: resultingAsset.unitId,
      institutionId: resultingAsset.institutionId,
      status: resultingAsset.status,
      version: resultingAsset.version,
      eventTime: input.evaluationTime,
      correlationId: input.correlationId,
      policyVersion: input.policyVersion,
    });
    return response;
  }

  private assertAuthorizedSubmitter(ctx: Context, institutionId: string): void {
    const identity = ctx.clientIdentity;
    if (
      identity.getMSPID() !== AUTHORIZED_MSP_ID ||
      identity.getAttributeValue("hf.EnrollmentID") !== AUTHORIZED_ENROLLMENT_ID ||
      identity.getAttributeValue("hf.Type") !== AUTHORIZED_IDENTITY_TYPE ||
      identity.getAttributeValue(ROLE_ATTRIBUTE) !== AUTHORIZED_ROLE ||
      identity.getAttributeValue(INSTITUTION_ATTRIBUTE) !== policy.institutionId
    ) {
      this.fail("INV_NOT_AUTHORIZED");
    }
    if (institutionId !== policy.institutionId) {
      this.fail("INV_INSTITUTION_MISMATCH");
    }
  }

  private assertRegistrationInput(input: RegisterBloodUnitInput): void {
    this.assertCommonInput(input);
    if (!policy.bloodTypes.includes(input.bloodType)) {
      this.fail("INV_BLOOD_TYPE_UNSUPPORTED");
    }
    if (!Object.hasOwn(policy.components, input.component)) {
      this.fail("INV_COMPONENT_UNSUPPORTED");
    }
    const collectedMs = this.parseUtc(input.collectedAt);
    const expiresMs = this.parseUtc(input.expiresAt);
    const maximumMs =
      policy.components[input.component].maximumCollectionToExpirySeconds * 1000;
    if (expiresMs <= collectedMs || expiresMs - collectedMs > maximumMs) {
      this.fail("INV_EXPIRY_INVALID");
    }
    const eventMs = this.parseUtc(input.eventTime);
    if (eventMs < collectedMs) {
      this.fail("INV_TIME_INVALID");
    }
  }

  private assertEvaluationInput(input: EvaluateExpiryInput): void {
    this.assertCommonInput(input);
    this.parseUtc(input.evaluationTime);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
      this.fail("INV_VERSION_INVALID");
    }
  }

  private assertCommonInput(input: {
    unitId: string;
    institutionId: string;
    actorUserId: string;
    correlationId: string;
    idempotencyKey: string;
    policyVersion: string;
  }): void {
    this.assertPattern(input.unitId, UNIT_ID_PATTERN, "INV_INPUT_INVALID");
    this.assertPattern(input.actorUserId, ACTOR_ID_PATTERN, "INV_INPUT_INVALID");
    this.assertPattern(input.correlationId, CORRELATION_ID_PATTERN, "INV_INPUT_INVALID");
    this.assertPattern(input.idempotencyKey, IDEMPOTENCY_KEY_PATTERN, "INV_INPUT_INVALID");
    if (input.institutionId !== policy.institutionId) {
      this.fail("INV_INSTITUTION_MISMATCH");
    }
    if (input.policyVersion !== policy.policyVersion) {
      this.fail("INV_POLICY_MISMATCH");
    }
  }

  private parseExactObject<T>(inputJson: string, expectedKeys: string[]): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputJson);
    } catch {
      this.fail("INV_INPUT_INVALID");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this.fail("INV_INPUT_INVALID");
    }
    const keys = Object.keys(parsed).sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== [...expectedKeys].sort()[index])
    ) {
      this.fail("INV_FIELD_NOT_ALLOWED");
    }
    return parsed as T;
  }

  private parseUtc(value: string): number {
    if (typeof value !== "string") {
      this.fail("INV_TIME_INVALID");
    }
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
      this.fail("INV_TIME_INVALID");
    }
    return milliseconds;
  }

  private assertPattern(value: string, pattern: RegExp, errorCode: string): void {
    if (typeof value !== "string" || !pattern.test(value)) {
      this.fail(errorCode);
    }
  }

  private async readAsset(ctx: Context, unitId: string): Promise<BloodUnitAsset> {
    const stored = await ctx.stub.getState(this.assetKey(unitId));
    if (stored.length === 0) {
      this.fail("INV_UNIT_NOT_FOUND");
    }
    let asset: BloodUnitAsset;
    try {
      asset = JSON.parse(Buffer.from(stored).toString("utf8")) as BloodUnitAsset;
    } catch {
      this.fail("INV_STATE_INVALID");
    }
    if (
      ![SCHEMA_VERSION, "INVENTORY_ASSET_V2"].includes(asset.schemaVersion) ||
      asset.unitId !== unitId ||
      !policy.bloodTypes.includes(asset.bloodType) ||
      !Object.hasOwn(policy.components, asset.component) ||
      ![
        "AVAILABLE", "RESERVED", "DISPATCHED", "IN_TRANSIT",
        "RECEIVED", "COMPROMISED", "EXPIRED",
      ].includes(asset.status)
    ) {
      this.fail("INV_STATE_INVALID");
    }
    return asset;
  }

  private async applyTransferExpiryEffects(
    ctx: Context,
    asset: BloodUnitAsset,
    input: EvaluateExpiryInput,
  ): Promise<void> {
    if (asset.reservedForTransferId === undefined || asset.status === "AVAILABLE") {
      return;
    }
    const transferKey = `transfer:asset:${asset.reservedForTransferId}`;
    const stored = await ctx.stub.getState(transferKey);
    if (stored.length === 0) {
      this.fail("INV_STATE_INVALID");
    }
    let transfer: Record<string, unknown>;
    try {
      transfer = JSON.parse(Buffer.from(stored).toString("utf8")) as Record<string, unknown>;
    } catch {
      this.fail("INV_STATE_INVALID");
    }
    if (
      transfer.schemaVersion !== TRANSFER_SCHEMA_VERSION ||
      transfer.transferId !== asset.reservedForTransferId ||
      !Array.isArray(transfer.selectedUnitIds) ||
      !Number.isSafeInteger(transfer.version)
    ) {
      this.fail("INV_STATE_INVALID");
    }

    if (asset.status === "RESERVED") {
      if (transfer.status !== "APPROVED") {
        this.fail("INV_STATE_INVALID");
      }
      const siblings: BloodUnitAsset[] = [];
      for (const unitId of transfer.selectedUnitIds as unknown[]) {
        if (typeof unitId !== "string") {
          this.fail("INV_STATE_INVALID");
        }
        if (unitId === asset.unitId) continue;
        const sibling = await this.readAsset(ctx, unitId);
        if (sibling.status !== "RESERVED" ||
            sibling.reservedForTransferId !== asset.reservedForTransferId) {
          this.fail("INV_STATE_INVALID");
        }
        siblings.push(sibling);
      }
      for (const sibling of siblings) {
          const released: BloodUnitAsset = {
            ...sibling,
            schemaVersion: "INVENTORY_ASSET_V2",
            status: "AVAILABLE",
            reservedForTransferId: undefined,
            actorUserId: input.actorUserId,
            version: sibling.version + 1,
            updatedAt: input.evaluationTime,
            correlationId: input.correlationId,
            lastTransactionId: ctx.stub.getTxID(),
          };
          await ctx.stub.putState(
            this.assetKey(released.unitId),
            Buffer.from(this.serialize(released), "utf8"),
          );
      }
      transfer.status = "CANCELLED";
      transfer.reasonCode = "RESERVED_UNIT_EXPIRED";
    } else if (transfer.status !== "COMPROMISED") {
      if (!["DISPATCHED", "IN_TRANSIT", "DELAYED", "RECEIVED"].includes(String(transfer.status))) {
        this.fail("INV_STATE_INVALID");
      }
      transfer.status = "COMPROMISED";
      transfer.reasonCode = "UNIT_EXPIRED_IN_CUSTODY";
    }
    transfer.actorUserId = input.actorUserId;
    transfer.version = Number(transfer.version) + 1;
    transfer.updatedAt = input.evaluationTime;
    transfer.correlationId = input.correlationId;
    transfer.lastTransactionId = ctx.stub.getTxID();
    await ctx.stub.putState(transferKey, Buffer.from(this.serialize(transfer), "utf8"));
  }

  private async readIdempotentResponse(
    ctx: Context,
    idempotencyKey: string,
    operation: IdempotencyRecord["operation"],
    requestDigest: string,
  ): Promise<string | undefined> {
    const stored = await ctx.stub.getState(this.idempotencyKey(idempotencyKey));
    if (stored.length === 0) {
      return undefined;
    }
    let record: IdempotencyRecord;
    try {
      record = JSON.parse(Buffer.from(stored).toString("utf8")) as IdempotencyRecord;
    } catch {
      this.fail("INV_STATE_INVALID");
    }
    if (record.operation !== operation || record.requestDigest !== requestDigest) {
      this.fail("INV_IDEMPOTENCY_CONFLICT");
    }
    return record.response;
  }

  private async writeIdempotencyRecord(
    ctx: Context,
    idempotencyKey: string,
    operation: IdempotencyRecord["operation"],
    requestDigest: string,
    response: string,
  ): Promise<void> {
    const record: IdempotencyRecord = { operation, requestDigest, response };
    await ctx.stub.putState(
      this.idempotencyKey(idempotencyKey),
      Buffer.from(this.serialize(record), "utf8"),
    );
  }

  private emitEvent(ctx: Context, event: InventoryEvent): void {
    ctx.stub.setEvent(event.eventType, Buffer.from(this.serialize(event), "utf8"));
  }

  private assetKey(unitId: string): string {
    return `inventory:unit:${unitId}`;
  }

  private idempotencyKey(idempotencyKey: string): string {
    return `inventory:idempotency:${idempotencyKey}`;
  }

  private digest(value: object): string {
    return createHash("sha256").update(this.serialize(value), "utf8").digest("hex");
  }

  private serialize(value: object): string {
    return JSON.stringify(value);
  }

  private fail(errorCode: string): never {
    throw new Error(errorCode);
  }
}
