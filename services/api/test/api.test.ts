import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import type { Principal } from "../src/types.js";
import { fallbackCapture, fixedNow, MemoryRepository } from "./test-support.js";

const config: ApiConfig = {
  host: "127.0.0.1",
  port: 3000,
  jwtSecret: "sprint4-test-secret-that-is-not-deployed",
  operatorId: "USR_SYNTH_CAPTURE",
  operatorCredential: "synthetic-test-credential",
  workerConfigured: false,
};

async function session(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/simulation/session",
    payload: { operatorId: config.operatorId, credential: config.operatorCredential },
  });
  assert.equal(response.statusCode, 200);
  return response.json<{ token: string }>().token;
}

test("PA-S4-02 rejects invalid and unauthenticated requests without disclosure", async () => {
  const app = await buildApp(new MemoryRepository(), config, () => fixedNow);
  const invalid = await app.inject({
    method: "POST",
    url: "/api/v1/simulation/session",
    payload: { operatorId: config.operatorId, credential: "wrong-credential" },
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.json().error.code, "AUTH_FAILED");
  assert.doesNotMatch(invalid.body, /wrong-credential|synthetic-test-credential/);
  const unauthenticated = await app.inject({
    method: "POST",
    url: "/api/v1/scan-events",
    headers: { "idempotency-key": "IDEM_SCAN_API_001" },
    payload: fallbackCapture,
  });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.json().error.code, "AUTH_REQUIRED");
  await app.close();
});

test("FR-13 atomically queues exact captures and replays the same idempotency key", async () => {
  const repository = new MemoryRepository();
  const app = await buildApp(repository, config, () => fixedNow);
  const token = await session(app);
  const request = {
    method: "POST" as const,
    url: "/api/v1/scan-events",
    headers: { authorization: `Bearer ${token}`, "idempotency-key": "IDEM_SCAN_API_001" },
    payload: fallbackCapture,
  };
  const accepted = await app.inject(request);
  const replay = await app.inject(request);
  assert.equal(accepted.statusCode, 202);
  assert.equal(accepted.json().status, "QUEUED");
  assert.equal(accepted.json().replayed, false);
  assert.equal(replay.statusCode, 202);
  assert.equal(replay.json().eventId, accepted.json().eventId);
  assert.equal(replay.json().replayed, true);

  const conflict = await app.inject({ ...request, payload: { ...fallbackCapture, unit: { ...fallbackCapture.unit, unitId: "UNIT_SYNTH_S4_API_002" } } });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "SCAN_IDEMPOTENCY_CONFLICT");
  await app.close();
});

test("FR-01 rejects prohibited fields, low OCR confidence, and wrong session scope", async () => {
  const app = await buildApp(new MemoryRepository(), config, () => fixedNow);
  const token = await session(app);
  const headers = { authorization: `Bearer ${token}`, "idempotency-key": "IDEM_SCAN_API_002" };
  const prohibited = await app.inject({
    method: "POST", url: "/api/v1/scan-events", headers,
    payload: { ...fallbackCapture, patientName: "PROHIBITED" },
  });
  assert.equal(prohibited.statusCode, 400);
  assert.equal(prohibited.json().error.code, "PROHIBITED_FIELD");

  const unconfirmed = await app.inject({
    method: "POST", url: "/api/v1/scan-events", headers,
    payload: Object.fromEntries(Object.entries(fallbackCapture).filter(([key]) => key !== "confirmedAt")),
  });
  assert.equal(unconfirmed.statusCode, 400);
  assert.equal(unconfirmed.json().error.code, "INVALID_CAPTURE_PAYLOAD");

  const futureConfirmation = await app.inject({
    method: "POST", url: "/api/v1/scan-events", headers,
    payload: { ...fallbackCapture, confirmedAt: "2026-08-17T12:01:01.000Z" },
  });
  assert.equal(futureConfirmation.statusCode, 400);
  assert.equal(futureConfirmation.json().error.code, "INVALID_CAPTURE_TIME");

  const lowConfidence = await app.inject({
    method: "POST", url: "/api/v1/scan-events", headers,
    payload: {
      ...fallbackCapture,
      captureMethod: "OCR",
      ocrEvidence: {
        engine: "TESSERACT_JS", engineVersion: "7.0.0",
        fieldConfidence: { unitId: 89, bloodType: 99, component: 99, collectedAt: 99, expiresAt: 99 },
      },
    },
  });
  assert.equal(lowConfidence.statusCode, 400);
  assert.equal(lowConfidence.json().error.code, "LOW_OCR_CONFIDENCE");

  const wrongPrincipal: Principal = { actorUserId: "USR_SYNTH_CAPTURE", institutionId: "INST_MEDIATRIX", role: "INVENTORY_OPERATOR" };
  const wrongRoleToken = app.jwt.sign({ ...wrongPrincipal, role: "SYSTEM_ADMIN" });
  const wrongRole = await app.inject({
    method: "POST", url: "/api/v1/scan-events",
    headers: { authorization: `Bearer ${wrongRoleToken}`, "idempotency-key": "IDEM_SCAN_API_003" },
    payload: fallbackCapture,
  });
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(wrongRole.json().error.code, "AUTH_SCOPE_FORBIDDEN");
  await app.close();
});

test("PA-S4-02 rejects expired and wrong-institution tokens and scopes unknown events", async () => {
  const app = await buildApp(new MemoryRepository(), config, () => fixedNow);
  const principal = {
    actorUserId: "USR_SYNTH_CAPTURE",
    institutionId: "INST_MEDIATRIX",
    role: "INVENTORY_OPERATOR",
  };
  const expiredToken = app.jwt.sign(principal, { expiresIn: -1 });
  const expired = await app.inject({
    method: "GET",
    url: "/api/v1/scan-events/SCAN_0123456789ABCDEF0123456789ABCDEF",
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.json().error.code, "AUTH_REQUIRED");

  const wrongInstitutionToken = app.jwt.sign({ ...principal, institutionId: "INST_UNRELATED" });
  const wrongInstitution = await app.inject({
    method: "GET",
    url: "/api/v1/scan-events/SCAN_0123456789ABCDEF0123456789ABCDEF",
    headers: { authorization: `Bearer ${wrongInstitutionToken}` },
  });
  assert.equal(wrongInstitution.statusCode, 403);
  assert.equal(wrongInstitution.json().error.code, "AUTH_SCOPE_FORBIDDEN");

  const token = await session(app);
  const missing = await app.inject({
    method: "GET",
    url: "/api/v1/scan-events/SCAN_0123456789ABCDEF0123456789ABCDEF",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "SCAN_EVENT_NOT_FOUND");
  await app.close();
});

test("PA-S4-02 honors the validated configured synthetic operator ID", async () => {
  const customConfig = { ...config, operatorId: "USR_SYNTH_CAPTURE_ALT" };
  const app = await buildApp(new MemoryRepository(), customConfig, () => fixedNow);
  const signedIn = await app.inject({
    method: "POST",
    url: "/api/v1/simulation/session",
    payload: { operatorId: customConfig.operatorId, credential: customConfig.operatorCredential },
  });
  assert.equal(signedIn.statusCode, 200);
  const accepted = await app.inject({
    method: "POST",
    url: "/api/v1/scan-events",
    headers: {
      authorization: `Bearer ${signedIn.json<{ token: string }>().token}`,
      "idempotency-key": "IDEM_SCAN_API_CUSTOM_OPERATOR",
    },
    payload: fallbackCapture,
  });
  assert.equal(accepted.statusCode, 202);
  await app.close();
});

test("FR-14 exposes forecast evidence as read-only CURRENT, STALE, or UNAVAILABLE", async () => {
  const repository = new MemoryRepository();
  const app = await buildApp(repository, config, () => fixedNow);
  const token = await session(app);
  const headers = { authorization: `Bearer ${token}` };
  const unavailable = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-01-01", headers });
  assert.equal(unavailable.json().status, "UNAVAILABLE");
  const invalidDate = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-02-30", headers });
  assert.equal(invalidDate.statusCode, 400);
  assert.equal(invalidDate.json().error.code, "INVALID_BUSINESS_DATE");
  repository.forecasts = [{
    runKey: "a".repeat(64), institutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE",
    component: "RED_BLOOD_CELLS", horizonDate: "2026-01-01", pointForecast: 4,
    lowerForecast: 2, upperForecast: 6, classification: "SIMULATION_ONLY",
    recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", generatedAt: fixedNow.toISOString(), stale: false,
  }];
  const current = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-01-01", headers });
  assert.equal(current.json().status, "CURRENT");
  assert.equal(current.json().forecasts[0].recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  repository.forecasts[0].stale = true;
  const stale = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-01-02", headers });
  assert.equal(stale.json().status, "STALE");
  await app.close();
});
