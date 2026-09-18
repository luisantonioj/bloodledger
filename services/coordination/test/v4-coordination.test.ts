import assert from "node:assert/strict";
import test from "node:test";
import { recommendBroaV2_1 } from "../src/broa-v21.js";
import { censusProjectionDigest, produceSourceSurplusEvidenceV2_1, produceSourceSurplusEvidenceV2_1FromStore, type CensusV21Snapshot } from "../src/surplus-v21.js";

const groups = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"].map((componentType) => ({ componentType: componentType as never, bloodTypes: [{ bloodType: "A_POSITIVE" as const, availableCount: 30, reservedCount: 5, forecastEligibleAvailableCount: 28, reportableCount: 35 }] }));
const snapshotBase = { snapshotId: "CENSUS_V21_001", institutionId: "INST_MEDIATRIX", scheduledFor: "2026-09-17T00:00:00.000Z", timezone: "Asia/Manila" as const, reportPolicyVersion: "INTERVIEW_REPORT_V2_1", groups };
const snapshot: CensusV21Snapshot = { ...snapshotBase, sourceProjectionDigest: censusProjectionDigest(snapshotBase), classification: "SIMULATION_ONLY" };

test("V2.1 surplus uses only forecast-eligible available stock and CRYOPRECIPITATE", () => {
  const evidence = produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4.5, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1", forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "bloodledger-weighted-average-7-1.0.0" } });
  assert.equal(evidence.surplusQuantity, 11);
  assert.equal(evidence.inventorySnapshotId, snapshot.snapshotId);
  const result = recommendBroaV2_1({ evaluationTime: "2026-09-17T12:00:00.000Z", requiredQuantity: 2, sourceSurplus: evidence, candidates: [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", urgency: 1, stockShortage: 2, distanceKm: 4, eligible: true }] });
  assert.equal(result.automaticApproval, false);
  assert.equal(result.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
});

test("V2.1 rejects an altered committed projection digest", () => {
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot: { ...snapshot, sourceProjectionDigest: "f".repeat(64) }, forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1", forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "v4" } }), /COORD_V2_1_SOURCE_PROJECTION_MISMATCH/);
});

test("V2.1 surplus resolves the snapshot through an institution-scoped reader", async () => {
  let reads = 0;
  const evidence = await produceSourceSurplusEvidenceV2_1FromStore({
    sourceInstitutionId: "INST_MEDIATRIX",
    evaluationTime: "2026-09-17T12:00:00.000Z",
    inventorySnapshotId: snapshot.snapshotId,
    sourceProjectionDigest: snapshot.sourceProjectionDigest,
    snapshotReader: { async get(snapshotId, institutionId) { reads += 1; assert.equal(snapshotId, snapshot.snapshotId); assert.equal(institutionId, "INST_MEDIATRIX"); return snapshot; } },
    forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1", forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "v4" },
  });
  assert.equal(reads, 1);
  assert.equal(evidence.configurationSha256.length, 64);
  await assert.rejects(() => produceSourceSurplusEvidenceV2_1FromStore({ sourceInstitutionId: "INST_OTHER", evaluationTime: "2026-09-17T12:00:00.000Z", inventorySnapshotId: snapshot.snapshotId, sourceProjectionDigest: snapshot.sourceProjectionDigest, snapshotReader: { async get() { return snapshot; } }, forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1", forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "v4" } }), /COORD_V2_1_TRUSTED_SNAPSHOT_MISMATCH/);
});

test("V2.1 rejects missing, malformed, future, stale, and wrong-horizon forecast evidence", () => {
  const baseForecast = { bloodType: "A_POSITIVE" as const, componentType: "CRYOPRECIPITATE" as const, pointForecast: 4, forecastStatus: "AVAILABLE" as const, asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1" as const, forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "v4" };
  const valid = produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: baseForecast });
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { ...baseForecast, asOf: "invalid" } }), /COORD_V2_1_FRESHNESS_INVALID/);
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { ...baseForecast, asOf: "2026-09-17T13:00:00.000Z" } }), /COORD_V2_1_FRESHNESS_INVALID/);
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { ...baseForecast, horizonDate: "2026-09-17" } }), /COORD_V2_1_FRESHNESS_INVALID/);
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { ...baseForecast, forecastStatus: "UNAVAILABLE" } }), /COORD_V2_1_SOURCE_PROJECTION_MISMATCH/);
  assert.throws(() => recommendBroaV2_1({ evaluationTime: "2026-09-17T12:00:00.000Z", requiredQuantity: 1, sourceSurplus: { ...valid, horizonDate: "2026-09-17" }, candidates: [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", urgency: 1, stockShortage: 1, distanceKm: 1, eligible: true }] }), /COORD_BROA_V2_1_FRESHNESS_INVALID/);
});

test("V2.1 uses the next Asia/Manila calendar date at midnight boundaries", () => {
  const forecast = { bloodType: "A_POSITIVE" as const, componentType: "CRYOPRECIPITATE" as const, pointForecast: 4, forecastStatus: "AVAILABLE" as const, asOf: "2026-09-16T15:59:59.000Z", horizonDate: "2026-09-17", datasetVersion: "SYNTHETIC_FORECAST_V4_RUNTIME_V1" as const, forecastRunId: "RUN_0123456789ABCDEF0123456789ABCDEF", modelVersion: "v4" };
  assert.doesNotThrow(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-16T15:59:59.000Z", snapshot: { ...snapshot, scheduledFor: "2026-09-16T00:00:00.000Z", sourceProjectionDigest: censusProjectionDigest({ ...snapshotBase, scheduledFor: "2026-09-16T00:00:00.000Z" }) }, forecast }));
  assert.doesNotThrow(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-16T16:00:00.000Z", snapshot: { ...snapshot, scheduledFor: "2026-09-16T16:00:00.000Z", sourceProjectionDigest: censusProjectionDigest({ ...snapshotBase, scheduledFor: "2026-09-16T16:00:00.000Z" }) }, forecast: { ...forecast, asOf: "2026-09-16T16:00:00.000Z", horizonDate: "2026-09-18" } }));
});
