import { createPrivateKey } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as grpc from "@grpc/grpc-js";
import { connect, hash, type Identity, signers, StatusCode } from "@hyperledger/fabric-gateway";
import { WorkerFailure } from "./errors.js";
import type { ScanEvent } from "./types.js";

export interface FabricCommit {
  transactionId: string;
  committedAt: Date;
}

export interface InventoryLedger {
  register(event: ScanEvent): Promise<FabricCommit>;
}

export interface TransferRequestInput {
  transferId: string;
  sourceInstitutionId: "INST_MEDIATRIX";
  destinationInstitutionId: string;
  bloodType: "A_POSITIVE" | "O_POSITIVE";
  component: "RED_BLOOD_CELLS" | "PLATELETS";
  quantity: number;
  urgency: "ROUTINE" | "URGENT" | "CRITICAL";
  requestTime: string;
  actorUserId: string;
  eventTime: string;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1";
}

export type TransferStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISPATCHED" | "IN_TRANSIT" | "DELAYED" | "RECEIVED" | "COMPROMISED" | "CANCELLED";

export interface TransferLedgerAsset {
  transferId: string;
  sourceInstitutionId: string;
  destinationInstitutionId: string;
  bloodType: string;
  component: string;
  quantity: number;
  urgency: string;
  requestTime: string;
  status: TransferStatus;
  selectedUnitIds: string[];
  dispatchEvidence?: LocationEvidenceSummary;
  receiptEvidence?: LocationEvidenceSummary;
  reasonCode?: string;
  actorUserId: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1";
  version: number;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  lastTransactionId: string;
}

export interface TransferLedgerResult {
  asset: TransferLedgerAsset;
  committedAt: Date;
  ledgerReplayed: boolean;
}

export interface TransferApprovalInput {
  transferId: string;
  selectedUnitIds: string[];
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1";
}

export interface LocationEvidenceSummary {
  evidenceId: string;
  evidenceDigest: string;
  phase: "DISPATCH" | "RECEIPT";
  capturedAt: string;
  source: "DEVICE" | "FACILITY_FALLBACK";
  facilityMatched: boolean;
  fallback: boolean;
  policyVersion: "SYNTHETIC_LOCATION_V1";
}

export interface TransferTransitInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
}

export interface TransferReceiptInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  locationEvidence: LocationEvidenceSummary;
}

export interface TransferDispatchInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  locationEvidence: LocationEvidenceSummary;
}

export interface TransferCancellationInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  reasonCode: string;
}

export interface TransferRejectionInput {
  transferId: string;
  actorUserId: string;
  eventTime: string;
  expectedVersion: number;
  correlationId: string;
  idempotencyKey: string;
  policyVersion: "SYNTHETIC_TRANSFER_V1";
  reasonCode: string;
}

export interface TransferLedger {
  submitRequest(input: TransferRequestInput): Promise<TransferLedgerResult>;
  approveTransfer(input: TransferApprovalInput): Promise<TransferLedgerResult>;
  cancelTransfer(input: TransferCancellationInput): Promise<TransferLedgerResult>;
  dispatchTransfer(input: TransferDispatchInput): Promise<TransferLedgerResult>;
  recordReceipt(input: TransferReceiptInput): Promise<TransferLedgerResult>;
  startTransit(input: TransferTransitInput): Promise<TransferLedgerResult>;
  rejectTransfer(input: TransferRejectionInput): Promise<TransferLedgerResult>;
}

function deadline(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

async function exactlyOneFile(directory: string): Promise<string> {
  const entries = (await readdir(directory)).filter((entry) => !entry.startsWith(".")).sort();
  if (entries.length !== 1) throw new WorkerFailure("FABRIC_IDENTITY_UNAVAILABLE", false);
  return join(directory, entries[0]);
}

export function safeFabricError(error: unknown): WorkerFailure {
  const details: string[] = [];
  if (error instanceof Error) details.push(error.message);
  if (typeof error === "object" && error !== null && "details" in error && Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (typeof detail === "object" && detail !== null && "message" in detail && typeof detail.message === "string") {
        details.push(detail.message);
      }
    }
  }
  const code = details.join(" ").match(/\b(?:INV|TRF)_[A-Z_]+\b/)?.[0];
  if (code) return new WorkerFailure(code, false);
  return new WorkerFailure("FABRIC_GATEWAY_UNAVAILABLE", true);
}

function sameTransferRequest(asset: TransferLedgerAsset, input: TransferRequestInput): boolean {
  return asset.status === "PENDING" && asset.version === 1 &&
    asset.transferId === input.transferId &&
    asset.sourceInstitutionId === input.sourceInstitutionId &&
    asset.destinationInstitutionId === input.destinationInstitutionId &&
    asset.bloodType === input.bloodType && asset.component === input.component &&
    asset.quantity === input.quantity && asset.urgency === input.urgency &&
    asset.requestTime === input.requestTime && asset.actorUserId === input.actorUserId &&
    asset.createdAt === input.eventTime && asset.correlationId === input.correlationId &&
    asset.policyVersion === input.policyVersion && asset.inventoryPolicyVersion === input.inventoryPolicyVersion;
}

function parseTransferAsset(bytes: Uint8Array): TransferLedgerAsset {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as Partial<TransferLedgerAsset>;
  const statuses: TransferStatus[] = ["PENDING","APPROVED","REJECTED","DISPATCHED","IN_TRANSIT","DELAYED","RECEIVED","COMPROMISED","CANCELLED"];
  if (typeof value.transferId !== "string" || typeof value.lastTransactionId !== "string" || !Array.isArray(value.selectedUnitIds) ||
      value.selectedUnitIds.some((unitId) => typeof unitId !== "string") || !statuses.includes(value.status as TransferStatus) || !Number.isSafeInteger(value.version) || Number(value.version) < 1) {
    throw new WorkerFailure("FABRIC_RESPONSE_INVALID", false);
  }
  return value as TransferLedgerAsset;
}

export class FabricGatewayTransfer implements TransferLedger {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  async submitRequest(input: TransferRequestInput): Promise<TransferLedgerResult> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(organizationRoot, "users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(
        this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",
        grpc.credentials.createSsl(tlsRoot),
        { "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" },
      );
      gateway = connect({
        client,
        identity: { mspId: "MediatrixMSP", credentials: certificate },
        signer: signers.newPrivateKeySigner(privateKey),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: deadline(15) }),
        endorseOptions: () => ({ deadline: deadline(30) }),
        submitOptions: () => ({ deadline: deadline(15) }),
        commitStatusOptions: () => ({ deadline: deadline(30) }),
      });
      const contract = gateway.getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev")
        .getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "TransferContract");
      try {
        const existing = parseTransferAsset(await contract.evaluateTransaction("ReadTransfer", input.transferId));
        if (!sameTransferRequest(existing, input)) throw new WorkerFailure("TRF_IDEMPOTENCY_CONFLICT", false);
        return { asset: existing, committedAt: new Date(existing.updatedAt), ledgerReplayed: true };
      } catch (error) {
        const failure = error instanceof WorkerFailure ? error : safeFabricError(error);
        if (failure.code !== "TRF_NOT_FOUND") throw failure;
      }
      const submitted = await contract.submitAsync("SubmitTransferRequest", { arguments: [JSON.stringify(input)] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      const asset = parseTransferAsset(submitted.getResult());
      return { asset, committedAt: new Date(), ledgerReplayed: false };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }

  async approveTransfer(input: TransferApprovalInput): Promise<TransferLedgerResult> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(organizationRoot, "users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(
        this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",
        grpc.credentials.createSsl(tlsRoot),
        { "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" },
      );
      gateway = connect({
        client,
        identity: { mspId: "MediatrixMSP", credentials: certificate },
        signer: signers.newPrivateKeySigner(privateKey),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: deadline(15) }),
        endorseOptions: () => ({ deadline: deadline(30) }),
        submitOptions: () => ({ deadline: deadline(15) }),
        commitStatusOptions: () => ({ deadline: deadline(30) }),
      });
      const contract = gateway.getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev")
        .getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "TransferContract");
      const existing = parseTransferAsset(await contract.evaluateTransaction("ReadTransfer", input.transferId));
      const ledgerReplayed = existing.status === "APPROVED";
      if (!ledgerReplayed && existing.version !== input.expectedVersion) throw new WorkerFailure("TRF_VERSION_CONFLICT", false);
      if (!ledgerReplayed && existing.status !== "PENDING") throw new WorkerFailure("TRF_STATE_INVALID", false);
      const submitted = await contract.submitAsync("ApproveTransfer", { arguments: [JSON.stringify(input)] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      const asset = parseTransferAsset(submitted.getResult());
      const exactUnits = asset.selectedUnitIds.length === input.selectedUnitIds.length &&
        asset.selectedUnitIds.every((unitId,index) => unitId === input.selectedUnitIds[index]);
      if (asset.status !== "APPROVED" || asset.version !== input.expectedVersion + 1 || !exactUnits ||
          asset.actorUserId !== input.actorUserId || asset.updatedAt !== input.eventTime ||
          asset.correlationId !== input.correlationId) {
        throw new WorkerFailure("FABRIC_RESPONSE_INVALID", false);
      }
      return { asset, committedAt: ledgerReplayed ? new Date(asset.updatedAt) : new Date(), ledgerReplayed };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }

  async recordReceipt(input: TransferReceiptInput): Promise<TransferLedgerResult> {
    const repositoryRoot=resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT??process.cwd());
    const organizationRoot=this.environment.FABRIC_ORGANIZATION_ROOT??join(repositoryRoot,"network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot=this.environment.FABRIC_API_MSP_ROOT??join(organizationRoot,"users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath=this.environment.FABRIC_TLS_ROOT??join(organizationRoot,"peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client:grpc.Client|undefined,gateway:ReturnType<typeof connect>|undefined;
    try{
      const certificate=await readFile(await exactlyOneFile(join(mspRoot,"signcerts"))),privateKey=createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot,"keystore")))),tlsRoot=await readFile(tlsRootPath);
      client=new grpc.Client(this.environment.FABRIC_PEER_ENDPOINT??"127.0.0.1:7051",grpc.credentials.createSsl(tlsRoot),{"grpc.ssl_target_name_override":this.environment.FABRIC_PEER_HOST_ALIAS??"peer0.mediatrix.bloodledger.local"});
      gateway=connect({client,identity:{mspId:"MediatrixMSP",credentials:certificate},signer:signers.newPrivateKeySigner(privateKey),hash:hash.sha256,evaluateOptions:()=>({deadline:deadline(15)}),endorseOptions:()=>({deadline:deadline(30)}),submitOptions:()=>({deadline:deadline(15)}),commitStatusOptions:()=>({deadline:deadline(30)})});
      const contract=gateway.getNetwork(this.environment.FABRIC_CHANNEL??"bloodledger-dev").getContract(this.environment.FABRIC_CHAINCODE??"bloodledger-inventory","TransferContract");
      const existing=parseTransferAsset(await contract.evaluateTransaction("ReadTransfer",input.transferId)),ledgerReplayed=existing.status==="RECEIVED";
      if(!ledgerReplayed&&existing.version!==input.expectedVersion)throw new WorkerFailure("TRF_VERSION_CONFLICT",false);
      if(!ledgerReplayed&&!["IN_TRANSIT","DELAYED"].includes(existing.status))throw new WorkerFailure("TRF_STATE_INVALID",false);
      const submitted=await contract.submitAsync("RecordReceipt",{arguments:[JSON.stringify(input)]}),status=await submitted.getStatus();
      if(!status.successful||status.code!==StatusCode.VALID)throw new WorkerFailure("FABRIC_COMMIT_INVALID",false);
      const asset=parseTransferAsset(submitted.getResult()),evidence=asset.receiptEvidence;
      if(asset.status!=="RECEIVED"||asset.version!==input.expectedVersion+1||asset.actorUserId!==input.actorUserId||asset.updatedAt!==input.eventTime||asset.correlationId!==input.correlationId||!evidence||evidence.evidenceId!==input.locationEvidence.evidenceId||evidence.evidenceDigest!==input.locationEvidence.evidenceDigest||evidence.phase!=="RECEIPT"||evidence.capturedAt!==input.locationEvidence.capturedAt||evidence.source!==input.locationEvidence.source||evidence.facilityMatched!==input.locationEvidence.facilityMatched||evidence.fallback!==input.locationEvidence.fallback||evidence.policyVersion!=="SYNTHETIC_LOCATION_V1")throw new WorkerFailure("FABRIC_RESPONSE_INVALID",false);
      return{asset,committedAt:ledgerReplayed?new Date(asset.updatedAt):new Date(),ledgerReplayed};
    }catch(error){if(error instanceof WorkerFailure)throw error;throw safeFabricError(error)}
    finally{gateway?.close();client?.close()}
  }

  async startTransit(input: TransferTransitInput): Promise<TransferLedgerResult> {
    const repositoryRoot=resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT??process.cwd());
    const organizationRoot=this.environment.FABRIC_ORGANIZATION_ROOT??join(repositoryRoot,"network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot=this.environment.FABRIC_API_MSP_ROOT??join(organizationRoot,"users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath=this.environment.FABRIC_TLS_ROOT??join(organizationRoot,"peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client:grpc.Client|undefined,gateway:ReturnType<typeof connect>|undefined;
    try{
      const certificate=await readFile(await exactlyOneFile(join(mspRoot,"signcerts"))),privateKey=createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot,"keystore")))),tlsRoot=await readFile(tlsRootPath);
      client=new grpc.Client(this.environment.FABRIC_PEER_ENDPOINT??"127.0.0.1:7051",grpc.credentials.createSsl(tlsRoot),{"grpc.ssl_target_name_override":this.environment.FABRIC_PEER_HOST_ALIAS??"peer0.mediatrix.bloodledger.local"});
      gateway=connect({client,identity:{mspId:"MediatrixMSP",credentials:certificate},signer:signers.newPrivateKeySigner(privateKey),hash:hash.sha256,evaluateOptions:()=>({deadline:deadline(15)}),endorseOptions:()=>({deadline:deadline(30)}),submitOptions:()=>({deadline:deadline(15)}),commitStatusOptions:()=>({deadline:deadline(30)})});
      const contract=gateway.getNetwork(this.environment.FABRIC_CHANNEL??"bloodledger-dev").getContract(this.environment.FABRIC_CHAINCODE??"bloodledger-inventory","TransferContract");
      const existing=parseTransferAsset(await contract.evaluateTransaction("ReadTransfer",input.transferId)),ledgerReplayed=existing.status==="IN_TRANSIT";
      if(!ledgerReplayed&&existing.version!==input.expectedVersion)throw new WorkerFailure("TRF_VERSION_CONFLICT",false);
      if(!ledgerReplayed&&existing.status!=="DISPATCHED")throw new WorkerFailure("TRF_STATE_INVALID",false);
      const submitted=await contract.submitAsync("StartTransit",{arguments:[JSON.stringify(input)]}),status=await submitted.getStatus();
      if(!status.successful||status.code!==StatusCode.VALID)throw new WorkerFailure("FABRIC_COMMIT_INVALID",false);
      const asset=parseTransferAsset(submitted.getResult());
      if(asset.status!=="IN_TRANSIT"||asset.version!==input.expectedVersion+1||asset.actorUserId!==input.actorUserId||asset.updatedAt!==input.eventTime||asset.correlationId!==input.correlationId)throw new WorkerFailure("FABRIC_RESPONSE_INVALID",false);
      return{asset,committedAt:ledgerReplayed?new Date(asset.updatedAt):new Date(),ledgerReplayed};
    }catch(error){if(error instanceof WorkerFailure)throw error;throw safeFabricError(error)}
    finally{gateway?.close();client?.close()}
  }

  async dispatchTransfer(input: TransferDispatchInput): Promise<TransferLedgerResult> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(organizationRoot, "users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",grpc.credentials.createSsl(tlsRoot),{ "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" });
      gateway = connect({client,identity:{mspId:"MediatrixMSP",credentials:certificate},signer:signers.newPrivateKeySigner(privateKey),hash:hash.sha256,evaluateOptions:()=>({deadline:deadline(15)}),endorseOptions:()=>({deadline:deadline(30)}),submitOptions:()=>({deadline:deadline(15)}),commitStatusOptions:()=>({deadline:deadline(30)})});
      const contract = gateway.getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev").getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "TransferContract");
      const existing = parseTransferAsset(await contract.evaluateTransaction("ReadTransfer", input.transferId));
      const ledgerReplayed = existing.status === "DISPATCHED";
      if (!ledgerReplayed && existing.version !== input.expectedVersion) throw new WorkerFailure("TRF_VERSION_CONFLICT", false);
      if (!ledgerReplayed && existing.status !== "APPROVED") throw new WorkerFailure("TRF_STATE_INVALID", false);
      const submitted = await contract.submitAsync("RecordDispatch", { arguments: [JSON.stringify(input)] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      const asset = parseTransferAsset(submitted.getResult());
      const evidence=asset.dispatchEvidence;
      if (asset.status !== "DISPATCHED" || asset.version !== input.expectedVersion + 1 ||
          asset.actorUserId !== input.actorUserId || asset.updatedAt !== input.eventTime ||
          asset.correlationId !== input.correlationId || !evidence ||
          evidence.evidenceId!==input.locationEvidence.evidenceId ||
          evidence.evidenceDigest!==input.locationEvidence.evidenceDigest ||
          evidence.phase!=="DISPATCH" || evidence.capturedAt!==input.locationEvidence.capturedAt ||
          evidence.source!==input.locationEvidence.source ||
          evidence.facilityMatched!==input.locationEvidence.facilityMatched ||
          evidence.fallback!==input.locationEvidence.fallback ||
          evidence.policyVersion!=="SYNTHETIC_LOCATION_V1") {
        throw new WorkerFailure("FABRIC_RESPONSE_INVALID", false);
      }
      return { asset, committedAt: ledgerReplayed ? new Date(asset.updatedAt) : new Date(), ledgerReplayed };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }

  async cancelTransfer(input: TransferCancellationInput): Promise<TransferLedgerResult> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(organizationRoot, "users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",grpc.credentials.createSsl(tlsRoot),{ "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" });
      gateway = connect({client,identity:{mspId:"MediatrixMSP",credentials:certificate},signer:signers.newPrivateKeySigner(privateKey),hash:hash.sha256,evaluateOptions:()=>({deadline:deadline(15)}),endorseOptions:()=>({deadline:deadline(30)}),submitOptions:()=>({deadline:deadline(15)}),commitStatusOptions:()=>({deadline:deadline(30)})});
      const contract = gateway.getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev").getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "TransferContract");
      const existing = parseTransferAsset(await contract.evaluateTransaction("ReadTransfer", input.transferId));
      const ledgerReplayed = existing.status === "CANCELLED";
      if (!ledgerReplayed && existing.version !== input.expectedVersion) throw new WorkerFailure("TRF_VERSION_CONFLICT", false);
      if (!ledgerReplayed && !["PENDING","APPROVED"].includes(existing.status)) throw new WorkerFailure("TRF_STATE_INVALID", false);
      const submitted = await contract.submitAsync("CancelTransfer", { arguments: [JSON.stringify(input)] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      const asset = parseTransferAsset(submitted.getResult());
      if (asset.status !== "CANCELLED" || asset.version !== input.expectedVersion + 1 ||
          asset.reasonCode !== input.reasonCode || asset.actorUserId !== input.actorUserId ||
          asset.updatedAt !== input.eventTime || asset.correlationId !== input.correlationId) {
        throw new WorkerFailure("FABRIC_RESPONSE_INVALID", false);
      }
      return { asset, committedAt: ledgerReplayed ? new Date(asset.updatedAt) : new Date(), ledgerReplayed };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }

  async rejectTransfer(input: TransferRejectionInput): Promise<TransferLedgerResult> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(organizationRoot, "users/ApiGateway@mediatrix.bloodledger.local/msp");
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(
        this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",
        grpc.credentials.createSsl(tlsRoot),
        { "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" },
      );
      gateway = connect({
        client,
        identity: { mspId: "MediatrixMSP", credentials: certificate },
        signer: signers.newPrivateKeySigner(privateKey),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: deadline(15) }),
        endorseOptions: () => ({ deadline: deadline(30) }),
        submitOptions: () => ({ deadline: deadline(15) }),
        commitStatusOptions: () => ({ deadline: deadline(30) }),
      });
      const contract = gateway.getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev")
        .getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "TransferContract");
      const existing = parseTransferAsset(await contract.evaluateTransaction("ReadTransfer", input.transferId));
      const ledgerReplayed = existing.status === "REJECTED";
      if (!ledgerReplayed && existing.version !== input.expectedVersion) throw new WorkerFailure("TRF_VERSION_CONFLICT", false);
      if (!ledgerReplayed && existing.status !== "PENDING") throw new WorkerFailure("TRF_STATE_INVALID", false);
      const submitted = await contract.submitAsync("RejectTransfer", { arguments: [JSON.stringify(input)] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      const asset = parseTransferAsset(submitted.getResult());
      if (asset.status !== "REJECTED" || asset.version !== input.expectedVersion + 1 ||
          asset.reasonCode !== input.reasonCode || asset.actorUserId !== input.actorUserId ||
          asset.updatedAt !== input.eventTime || asset.correlationId !== input.correlationId) {
        throw new WorkerFailure("FABRIC_RESPONSE_INVALID", false);
      }
      return { asset, committedAt: ledgerReplayed ? new Date(asset.updatedAt) : new Date(), ledgerReplayed };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }
}

export class FabricGatewayInventory implements InventoryLedger {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  async register(event: ScanEvent): Promise<FabricCommit> {
    const repositoryRoot = resolve(this.environment.BLOODLEDGER_REPOSITORY_ROOT ?? process.cwd());
    const organizationRoot = this.environment.FABRIC_ORGANIZATION_ROOT ?? join(
      repositoryRoot,
      "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local",
    );
    const mspRoot = this.environment.FABRIC_API_MSP_ROOT ?? join(
      organizationRoot,
      "users/ApiGateway@mediatrix.bloodledger.local/msp",
    );
    const tlsRootPath = this.environment.FABRIC_TLS_ROOT ?? join(
      organizationRoot,
      "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt",
    );
    let client: grpc.Client | undefined;
    let gateway: ReturnType<typeof connect> | undefined;
    try {
      const certificate = await readFile(await exactlyOneFile(join(mspRoot, "signcerts")));
      const privateKey = createPrivateKey(await readFile(await exactlyOneFile(join(mspRoot, "keystore"))));
      const tlsRoot = await readFile(tlsRootPath);
      client = new grpc.Client(
        this.environment.FABRIC_PEER_ENDPOINT ?? "127.0.0.1:7051",
        grpc.credentials.createSsl(tlsRoot),
        { "grpc.ssl_target_name_override": this.environment.FABRIC_PEER_HOST_ALIAS ?? "peer0.mediatrix.bloodledger.local" },
      );
      const identity: Identity = { mspId: "MediatrixMSP", credentials: certificate };
      gateway = connect({
        client,
        identity,
        signer: signers.newPrivateKeySigner(privateKey),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: deadline(15) }),
        endorseOptions: () => ({ deadline: deadline(30) }),
        submitOptions: () => ({ deadline: deadline(15) }),
        commitStatusOptions: () => ({ deadline: deadline(30) }),
      });
      const contract = gateway
        .getNetwork(this.environment.FABRIC_CHANNEL ?? "bloodledger-dev")
        .getContract(this.environment.FABRIC_CHAINCODE ?? "bloodledger-inventory", "InventoryContract");
      const input = JSON.stringify({
        unitId: event.unit.unitId,
        bloodType: event.unit.bloodType,
        component: event.unit.component,
        collectedAt: event.unit.collectedAt,
        expiresAt: event.unit.expiresAt,
        institutionId: event.institutionId,
        actorUserId: event.actorUserId,
        eventTime: event.confirmedAt,
        correlationId: event.correlationId,
        idempotencyKey: event.idempotencyKey,
        policyVersion: "SYNTHETIC_INVENTORY_V1",
      });
      const submitted = await contract.submitAsync("RegisterBloodUnit", { arguments: [input] });
      const status = await submitted.getStatus();
      if (!status.successful || status.code !== StatusCode.VALID) {
        throw new WorkerFailure("FABRIC_COMMIT_INVALID", false);
      }
      return { transactionId: submitted.getTransactionId(), committedAt: new Date() };
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw safeFabricError(error);
    } finally {
      gateway?.close();
      client?.close();
    }
  }
}
