import assert from "node:assert/strict";
import { createPrivateKey } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as grpc from "@grpc/grpc-js";
import { connect, hash, type Identity, signers, StatusCode } from "@hyperledger/fabric-gateway";

const suffix = process.argv[2];
if (!suffix || !/^[A-Z0-9_-]{1,24}$/.test(suffix)) {
  throw new Error("Provide one unique 1-24 character uppercase synthetic validation suffix");
}

const repositoryRoot = resolve(process.cwd(), "..");
const organizationRoot = join(
  repositoryRoot,
  "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local",
);
const apiGatewayMsp = join(
  organizationRoot,
  "users/ApiGateway@mediatrix.bloodledger.local/msp",
);
const tlsRootPath = join(
  organizationRoot,
  "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt",
);

const deadline = (seconds: number): Date => new Date(Date.now() + seconds * 1000);

async function firstFile(directory: string): Promise<string> {
  const entries = (await readdir(directory)).sort();
  if (entries.length !== 1) {
    throw new Error("Required Fabric identity material is missing or ambiguous");
  }
  return join(directory, entries[0]);
}

async function main(): Promise<void> {
  const certificate = await readFile(await firstFile(join(apiGatewayMsp, "signcerts")));
  const privateKey = createPrivateKey(await readFile(await firstFile(join(apiGatewayMsp, "keystore"))));
  const tlsRoot = await readFile(tlsRootPath);
  const client = new grpc.Client("127.0.0.1:7051", grpc.credentials.createSsl(tlsRoot), {
    "grpc.ssl_target_name_override": "peer0.mediatrix.bloodledger.local",
  });
  const identity: Identity = { mspId: "MediatrixMSP", credentials: certificate };
  const gateway = connect({
    client,
    identity,
    signer: signers.newPrivateKeySigner(privateKey),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: deadline(15) }),
    endorseOptions: () => ({ deadline: deadline(30) }),
    submitOptions: () => ({ deadline: deadline(15) }),
    commitStatusOptions: () => ({ deadline: deadline(30) }),
  });

  try {
    const contract = gateway
      .getNetwork("bloodledger-dev")
      .getContract("bloodledger-inventory", "InventoryContract");
    const unitId = `UNIT_${suffix}`;
    const registrationInput = JSON.stringify({
      unitId,
      bloodType: "A_POSITIVE",
      component: "RED_BLOOD_CELLS",
      collectedAt: "2026-07-30T00:00:00.000Z",
      expiresAt: "2026-08-02T00:00:00.000Z",
      institutionId: "INST_MEDIATRIX",
      actorUserId: "USR_SYNTH_VALIDATOR",
      eventTime: "2026-07-30T01:00:00.000Z",
      correlationId: `CORR_REGISTER_${suffix}`,
      idempotencyKey: `IDEM_REGISTER_${suffix}`,
      policyVersion: "SYNTHETIC_INVENTORY_V1",
    });
    const submitted = await contract.submitAsync("RegisterBloodUnit", {
      arguments: [registrationInput],
    });
    const registration = Buffer.from(submitted.getResult()).toString("utf8");
    const status = await submitted.getStatus();
    assert.equal(status.code, StatusCode.VALID);
    assert.equal(status.successful, true);
    assert.equal(
      Buffer.from(await contract.evaluateTransaction("ReadBloodUnit", unitId)).toString("utf8"),
      registration,
    );

    const evaluationInput = JSON.stringify({
      unitId,
      institutionId: "INST_MEDIATRIX",
      actorUserId: "USR_SYNTH_VALIDATOR",
      evaluationTime: "2026-08-02T00:00:00.000Z",
      expectedVersion: 1,
      correlationId: `CORR_EXPIRE_${suffix}`,
      idempotencyKey: `IDEM_EXPIRE_${suffix}`,
      policyVersion: "SYNTHETIC_INVENTORY_V1",
    });
    const expiry = JSON.parse(Buffer.from(
      await contract.submitTransaction("EvaluateBloodUnitExpiry", evaluationInput),
    ).toString("utf8"));
    assert.equal(expiry.result, "EXPIRED");
    assert.equal(expiry.asset.status, "EXPIRED");
    assert.equal(expiry.asset.version, 2);
    console.log(`Synthetic inventory registration and expiry committed VALID for ${unitId}`);
  } finally {
    gateway.close();
    client.close();
  }
}

void main();
