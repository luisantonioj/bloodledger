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
  const code = details.join(" ").match(/\bINV_[A-Z_]+\b/)?.[0];
  if (code) return new WorkerFailure(code, false);
  return new WorkerFailure("FABRIC_GATEWAY_UNAVAILABLE", true);
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
