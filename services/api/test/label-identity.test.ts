import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { encryptDonationNumber, type DonationKeyring } from "../src/donation-crypto.js";
import { resolveLabelIdentity, type SealedDonationNumber } from "../src/label-identity.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

// Synthetic keys and labels only; no real Donation No. values.
const keyring: DonationKeyring = { encryptionKey: Buffer.alloc(32, 7), lookupKey: Buffer.alloc(32, 8), encryptionKeyVersion: "v1" };
const otherKeyring: DonationKeyring = { encryptionKey: Buffer.alloc(32, 9), lookupKey: Buffer.alloc(32, 8), encryptionKeyVersion: "v1" };

function seal(value: string, captureMethod: string | null = "OCR", ring = keyring): SealedDonationNumber {
  const { ciphertext, nonce, authTag, encryptionKeyVersion } = encryptDonationNumber(value, ring);
  return { ciphertext, nonce, authTag, encryptionKeyVersion, captureMethod };
}

test("label identity returns the exact recorded value with provenance (FR-02, LABEL_IDENTITY_READ_V1)", () => {
  const mediatrix = resolveLabelIdentity(seal("MM26-08-0064"), keyring);
  assert.deepEqual(mediatrix, { status: "AVAILABLE", kind: "DONATION_NUMBER", value: "MM26-08-0064", source: "CONFIRMED_OCR_CAPTURE", unavailableReason: null, policyVersion: "LABEL_IDENTITY_READ_V1" });
  // Issuer prefixes, separators and leading zeros are preserved, not reformatted to the Mediatrix pattern.
  assert.equal(resolveLabelIdentity(seal("SYNMEDIX-2026-0007"), keyring).value, "SYNMEDIX-2026-0007");
  assert.equal(resolveLabelIdentity(seal("MM26-08-4064", null), keyring).source, "LEGACY_REGISTRATION");
});

test("label identity failures are unavailable and never invent a value", () => {
  assert.deepEqual(resolveLabelIdentity(undefined, keyring), { status: "UNAVAILABLE", kind: "DONATION_NUMBER", value: null, source: null, unavailableReason: "NOT_RECORDED", policyVersion: "LABEL_IDENTITY_READ_V1" });
  assert.equal(resolveLabelIdentity(seal("MM26-08-4064"), undefined).unavailableReason, "TEMPORARILY_UNAVAILABLE");
  assert.equal(resolveLabelIdentity(seal("MM26-08-4064"), otherKeyring).unavailableReason, "TEMPORARILY_UNAVAILABLE");
  assert.equal(resolveLabelIdentity({ ...seal("MM26-08-4064"), encryptionKeyVersion: "v9" }, keyring).unavailableReason, "TEMPORARILY_UNAVAILABLE");
  assert.equal(resolveLabelIdentity({ ...seal("MM26-08-4064"), authTag: seal("MM26-08-4065").authTag }, keyring).unavailableReason, "TEMPORARILY_UNAVAILABLE");
  assert.equal(resolveLabelIdentity(seal("MM26-08-4064"), keyring, true).unavailableReason, "TEMPORARILY_UNAVAILABLE");
});

function credential(roleId: CredentialRecord["roleId"], institutionId: string): CredentialRecord {
  return { userId: `USR_SYNTH_LABEL_${roleId.replace("-", "")}`, username: "synth_label", displayName: "Synthetic Label Reader", institutionId, institutionDisplayName: "Synthetic Institution", institutionCategory: "HOSPITAL", roleId, saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
}

function component(componentId: string, institutionId: string, componentType: string) {
  return { componentId, donationId: "DON_SYNTH_SHARED_001", issuerInstitutionId: "INST_MEDIATRIX", componentType, bloodType: "O_POSITIVE", collectedAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-10-30T00:00:00.000Z", institutionId, inventoryStatus: "AVAILABLE", reservationId: null, reservationVersion: null, inventoryVersion: 3, policyVersion: "INTERVIEW_DERIVED_CORE_V2", classification: "SIMULATION_ONLY" as const };
}

// Two components share one synthetic donation at Mediatrix; a third is held by another institution.
const components = [component("COMP_SYNTH_LABEL_PRBC", "INST_MEDIATRIX", "PACKED_RED_BLOOD_CELLS"), component("COMP_SYNTH_LABEL_FFP", "INST_MEDIATRIX", "FRESH_FROZEN_PLASMA"), component("COMP_SYNTH_LABEL_OTHER", "INST_SYNTH_SECONDARY_01", "PLATELETS")];
const sealedByComponent = new Map([["COMP_SYNTH_LABEL_PRBC", seal("MM26-08-4064")], ["COMP_SYNTH_LABEL_FFP", seal("MM26-08-4064")], ["COMP_SYNTH_LABEL_OTHER", seal("MM26-08-4099")]]);

async function labelApp(record: CredentialRecord, options: { failSealedRead?: boolean; keyring?: DonationKeyring } = {}) {
  const sealedCalls: Array<{ componentIds: readonly string[]; institutionId: string }> = [];
  const projection = {
    async listComponents(institutionId: string) { return components.filter((item) => item.institutionId === institutionId); },
    async getComponent(componentId: string, institutionId: string) { return components.find((item) => item.componentId === componentId && item.institutionId === institutionId) ?? null; },
    async findComponentByIdentity() { return null; },
    // Mirrors the SQL scope: only components the institution currently holds.
    async listSealedDonationNumbers(componentIds: readonly string[], institutionId: string) {
      sealedCalls.push({ componentIds, institutionId });
      if (options.failSealedRead) throw new Error("synthetic read failure");
      return new Map(componentIds.filter((id) => components.some((item) => item.componentId === id && item.institutionId === institutionId) && sealedByComponent.has(id)).map((id) => [id, sealedByComponent.get(id)!]));
    },
  };
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "label-identity-test-secret-long-enough", operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: "http://127.0.0.1:5174" },
    () => new Date("2026-10-15T00:00:00.000Z"), sessions, undefined, undefined, { store: new InMemoryV2CommandStore(), keyring: "keyring" in options ? options.keyring : keyring, projection });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_LABEL", binding: "d".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  return { app, sealedCalls, headers: { cookie: `bloodledger_session=${token}`, "x-bloodledger-contract-version": "V2.1" } };
}

test("component list and detail return the custody-scoped label identity separately from opaque IDs", async () => {
  const { app, sealedCalls, headers } = await labelApp(credential("ROLE-01", "INST_MEDIATRIX"));
  try {
    const list = await app.inject({ method: "GET", url: "/api/v2/components", headers });
    assert.equal(list.statusCode, 200);
    const rows = list.json().components as Array<Record<string, unknown> & { labelIdentity: { value: string | null; status: string } }>;
    assert.deepEqual(rows.map((row) => row.componentId).sort(), ["COMP_SYNTH_LABEL_FFP", "COMP_SYNTH_LABEL_PRBC"]);
    // Shared-donation rows share the printed value but keep distinct component IDs, types and versions.
    assert.deepEqual(rows.map((row) => row.labelIdentity.value), ["MM26-08-4064", "MM26-08-4064"]);
    assert.notEqual(rows[0].componentType, rows[1].componentType);
    assert.ok(rows.every((row) => row.donationId === "DON_SYNTH_SHARED_001" && row.inventoryVersion === 3));
    assert.deepEqual(sealedCalls.map((call) => call.institutionId), ["INST_MEDIATRIX"]);
    assert.doesNotMatch(list.body, /MM26-08-4099|ciphertext|authTag|nonce|lookupHmac|encryptionKey/i);

    const detail = await app.inject({ method: "GET", url: "/api/v2/components/COMP_SYNTH_LABEL_FFP", headers });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().componentId, "COMP_SYNTH_LABEL_FFP");
    assert.equal(detail.json().labelIdentity.value, "MM26-08-4064");
    assert.equal(detail.json().labelIdentity.source, "CONFIRMED_OCR_CAPTURE");

    const otherInstitution = await app.inject({ method: "GET", url: "/api/v2/components/COMP_SYNTH_LABEL_OTHER", headers });
    assert.equal(otherInstitution.statusCode, 404);
    assert.doesNotMatch(otherInstitution.body, /MM26-08-4099/);
  } finally { await app.close(); }
});

test("regulatory readers cannot obtain component labels", async () => {
  const { app, sealedCalls, headers } = await labelApp(credential("ROLE-04", "INST_MEDIATRIX"));
  try {
    for (const url of ["/api/v2/components", "/api/v2/components/COMP_SYNTH_LABEL_PRBC"]) {
      const response = await app.inject({ method: "GET", url, headers });
      assert.equal(response.statusCode, 403);
      assert.doesNotMatch(response.body, /MM26-08-/);
    }
    assert.equal(sealedCalls.length, 0);
  } finally { await app.close(); }
});

test("missing keys or a failed sealed read keep inventory readable with an unavailable label", async () => {
  for (const options of [{ keyring: undefined }, { failSealedRead: true }]) {
    const { app, headers } = await labelApp(credential("ROLE-02", "INST_MEDIATRIX"), options);
    try {
      const list = await app.inject({ method: "GET", url: "/api/v2/components", headers });
      assert.equal(list.statusCode, 200);
      for (const row of list.json().components) assert.deepEqual(row.labelIdentity, { status: "UNAVAILABLE", kind: "DONATION_NUMBER", value: null, source: null, unavailableReason: "TEMPORARILY_UNAVAILABLE", policyVersion: "LABEL_IDENTITY_READ_V1" });
      assert.doesNotMatch(list.body, /synthetic read failure|MM26-08-/);
    } finally { await app.close(); }
  }
});
