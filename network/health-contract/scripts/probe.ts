import assert from "node:assert/strict";
import { createPrivateKey } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as grpc from "@grpc/grpc-js";
import {
  type ChaincodeEvent,
  type CloseableAsyncIterable,
  connect,
  hash,
  type Identity,
  signers,
  StatusCode,
} from "@hyperledger/fabric-gateway";

const channelName = "bloodledger-dev";
const chaincodeName = "bloodledger-health";
const contractName = "HealthContract";
const peerName = "peer0.mediatrix.bloodledger.local";
const repositoryRoot = resolve(process.cwd(), "../..");
const organizationRoot = join(repositoryRoot, "network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local");
const adminMsp = join(organizationRoot, "users/Admin@mediatrix.bloodledger.local/msp");
const peerMsp = join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/msp");
const tlsRootPath = join(organizationRoot, "peers/peer0.mediatrix.bloodledger.local/tls/ca.crt");

const probeId = process.argv[2];
if (!probeId) {
  throw new Error("Provide one explicit synthetic probe ID argument");
}
if (!/^[A-Za-z0-9._-]{1,48}$/.test(probeId)) {
  throw new Error("Synthetic probe ID must use 1-48 approved probe ID characters");
}

const deadline = (seconds: number): Date => new Date(Date.now() + seconds * 1000);

async function firstFile(directory: string): Promise<string> {
  const entries = (await readdir(directory)).sort();
  if (entries.length !== 1) throw new Error("Required Fabric identity material is missing or ambiguous");
  return join(directory, entries[0]);
}

async function gatewayFor(mspRoot: string) {
  const certificate = await readFile(await firstFile(join(mspRoot, "signcerts")));
  const privateKey = createPrivateKey(await readFile(await firstFile(join(mspRoot, "keystore"))));
  const tlsRoot = await readFile(tlsRootPath);
  const client = new grpc.Client("127.0.0.1:7051", grpc.credentials.createSsl(tlsRoot), {
    "grpc.ssl_target_name_override": peerName,
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
  return { gateway, client };
}

async function nextWithTimeout(
  events: CloseableAsyncIterable<ChaincodeEvent>,
  timeoutMilliseconds: number,
): Promise<IteratorResult<ChaincodeEvent> | undefined> {
  return Promise.race([
    events[Symbol.asyncIterator]().next(),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMilliseconds)),
  ]);
}

async function main(): Promise<void> {
  const admin = await gatewayFor(adminMsp);
  try {
  const network = admin.gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName, contractName);

  const newEvents = await network.getChaincodeEvents(chaincodeName);
  const newEventPromise = nextWithTimeout(newEvents, 30000);
  const submitted = await contract.submitAsync("RecordProbe", { arguments: [probeId] });
  const transactionId = submitted.getTransactionId();
  const result = Buffer.from(submitted.getResult()).toString("utf8");
  const status = await submitted.getStatus();
  assert.equal(status.code, StatusCode.VALID, "RecordProbe commit status was not VALID");
  assert.equal(status.successful, true, "RecordProbe did not commit successfully");
  assert.equal(status.transactionId, transactionId, "Commit status transaction ID mismatch");
  assert.equal(result, JSON.stringify({ probeId, status: "OK" }), "RecordProbe result mismatch");

  const eventResult = await newEventPromise;
  newEvents.close();
  assert.ok(eventResult && !eventResult.done, "HealthProbeRecorded event was not observed");
  assert.equal(eventResult.value.transactionId, transactionId, "Event transaction ID mismatch");
  assert.equal(eventResult.value.eventName, "HealthProbeRecorded", "Event name mismatch");
  assert.equal(Buffer.from(eventResult.value.payload).toString("utf8"), probeId, "Event payload mismatch");

  const query = Buffer.from(await contract.evaluateTransaction("ReadProbe", probeId)).toString("utf8");
  assert.equal(query, result, "ReadProbe result differs from committed RecordProbe result");

  const duplicateEvents = await network.getChaincodeEvents(chaincodeName);
  const duplicateEventPromise = nextWithTimeout(duplicateEvents, 5000);
  const duplicate = await contract.submitAsync("RecordProbe", { arguments: [probeId] });
  const duplicateResult = Buffer.from(duplicate.getResult()).toString("utf8");
  const duplicateStatus = await duplicate.getStatus();
  assert.equal(duplicateStatus.successful, true, "Duplicate RecordProbe did not commit successfully");
  assert.equal(duplicateResult, result, "Duplicate RecordProbe result changed");
  const possibleDuplicateEvent = await duplicateEventPromise;
  duplicateEvents.close();
  if (possibleDuplicateEvent && !possibleDuplicateEvent.done) {
    assert.notEqual(possibleDuplicateEvent.value.transactionId, duplicate.getTransactionId(), "Duplicate emitted HealthProbeRecorded");
  }
  const duplicateQuery = Buffer.from(await contract.evaluateTransaction("ReadProbe", probeId)).toString("utf8");
  assert.equal(duplicateQuery, result, "Logical state changed after duplicate submission");

  await assert.rejects(
    contract.evaluateTransaction("ReadProbe", `${probeId}-missing`),
    /HEALTH_PROBE_NOT_FOUND/,
    "Missing ReadProbe did not return the stable not-found error",
  );
  await assert.rejects(contract.submitTransaction("RecordProbe"), /arguments|parameter|Expected/i);
  await assert.rejects(contract.submitTransaction("RecordProbe", probeId, "unexpected"), /arguments|parameter|Expected/i);
  await assert.rejects(contract.evaluateTransaction("ReadProbe"), /arguments|parameter|Expected/i);
  await assert.rejects(contract.evaluateTransaction("ReadProbe", probeId, "unexpected"), /arguments|parameter|Expected/i);

  const unauthorized = await gatewayFor(peerMsp);
  try {
    const unauthorizedContract = unauthorized.gateway.getNetwork(channelName).getContract(chaincodeName, contractName);
    await assert.rejects(
      unauthorizedContract.submitTransaction("RecordProbe", `${probeId}-forbidden`),
      /HEALTH_PROBE_FORBIDDEN/,
      "Unauthorized peer identity was not rejected",
    );
  } finally {
    unauthorized.gateway.close();
    unauthorized.client.close();
  }

  console.log(`RecordProbe transaction committed VALID: ${transactionId}`);
  console.log(`HealthProbeRecorded observed with exact payload: ${probeId}`);
  console.log("ReadProbe equality, duplicate idempotency/no-event, not-found, and unauthorized submission checks passed");
  } finally {
    admin.gateway.close();
    admin.client.close();
  }
}

void main();
