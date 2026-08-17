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

function gatewayErrorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);
  const parts: string[] = [];
  if ("message" in error && typeof error.message === "string") parts.push(error.message);
  if ("details" in error && Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (typeof detail === "object" && detail !== null &&
          "message" in detail && typeof detail.message === "string") {
        parts.push(detail.message);
      }
    }
  }
  return parts.join(" ");
}

async function assertGatewayRejects(action: Promise<unknown>, errorCode: string): Promise<void> {
  try {
    await action;
    assert.fail(`Expected Gateway rejection ${errorCode}`);
  } catch (error) {
    assert.match(gatewayErrorText(error), new RegExp(`\\b${errorCode}\\b`));
  }
}

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
    const currentUnitText = Buffer.from(
      await contract.evaluateTransaction("ReadBloodUnit", unitId),
    ).toString("utf8");
    const currentUnit = JSON.parse(currentUnitText);
    if (currentUnit.status === "AVAILABLE") {
      assert.equal(currentUnitText, registration);
    } else {
      assert.equal(currentUnit.status, "EXPIRED");
      assert.equal(currentUnit.version, 2);
      assert.equal(currentUnit.correlationId, `CORR_EXPIRE_${suffix}`);
    }
    assert.equal(
      Buffer.from(await contract.submitTransaction("RegisterBloodUnit", registrationInput)).toString("utf8"),
      registration,
    );
    await assertGatewayRejects(
      contract.submitTransaction("RegisterBloodUnit", JSON.stringify({
        ...JSON.parse(registrationInput),
        correlationId: `CORR_REGISTER_CONFLICT_${suffix}`,
      })),
      "INV_IDEMPOTENCY_CONFLICT",
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

    const transferContract = gateway
      .getNetwork("bloodledger-dev")
      .getContract("bloodledger-inventory", "TransferContract");
    const transferUnitIds = [`UNIT_T1_${suffix}`, `UNIT_T2_${suffix}`];
    for (const [index, transferUnitId] of transferUnitIds.entries()) {
      await contract.submitTransaction("RegisterBloodUnit", JSON.stringify({
        unitId: transferUnitId,
        bloodType: "A_POSITIVE",
        component: "RED_BLOOD_CELLS",
        collectedAt: "2026-08-12T00:00:00.000Z",
        expiresAt: index === 0 ? "2026-08-14T00:00:00.000Z" : "2026-08-15T00:00:00.000Z",
        institutionId: "INST_MEDIATRIX",
        actorUserId: "USR_MEDIATRIX_TECH",
        eventTime: "2026-08-12T01:00:00.000Z",
        correlationId: `CORR_REG_T${index + 1}_${suffix}`,
        idempotencyKey: `IDEM_REG_T${index + 1}_${suffix}`,
        policyVersion: "SYNTHETIC_INVENTORY_V1",
      }));
    }
    const transferId = `TRF_${suffix}`;
    const requestInput = JSON.stringify({
        transferId,
        sourceInstitutionId: "INST_MEDIATRIX",
        destinationInstitutionId: "INST_METRO_LIPA",
        bloodType: "A_POSITIVE",
        component: "RED_BLOOD_CELLS",
        quantity: 2,
        urgency: "URGENT",
        requestTime: "2026-08-13T00:00:00.000Z",
        actorUserId: "USR_METRO_LIPA",
        eventTime: "2026-08-13T00:05:00.000Z",
        correlationId: `CORR_SUBMIT_${suffix}`,
        idempotencyKey: `IDEM_SUBMIT_${suffix}`,
        policyVersion: "SYNTHETIC_TRANSFER_V1",
        inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1",
      });
    const requestedText = Buffer.from(await transferContract.submitTransaction(
      "SubmitTransferRequest",
      requestInput,
    )).toString("utf8");
    const requested = JSON.parse(requestedText);
    assert.equal(requested.status, "PENDING");
    assert.equal(
      Buffer.from(await transferContract.submitTransaction(
        "SubmitTransferRequest",
        requestInput,
      )).toString("utf8"),
      requestedText,
    );
    await assertGatewayRejects(
      transferContract.submitTransaction("SubmitTransferRequest", JSON.stringify({
        ...JSON.parse(requestInput),
        correlationId: `CORR_SUBMIT_CONFLICT_${suffix}`,
      })),
      "TRF_IDEMPOTENCY_CONFLICT",
    );
    const approved = JSON.parse(Buffer.from(await transferContract.submitTransaction(
      "ApproveTransfer",
      JSON.stringify({
        transferId,
        selectedUnitIds: transferUnitIds,
        actorUserId: "USR_MEDIATRIX_ADMIN",
        eventTime: "2026-08-13T00:10:00.000Z",
        expectedVersion: 1,
        correlationId: `CORR_APPROVE_${suffix}`,
        idempotencyKey: `IDEM_APPROVE_${suffix}`,
        policyVersion: "SYNTHETIC_TRANSFER_V1",
        inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1",
      }),
    )).toString("utf8"));
    assert.deepEqual(approved.selectedUnitIds, transferUnitIds);

    await transferContract.submitTransaction("RecordDispatch", JSON.stringify({
      transferId,
      actorUserId: "USR_MEDIATRIX_TECH",
      eventTime: "2026-08-13T00:20:00.000Z",
      expectedVersion: 2,
      correlationId: `CORR_DISPATCH_${suffix}`,
      idempotencyKey: `IDEM_DISPATCH_${suffix}`,
      policyVersion: "SYNTHETIC_TRANSFER_V1",
      locationEvidence: {
        evidenceId: `LOC_DISPATCH_${suffix}`,
        evidenceDigest: "a".repeat(64),
        phase: "DISPATCH",
        capturedAt: "2026-08-13T00:19:00.000Z",
        source: "DEVICE",
        facilityMatched: true,
        fallback: false,
        policyVersion: "SYNTHETIC_LOCATION_V1",
      },
    }));
    await transferContract.submitTransaction("StartTransit", JSON.stringify({
      transferId,
      actorUserId: "USR_MEDIATRIX_TECH",
      eventTime: "2026-08-13T00:30:00.000Z",
      expectedVersion: 3,
      correlationId: `CORR_TRANSIT_${suffix}`,
      idempotencyKey: `IDEM_TRANSIT_${suffix}`,
      policyVersion: "SYNTHETIC_TRANSFER_V1",
    }));
    const receiptInput = JSON.stringify({
        transferId,
        actorUserId: "USR_METRO_LIPA",
        eventTime: "2026-08-13T00:40:00.000Z",
        expectedVersion: 4,
        correlationId: `CORR_RECEIPT_${suffix}`,
        idempotencyKey: `IDEM_RECEIPT_${suffix}`,
        policyVersion: "SYNTHETIC_TRANSFER_V1",
        locationEvidence: {
          evidenceId: `LOC_RECEIPT_${suffix}`,
          evidenceDigest: "b".repeat(64),
          phase: "RECEIPT",
          capturedAt: "2026-08-13T00:39:00.000Z",
          source: "DEVICE",
          facilityMatched: true,
          fallback: false,
          policyVersion: "SYNTHETIC_LOCATION_V1",
        },
      });
    const receivedText = Buffer.from(await transferContract.submitTransaction(
      "RecordReceipt",
      receiptInput,
    )).toString("utf8");
    const received = JSON.parse(receivedText);
    assert.equal(received.status, "RECEIVED");
    assert.equal("latitude" in received.receiptEvidence, false);
    assert.equal(
      Buffer.from(await transferContract.submitTransaction(
        "RecordReceipt",
        receiptInput,
      )).toString("utf8"),
      receivedText,
    );
    await assertGatewayRejects(
      transferContract.submitTransaction("RecordReceipt", JSON.stringify({
        ...JSON.parse(receiptInput),
        correlationId: `CORR_RECEIPT_STALE_${suffix}`,
        idempotencyKey: `IDEM_RECEIPT_STALE_${suffix}`,
      })),
      "TRF_VERSION_CONFLICT",
    );
    assert.equal(
      Buffer.from(await transferContract.evaluateTransaction("ReadTransfer", transferId)).toString("utf8"),
      JSON.stringify(received),
    );
    console.log(
      `Synthetic inventory expiry, transfer receipt, replay, conflict, and stale-state checks passed for ${suffix}`,
    );
  } finally {
    gateway.close();
    client.close();
  }
}

void main();
