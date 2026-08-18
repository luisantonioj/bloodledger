import { readFile } from "node:fs/promises";

const expected = new Map([
  ["COMPOSE_PROJECT_NAME", "bloodledger"],
  ["FABRIC_CHANNEL_NAME", "bloodledger-dev"],
  ["MEDIATRIX_MSP_ID", "MediatrixMSP"],
  ["ORDERER_MSP_ID", "OrdererMSP"],
  ["FABRIC_PEER_ENDPOINT", "peer0-mediatrix:7051"],
  ["FABRIC_ORDERER_ENDPOINT", "orderer0:7050"],
  ["FABRIC_HEALTH_CHAINCODE_NAME", "bloodledger-health"],
  ["MEDIATRIX_CA_ADMIN_USER", "mediatrix-ca-admin"],
  ["MEDIATRIX_CA_ADMIN_PASSWORD", ""],
  ["ORDERER_CA_ADMIN_USER", "orderer-ca-admin"],
  ["ORDERER_CA_ADMIN_PASSWORD", ""],
  ["POSTGRES_HOST", "postgres"],
  ["POSTGRES_PORT", "5432"],
  ["POSTGRES_DB", "bloodledger_dev"],
  ["POSTGRES_ADMIN_USER", "postgres"],
  ["POSTGRES_ADMIN_PASSWORD", ""],
  ["POSTGRES_MIGRATOR_USER", "bloodledger_migrator"],
  ["POSTGRES_MIGRATOR_PASSWORD", ""],
  ["POSTGRES_APP_USER", "bloodledger_app"],
  ["POSTGRES_APP_PASSWORD", ""],
  ["POSTGRES_HOST_PORT", "5432"],
  ["API_HOST_PORT", "3000"],
  ["SPRINT4_OPERATOR_ID", "USR_SYNTH_CAPTURE"],
  ["SPRINT4_OPERATOR_CREDENTIAL", ""],
  ["SPRINT4_JWT_SECRET", ""]
]);

const source = await readFile(new URL("../../.env.example", import.meta.url), "utf8");
const actual = new Map();
for (const line of source.trimEnd().split("\n")) {
  if (!/^[A-Z][A-Z0-9_]*=.*$/.test(line)) {
    throw new Error(`Unsafe or malformed template line: ${line}`);
  }
  const separator = line.indexOf("=");
  const key = line.slice(0, separator);
  if (actual.has(key)) {
    throw new Error(`Duplicate environment variable: ${key}`);
  }
  actual.set(key, line.slice(separator + 1));
}

if (actual.size !== expected.size) {
  throw new Error(`Expected ${expected.size} approved variables, received ${actual.size}`);
}
for (const [key, value] of expected) {
  assertValue(actual.get(key), value, key);
}

function assertValue(actualValue, expectedValue, key) {
  if (actualValue !== expectedValue) {
    throw new Error(`${key} must use its approved safe value or empty secret placeholder`);
  }
}

console.log(`Safe environment template proven for ${expected.size} approved variables`);
