import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildApp } from "../../services/api/build/src/app.js";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
import { PostgresMlInventorySnapshotStore } from "../../services/api/build/src/census-worker.js";
import { PostgresV2SourceSurplusEvidenceStore } from "../../services/api/build/src/source-surplus-store.js";
import { recommendBroaV2_1FromStore } from "../../services/coordination/build/src/broa-v21.js";

const institutionId = "INST_MEDIATRIX";
const evaluationTime = "2026-01-07T12:00:00.000Z";
const config = {
  host: "127.0.0.1",
  port: 3000,
  jwtSecret: ["synth", "v4", "verification", "jwt"].join("-"),
  operatorId: "USR_SYNTH_VERIFY",
  operatorCredential: "synthetic-verification-credential",
  workerConfigured: false,
  activeForecastDatasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1",
};

const pool = createPoolFromEnvironment();
const repository = new PostgresScanRepository(pool);
const snapshotStore = new PostgresMlInventorySnapshotStore(pool);
const evidenceStore = new PostgresV2SourceSurplusEvidenceStore(pool);
const app = await buildApp(repository, config, () => new Date(evaluationTime));

try {
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/simulation/session",
    payload: { operatorId: config.operatorId, credential: config.operatorCredential },
  });
  assert.equal(login.statusCode, 200);
  const token = login.json().token;
  const headers = { authorization: `Bearer ${token}` };

  const historicalResponse = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-01-01&datasetVersion=SYNTHETIC_FORECAST_V1", headers });
  assert.equal(historicalResponse.statusCode, 200);
  const historical = historicalResponse.json();
  assert.equal(historical.datasetVersion, "SYNTHETIC_FORECAST_V1");
  assert.equal(historical.forecasts.length, 4);
  assert.ok(historical.forecasts.every((item) => item.runId.startsWith("FRUN_")));

  const absentActiveResponse = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2025-12-31", headers });
  assert.equal(absentActiveResponse.statusCode, 200);
  const absentActive = absentActiveResponse.json();
  assert.equal(absentActive.status, "UNAVAILABLE");
  assert.equal(absentActive.datasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  assert.deepEqual(absentActive.forecasts, []);

  const currentResponse = await app.inject({ method: "GET", url: "/api/v1/demand-forecasts?businessDate=2026-01-08", headers });
  assert.equal(currentResponse.statusCode, 200);
  const current = currentResponse.json();
  assert.equal(current.status, "CURRENT");
  assert.equal(current.forecasts.length, 20);
  assert.ok(current.forecasts.every((item) => item.datasetVersion === "SYNTHETIC_FORECAST_V4_RUNTIME_V1"));
  assert.ok(current.forecasts.every((item) => item.lowerForecast === null && item.upperForecast === null && item.uncertaintyStatus === "UNCERTAINTY_UNAVAILABLE"));
  assert.doesNotMatch(JSON.stringify(current), /Donation No\.?|donationNumber|ocr|patient|donor/i);
  const forecast = current.forecasts.find((item) => item.bloodType === "A_POSITIVE" && item.component === "CRYOPRECIPITATE");
  assert.ok(forecast);

  const snapshot = await snapshotStore.capture(institutionId, new Date("2026-01-07T00:00:00.000Z"), "MANUAL", new Date(evaluationTime));
  assert.equal(snapshot.snapshotKind, "INTERNAL_ML");
  assert.equal(snapshot.groups.length, 5);
  const cryo = snapshot.groups.find((group) => group.componentType === "CRYOPRECIPITATE").bloodTypes.find((item) => item.bloodType === "A_POSITIVE");
  assert.equal(cryo.availableCount, 30);
  assert.equal(cryo.reservedCount, 0);
  assert.equal(cryo.forecastEligibleAvailableCount, 30);
  const persistedSnapshot = await snapshotStore.get(snapshot.snapshotId, institutionId);
  assert.equal(persistedSnapshot.sourceProjectionDigest, snapshot.sourceProjectionDigest);

  // A queued transfer can change both source and destination stock. Snapshot
  // capture must fail closed for either institution until projection commits.
  const pendingPayload = {
    transferId: "TRF_SNAPSHOT_SCOPE_001",
    sourceInstitutionId: institutionId,
    destinationInstitutionId: "INST_METRO_LIPA",
    componentType: "CRYOPRECIPITATE",
    bloodType: "A_POSITIVE",
    quantity: 1,
  };
  await pool.query(
    `INSERT INTO app.v2_commands(
      command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,
      attempt_count,next_attempt_at,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,version,classification
    ) VALUES($1,$2,$3,'TRANSFER',$4,'RESERVE_COMPONENTS',$5,'QUEUED',0,$6,$7,$8,$9,$6,$6,1,'SIMULATION_ONLY')
    ON CONFLICT(command_id) DO UPDATE SET status='QUEUED',payload=EXCLUDED.payload,next_attempt_at=EXCLUDED.next_attempt_at,updated_at=EXCLUDED.updated_at`,
    [
      "CMD_SNAPSHOT_SCOPE_001",
      "IDEM_SNAPSHOT_SCOPE_001",
      "a".repeat(64),
      pendingPayload.transferId,
      pendingPayload,
      evaluationTime,
      "CORR_00000000000000000000000000000009",
      "USR_SYNTH_VERIFY",
      institutionId,
    ],
  );
  await assert.rejects(
    snapshotStore.capture("INST_METRO_LIPA", new Date("2026-01-07T00:00:00.000Z"), "MANUAL", new Date(evaluationTime)),
    /ML_SNAPSHOT_PROJECTION_PENDING/,
  );
  await assert.rejects(
    snapshotStore.capture(institutionId, new Date("2026-01-07T00:00:00.000Z"), "MANUAL", new Date(evaluationTime)),
    /ML_SNAPSHOT_PROJECTION_PENDING/,
  );
  await pool.query("UPDATE app.v2_commands SET status='FAILED',safe_error_code='TEST_COMPLETE',updated_at=$2 WHERE command_id=$1", ["CMD_SNAPSHOT_SCOPE_001", evaluationTime]);
  const destinationSnapshot = await snapshotStore.capture("INST_METRO_LIPA", new Date("2026-01-07T00:00:00.000Z"), "MANUAL", new Date(evaluationTime));
  assert.equal(destinationSnapshot.institutionId, "INST_METRO_LIPA");
  assert.equal(await snapshotStore.get(destinationSnapshot.snapshotId, institutionId), null);

  await pool.query(
    `INSERT INTO app.v2_commands(
      command_id,idempotency_key,payload_sha256,resource_type,resource_id,operation,payload,status,
      attempt_count,next_attempt_at,correlation_id,actor_user_id,actor_institution_id,accepted_at,updated_at,version,classification
    ) VALUES($1,$2,$3,'TRANSFER',$4,'SUBMIT_TRANSFER',$5,'QUEUED',0,$6,$7,$8,$9,$6,$6,1,'SIMULATION_ONLY')`,
    [
      "CMD_SNAPSHOT_SCOPE_002",
      "IDEM_SNAPSHOT_SCOPE_002",
      "b".repeat(64),
      "TRF_SNAPSHOT_SCOPE_002",
      { sourceInstitutionId: institutionId, destinationInstitutionId: null },
      evaluationTime,
      "CORR_0000000000000000000000000000000A",
      "USR_SYNTH_VERIFY",
      institutionId,
    ],
  );
  await assert.rejects(
    snapshotStore.capture(institutionId, new Date("2026-01-08T00:00:00.000Z"), "MANUAL", new Date(evaluationTime)),
    /ML_SNAPSHOT_PROJECTION_SCOPE_UNRESOLVED/,
  );
  await pool.query("UPDATE app.v2_commands SET status='FAILED',safe_error_code='TEST_COMPLETE',updated_at=$2 WHERE command_id=$1", ["CMD_SNAPSHOT_SCOPE_002", evaluationTime]);

  const forecastEvidence = {
    bloodType: forecast.bloodType,
    componentType: forecast.component,
    pointForecast: forecast.pointForecast,
    forecastStatus: forecast.forecastStatus,
    asOf: `${forecast.asOfDate}T11:00:00.000Z`,
    horizonDate: forecast.horizonDate,
    datasetVersion: forecast.datasetVersion,
    forecastRunId: forecast.runId,
    modelVersion: forecast.modelVersion,
  };
  const reader = { get: (snapshotId, sourceInstitutionId) => snapshotStore.get(snapshotId, sourceInstitutionId) };
  const recommendation = await recommendBroaV2_1FromStore({
    sourceInstitutionId: institutionId,
    evaluationTime,
    requiredQuantity: 2,
    inventorySnapshotId: snapshot.snapshotId,
    sourceProjectionDigest: snapshot.sourceProjectionDigest,
    snapshotReader: reader,
    forecast: forecastEvidence,
    candidates: [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: institutionId, bloodType: forecast.bloodType, componentType: forecast.component, urgency: 1, stockShortage: 2, distanceKm: 4, eligible: true }],
  });
  assert.equal(recommendation.automaticApproval, false);
  assert.equal(recommendation.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  assert.equal(recommendation.sourceSurplusEligibility, "ELIGIBLE_GATE");

  const sourceSurplus = (await import("../../services/coordination/build/src/surplus-v21.js")).produceSourceSurplusEvidenceV2_1FromStore({
    sourceInstitutionId: institutionId,
    evaluationTime,
    inventorySnapshotId: snapshot.snapshotId,
    sourceProjectionDigest: snapshot.sourceProjectionDigest,
    snapshotReader: reader,
    forecast: forecastEvidence,
  });
  const saved = await evidenceStore.save(await sourceSurplus);
  assert.equal(saved, "INSERTED");
  assert.equal(await evidenceStore.save(await sourceSurplus), "EXISTING");

  const openapi = JSON.parse(await readFile("services/api/openapi.json", "utf8"));
  assert.equal(openapi.components.schemas.ForecastResponse.properties.forecasts.maxItems, 20);
  assert.equal(openapi.components.schemas.ForecastItem.properties.lowerForecast.type[1], "null");
  console.log("Authenticated HTTP -> persisted V4 forecast -> immutable ML snapshot -> persisted surplus -> BROA boundary passed");
} finally {
  await app.close();
  await pool.end();
}
