import assert from "node:assert/strict";
import { createPoolFromEnvironment, PostgresScanRepository } from "../../services/api/build/src/database.js";
import { recommendBroaV2_1 } from "../../services/coordination/build/src/broa-v21.js";
import {
  censusProjectionDigest,
  produceSourceSurplusEvidenceV2_1,
} from "../../services/coordination/build/src/surplus-v21.js";

const pool = createPoolFromEnvironment();
try {
  const repository = new PostgresScanRepository(pool);
  const forecasts = await repository.listForecasts(
    "INST_MEDIATRIX",
    "2026-01-08",
    "SYNTHETIC_FORECAST_V4_RUNTIME_V1",
  );
  const forecast = forecasts.find(
    (row) => row.bloodType === "A_POSITIVE" && row.component === "CRYOPRECIPITATE",
  );
  assert.ok(forecast, "the API must expose the V4 CRYOPRECIPITATE forecast");
  assert.equal(forecast.datasetVersion, "SYNTHETIC_FORECAST_V4_RUNTIME_V1");
  assert.equal(forecast.lowerForecast, null);
  assert.equal(forecast.upperForecast, null);

  const groups = [
    "WHOLE_BLOOD",
    "PACKED_RED_BLOOD_CELLS",
    "FRESH_FROZEN_PLASMA",
    "PLATELETS",
    "CRYOPRECIPITATE",
  ].map((componentType) => ({
    componentType,
    bloodTypes: [
      {
        bloodType: "A_POSITIVE",
        availableCount: 30,
        reservedCount: 5,
        forecastEligibleAvailableCount: 28,
        reportableCount: 35,
      },
    ],
  }));
  const snapshotBase = {
    snapshotId: "CENSUS_V21_API_BROA_001",
    scheduledFor: "2026-01-07T00:00:00.000Z",
    timezone: "Asia/Manila",
    reportPolicyVersion: "INTERVIEW_REPORT_V2_1",
    groups,
  };
  const snapshot = {
    ...snapshotBase,
    sourceProjectionDigest: censusProjectionDigest(snapshotBase),
    classification: "SIMULATION_ONLY",
  };
  const sourceSurplus = produceSourceSurplusEvidenceV2_1({
    sourceInstitutionId: "INST_MEDIATRIX",
    evaluationTime: "2026-01-07T12:00:00.000Z",
    snapshot,
    forecast: {
      bloodType: forecast.bloodType,
      componentType: forecast.component,
      pointForecast: forecast.pointForecast,
      forecastStatus: forecast.forecastStatus,
      asOf: `${forecast.asOfDate}T11:00:00.000Z`,
      horizonDate: forecast.horizonDate,
      modelVersion: forecast.modelVersion,
    },
  });
  assert.equal(sourceSurplus.inventorySnapshotId, snapshot.snapshotId);
  assert.equal(sourceSurplus.sourceProjectionDigest, snapshot.sourceProjectionDigest);
  assert.ok(sourceSurplus.surplusQuantity >= 2);

  const recommendation = recommendBroaV2_1({
    evaluationTime: "2026-01-07T12:00:00.000Z",
    requiredQuantity: 2,
    sourceSurplus,
    candidates: [
      {
        destinationInstitutionId: "INST_METRO_LIPA",
        sourceInstitutionId: "INST_MEDIATRIX",
        bloodType: "A_POSITIVE",
        componentType: "CRYOPRECIPITATE",
        urgency: 1,
        stockShortage: 2,
        distanceKm: 4,
        eligible: true,
      },
    ],
  });
  assert.equal(recommendation.automaticApproval, false);
  assert.equal(recommendation.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  console.log("API -> source-surplus -> BROA V2.1 simulation boundary passed");
} finally {
  await pool.end();
}
