// FR-14 / BR-ALG-07: trusted V5 forecast and committed inventory stay independent.
import assert from "node:assert/strict";
import test from "node:test";
import { recommendBroaV5, recommendBroaV5FromStore } from "../src/broa-v5.js";
import { censusProjectionDigest, type CensusV21Snapshot } from "../src/surplus-v21.js";
import { produceSourceSurplusEvidenceV5FromStore, V5_FORECAST_MODEL_SHA256, type ForecastV5Evidence } from "../src/surplus-v5.js";

const evaluationTime = "2026-09-30T04:00:00.000Z";
const snapshotBase = {
  snapshotId: "CENSUS_V5_SYNTH_001", institutionId: "INST_MEDIATRIX",
  scheduledFor: "2026-09-30T01:00:00.000Z", capturedAt: "2026-09-30T01:01:00.000Z",
  timezone: "Asia/Manila" as const, reportPolicyVersion: "INTERVIEW_ML_INVENTORY_SNAPSHOT_V1",
  groups: [{ componentType: "CRYOPRECIPITATE" as const, bloodTypes: [{ bloodType: "A_POSITIVE" as const, availableCount: 30, reservedCount: 0, forecastEligibleAvailableCount: 28, reportableCount: 30 }] }],
};
const snapshot: CensusV21Snapshot = { ...snapshotBase, sourceProjectionDigest: censusProjectionDigest(snapshotBase), classification: "SIMULATION_ONLY" };
const forecast: ForecastV5Evidence = {
  forecastId: `FC_${"A".repeat(40)}`, forecastRunId: `RUN_${"B".repeat(32)}`,
  institutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE",
  originDate: "2026-09-29", horizonDate: "2026-09-30", pointForecast: 4.5,
  forecastStatus: "AVAILABLE", generatedAt: "2026-09-29T12:00:00.000Z",
  datasetVersion: "SYNTHETIC_FORECAST_V5_RUNTIME_V1",
  modelVersion: "bloodledger-v5-series-mean-1.0.0", modelSha256: V5_FORECAST_MODEL_SHA256,
  payloadSha256: "c".repeat(64), runStatus: "COMPLETED", classification: "SIMULATION_ONLY",
  recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
};
const candidates = [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE" as const, componentType: "CRYOPRECIPITATE" as const, urgency: 1, stockShortage: 2, distanceKm: 4, eligible: true }];

function inputs(stock: CensusV21Snapshot | null = snapshot, demand: ForecastV5Evidence | null = forecast) {
  return {
    sourceInstitutionId: "INST_MEDIATRIX", evaluationTime,
    forecastId: forecast.forecastId, inventorySnapshotId: snapshot.snapshotId,
    sourceProjectionDigest: snapshot.sourceProjectionDigest,
    snapshotReader: { async get() { return stock; } },
    forecastReader: { async get() { return demand; } },
  };
}

test("V5 computes simulation surplus from trusted current stock and keeps BROA non-approving", async () => {
  const evidence = await produceSourceSurplusEvidenceV5FromStore(inputs());
  assert.equal(evidence.surplusQuantity, 11);
  assert.equal(evidence.inventoryAsOf, snapshot.capturedAt);
  assert.equal(evidence.modelSha256, V5_FORECAST_MODEL_SHA256);
  const run = recommendBroaV5({ evaluationTime, requiredQuantity: 2, sourceSurplus: evidence, candidates });
  assert.equal(run.automaticApproval, false);
  assert.equal(run.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  const fromStore = await recommendBroaV5FromStore({ ...inputs(), requiredQuantity: 2, candidates });
  assert.equal(fromStore.recommendationDigest, run.recommendationDigest);
});

test("V5 rejects missing, stale and mismatched stock without zero substitution", async () => {
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs(null)), /COORD_V5_EVIDENCE_UNAVAILABLE/);
  const staleBase = { ...snapshotBase, capturedAt: "2026-09-29T12:00:00.000Z" };
  const stale: CensusV21Snapshot = { ...staleBase, sourceProjectionDigest: censusProjectionDigest(staleBase), classification: "SIMULATION_ONLY" };
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs(stale)), /COORD_V5_INVENTORY_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs({ ...snapshot, sourceProjectionDigest: "f".repeat(64) })), /COORD_V5_INVENTORY_INVALID/);
  const zeroBase = { ...snapshotBase, groups: [{ componentType: "CRYOPRECIPITATE" as const, bloodTypes: [{ bloodType: "A_POSITIVE" as const, availableCount: 0, reservedCount: 0, forecastEligibleAvailableCount: 0, reportableCount: 0 }] }] };
  const zero: CensusV21Snapshot = { ...zeroBase, sourceProjectionDigest: censusProjectionDigest(zeroBase), classification: "SIMULATION_ONLY" };
  const result = await produceSourceSurplusEvidenceV5FromStore({ ...inputs(zero), sourceProjectionDigest: zero.sourceProjectionDigest });
  assert.equal(result.surplusQuantity, 0);
  assert.throws(() => recommendBroaV5({ evaluationTime, requiredQuantity: 1, sourceSurplus: result, candidates }), /COORD_BROA_V5_SURPLUS_NOT_ELIGIBLE/);
});

test("V5 rejects unavailable or wrong-version forecast and expired target", async () => {
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs(snapshot, null)), /COORD_V5_EVIDENCE_UNAVAILABLE/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs(snapshot, { ...forecast, forecastStatus: "UNAVAILABLE" })), /COORD_V5_FORECAST_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore(inputs(snapshot, { ...forecast, modelSha256: "f".repeat(64) })), /COORD_V5_FORECAST_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore({ ...inputs(), evaluationTime: "2026-10-01T04:00:00.000Z" }), /COORD_V5_FORECAST_INVALID/);
  await assert.rejects(() => produceSourceSurplusEvidenceV5FromStore({ ...inputs(), sourceInstitutionId: "INST_OTHER" }), /COORD_V5_FORECAST_INVALID/);
});
