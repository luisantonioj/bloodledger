import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildApp } from "../src/app.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

const record: CredentialRecord = {
  userId: "USR_SYNTH_ADMIN",
  username: "synth_admin",
  displayName: "Synthetic Hospital Administrator",
  institutionId: "INST_MEDIATRIX",
  institutionDisplayName: "Synthetic Mediatrix Verification",
  institutionCategory: "HOSPITAL",
  roleId: "ROLE-02",
  saltHex: "0".repeat(32),
  verifierHex: "0".repeat(128),
};

const component = {
  componentId: "COMP_SYNTH_V2_001",
  donationId: "DON_SYNTH_V2_001",
  issuerInstitutionId: "INST_MEDIATRIX",
  componentType: "PACKED_RED_BLOOD_CELLS",
  bloodType: "A_POSITIVE",
  collectedAt: "2026-09-17T00:00:00.000Z",
  expiresAt: "2026-09-30T00:00:00.000Z",
  institutionId: "INST_MEDIATRIX",
  inventoryStatus: "AVAILABLE",
  reservationId: null,
  reservationVersion: null,
  inventoryVersion: 1,
  policyVersion: "INTERVIEW_DERIVED_CORE_V2",
  classification: "SIMULATION_ONLY" as const,
};

test("V2 components response preserves the envelope and excludes exact Donation No. values", async () => {
  const sessions = {
    async findCredential() { return record; },
    async createSession() {},
    async restoreSession() { return record; },
    async revokeSession() {},
  };
  const projection = {
    async listComponents() { return [component]; },
    async getComponent() { return component; },
    async findComponentByIdentity() { return null; },
  };
  const app = await buildApp(new MemoryRepository(), {
    host: "127.0.0.1",
    port: 3000,
    jwtSecret: "v2-contract-boundary-test-secret-that-is-long-enough",
    operatorId: "USR_SYNTH_CAPTURE",
    operatorCredential: "synthetic-test-credential",
    workerConfigured: false,
    webOrigin: "http://127.0.0.1:5174",
  }, () => new Date("2026-09-17T12:00:00.000Z"), sessions, undefined, undefined, {
    store: new InMemoryV2CommandStore(),
    keyring: { encryptionKey: Buffer.alloc(32, 1), lookupKey: Buffer.alloc(32, 2), encryptionKeyVersion: "v1" },
    projection,
  });
  try {
    const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_V2_BOUNDARY", binding: "a".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
    const response = await app.inject({ method: "GET", url: "/api/v2/components", headers: { cookie: `bloodledger_session=${token}` } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(response.json()).sort(), ["classification", "components", "scope"]);
    assert.equal(response.json().scope, "INSTITUTION");
    assert.equal(response.json().classification, "SIMULATION_ONLY");
    assert.doesNotMatch(response.body, /Donation No\.?|donationNumber|ciphertext|authTag|lookupHmac|ocr/i);
  } finally {
    await app.close();
  }
});

test("V2 and V2.1 source-surplus schemas agree on provenance and component boundaries", async () => {
  const v2 = JSON.parse(await readFile("../../contracts/source-surplus-evidence-v2.schema.json", "utf8"));
  const v21 = JSON.parse(await readFile("../../contracts/source-surplus-evidence-v2-1.schema.json", "utf8"));
  for (const schema of [v2, v21]) {
    assert.ok(schema.required.includes("inventorySnapshotId"));
    assert.ok(schema.required.includes("sourceProjectionDigest"));
    assert.equal(schema.properties.classification.const, "SIMULATION_ONLY");
    assert.equal(schema.properties.recommendationEligibility.const, "DISABLED_UNAPPROVED_POLICY");
  }
  assert.ok(!v2.properties.componentType.enum.includes("CRYOPRECIPITATE"));
  assert.ok(v21.properties.componentType.enum.includes("CRYOPRECIPITATE"));
});
