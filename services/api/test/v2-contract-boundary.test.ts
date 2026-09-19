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

const reservation = {
  reservationId: "RES_SYNTH_V2_001",
  purpose: "TRANSFER" as const,
  status: "ACTIVE",
  version: 1,
  sourceInstitutionId: "INST_MEDIATRIX",
  destinationInstitutionId: "INST_SYNTH_SECONDARY_01",
  transferId: "TRF_SYNTH_V2_001",
  localReleaseId: null,
  preparedAt: null,
  preparedEvidencePresent: false,
  updatedAt: "2026-09-17T12:00:00.000Z",
  components: [{ componentId: component.componentId, componentType: component.componentType, inventoryStatus: "RESERVED", inventoryVersion: 2 }],
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

test("S6 reservation reads and actions use committed role-scoped projections", async () => {
  const sessions = {
    async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {},
  };
  const projection = {
    async listComponents() { return [component]; }, async getComponent() { return component; }, async findComponentByIdentity() { return null; },
    async listReservations(institutionId: string, roleId: string, limit: number, cursor?: string) {
      assert.equal(institutionId, "INST_MEDIATRIX"); assert.equal(roleId, "ROLE-02"); assert.equal(limit, 50); assert.equal(cursor, undefined);
      return { reservations: [reservation], nextCursor: null };
    },
    async getReservation(reservationId: string, institutionId: string, roleId: string) {
      return reservationId === reservation.reservationId && institutionId === "INST_MEDIATRIX" && roleId === "ROLE-02" ? reservation : null;
    },
  };
  const app = await buildApp(new MemoryRepository(), {
    host:"127.0.0.1",port:3000,jwtSecret:"v2-reservation-test-secret-that-is-long-enough",operatorId:"USR_SYNTH_CAPTURE",operatorCredential:"synthetic-test-credential",workerConfigured:false,webOrigin:"http://127.0.0.1:5174",
  },()=>new Date("2026-09-17T12:00:00.000Z"),sessions,undefined,undefined,{store:new InMemoryV2CommandStore(),projection});
  const token=app.jwt.sign({userId:record.userId,institutionId:record.institutionId,roleId:record.roleId,sessionId:"SESS_SYNTH_RESERVATION",binding:"b".repeat(64),policyVersion:"SYNTHETIC_WEB_ACCESS_V1"});
  const headers={cookie:`bloodledger_session=${token}`};
  try {
    const list=await app.inject({method:"GET",url:"/api/v2/reservations",headers});
    assert.equal(list.statusCode,200); assert.equal(list.json().scope,"SOURCE_INSTITUTION"); assert.equal(list.json().reservations[0].version,1); assert.doesNotMatch(list.body,/donation|ciphertext|lookupHmac/i);
    const detail=await app.inject({method:"GET",url:`/api/v2/reservations/${reservation.reservationId}`,headers});
    assert.equal(detail.statusCode,200); assert.equal(detail.json().components[0].componentId,component.componentId);
    const invalidPage=await app.inject({method:"GET",url:"/api/v2/reservations?limit=101",headers}); assert.equal(invalidPage.statusCode,400);
    const action=await app.inject({method:"POST",url:`/api/v2/reservations/${reservation.reservationId}/cancel`,headers:{...headers,origin:"http://127.0.0.1:5174","idempotency-key":"IDEM_RESERVATION_CANCEL_001"},payload:{correlationId:"CORR_0123456789ABCDEF0123456789ABCDEF",eventTime:"2026-09-17T12:00:00.000Z",expectedVersion:1}});
    assert.equal(action.statusCode,202);
  } finally { await app.close(); }
});

test("S6 reconciliation exposes and enforces the versioned reason policy", async () => {
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const store = new InMemoryV2CommandStore();
  const app = await buildApp(new MemoryRepository(), {
    host:"127.0.0.1",port:3000,jwtSecret:"v2-reconciliation-test-secret-long-enough",operatorId:"USR_SYNTH_CAPTURE",operatorCredential:"synthetic-test-credential",workerConfigured:false,webOrigin:"http://127.0.0.1:5174",
  },()=>new Date("2026-09-17T12:00:00.000Z"),sessions,undefined,undefined,{store});
  const token=app.jwt.sign({userId:record.userId,institutionId:record.institutionId,roleId:record.roleId,sessionId:"SESS_SYNTH_RECONCILIATION",binding:"c".repeat(64),policyVersion:"SYNTHETIC_WEB_ACCESS_V1"});
  const headers={cookie:`bloodledger_session=${token}`,origin:"http://127.0.0.1:5174","idempotency-key":"IDEM_RECONCILIATION_001"};
  try {
    const policy=await app.inject({method:"GET",url:"/api/v2/reconciliation/reasons",headers});
    assert.equal(policy.statusCode,200); assert.equal(policy.json().policyVersion,"SYNTHETIC_RECONCILIATION_REASONS_V1"); assert.equal(policy.json().reasons.length,7); assert.equal(policy.json().freeTextAllowed,false);
    const base={caseId:"RECON_SYNTH_001",componentId:"COMP_SYNTH_V2_001",correlationId:"CORR_0123456789ABCDEF0123456789ABCDEF"};
    const invalid=await app.inject({method:"POST",url:"/api/v2/reconciliation",headers,payload:{...base,reasonCode:"FREE_TEXT"}}); assert.equal(invalid.statusCode,400); assert.equal(invalid.json().error.code,"RECONCILIATION_REASON_INVALID");
    const accepted=await app.inject({method:"POST",url:"/api/v2/reconciliation",headers,payload:{...base,reasonCode:"STATUS_MISMATCH"}}); assert.equal(accepted.statusCode,202);
    const command=await store.get(accepted.json().commandId,"INST_MEDIATRIX","ROLE-02"); assert.equal(command?.payload.reconciliationPolicyVersion,"SYNTHETIC_RECONCILIATION_REASONS_V1");
  } finally { await app.close(); }
});

test("S6 census discovery exposes safe metadata while full export remains gated", async () => {
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const census = {
    async capture() { throw new Error("DISABLED_UNAPPROVED_REPORT_FORMAT"); }, async get() { return null; }, async copyRow() { return null; },
    async list(institutionId: string | undefined, limit: number, cursor?: string) {
      assert.equal(institutionId,"INST_MEDIATRIX"); assert.equal(limit,50); assert.equal(cursor,undefined);
      return { snapshots:[{snapshotId:"CENSUS_SYNTH_001",institutionId:"INST_MEDIATRIX",scheduledFor:"2026-09-19T01:00:00.000Z",capturedAt:"2026-09-19T01:01:00.000Z",reportPolicyVersion:"INTERVIEW_REPORT_PENDING",triggerType:"SCHEDULED",classification:"SIMULATION_ONLY" as const}],nextCursor:null,exportAvailable:false };
    },
  };
  const app=await buildApp(new MemoryRepository(),{host:"127.0.0.1",port:3000,jwtSecret:"v2-census-test-secret-that-is-long-enough",operatorId:"USR_SYNTH_CAPTURE",operatorCredential:"synthetic-test-credential",workerConfigured:false,webOrigin:"http://127.0.0.1:5174"},()=>new Date("2026-09-19T12:00:00.000Z"),sessions,undefined,undefined,{store:new InMemoryV2CommandStore(),census});
  const token=app.jwt.sign({userId:record.userId,institutionId:record.institutionId,roleId:record.roleId,sessionId:"SESS_SYNTH_CENSUS",binding:"d".repeat(64),policyVersion:"SYNTHETIC_WEB_ACCESS_V1"});
  try {
    const response=await app.inject({method:"GET",url:"/api/v2/reports/doh-census",headers:{cookie:`bloodledger_session=${token}`}});
    assert.equal(response.statusCode,200); assert.equal(response.json().displayPolicyVersion,"DOH_CENSUS_COLUMN_ORDER_V1"); assert.deepEqual(response.json().displayBloodTypeOrder,["O_POSITIVE","A_POSITIVE","B_POSITIVE","AB_POSITIVE","O_NEGATIVE","A_NEGATIVE","B_NEGATIVE","AB_NEGATIVE"]); assert.equal(response.json().totalColumn,"CALCULATED"); assert.equal(response.json().reportAvailability,"EXPORT_DISABLED_PENDING_FORMAT");
  } finally { await app.close(); }
});
