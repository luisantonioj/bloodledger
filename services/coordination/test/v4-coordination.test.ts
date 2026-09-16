import assert from "node:assert/strict";
import test from "node:test";
import { recommendBroaV2_1 } from "../src/broa-v21.js";
import { censusProjectionDigest, produceSourceSurplusEvidenceV2_1, type CensusV21Snapshot } from "../src/surplus-v21.js";

const groups = ["WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE"].map((componentType) => ({ componentType: componentType as never, bloodTypes: [{ bloodType: "A_POSITIVE" as const, availableCount: 30, reservedCount: 5, forecastEligibleAvailableCount: 28, reportableCount: 35 }] }));
const snapshotBase = { snapshotId: "CENSUS_V21_001", scheduledFor: "2026-09-17T00:00:00.000Z", timezone: "Asia/Manila" as const, reportPolicyVersion: "INTERVIEW_REPORT_V2_1", groups };
const snapshot: CensusV21Snapshot = { ...snapshotBase, sourceProjectionDigest: censusProjectionDigest(snapshotBase), classification: "SIMULATION_ONLY" };

test("V2.1 surplus uses only forecast-eligible available stock and CRYOPRECIPITATE", () => {
  const evidence = produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot, forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4.5, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", modelVersion: "bloodledger-weighted-average-7-1.0.0" } });
  assert.equal(evidence.surplusQuantity, 11);
  assert.equal(evidence.inventorySnapshotId, snapshot.snapshotId);
  const result = recommendBroaV2_1({ evaluationTime: "2026-09-17T12:00:00.000Z", requiredQuantity: 2, sourceSurplus: evidence, candidates: [{ destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", urgency: 1, stockShortage: 2, distanceKm: 4, eligible: true }] });
  assert.equal(result.automaticApproval, false);
  assert.equal(result.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
});

test("V2.1 rejects an altered committed projection digest", () => {
  assert.throws(() => produceSourceSurplusEvidenceV2_1({ sourceInstitutionId: "INST_MEDIATRIX", evaluationTime: "2026-09-17T12:00:00.000Z", snapshot: { ...snapshot, sourceProjectionDigest: "f".repeat(64) }, forecast: { bloodType: "A_POSITIVE", componentType: "CRYOPRECIPITATE", pointForecast: 4, forecastStatus: "AVAILABLE", asOf: "2026-09-17T11:00:00.000Z", horizonDate: "2026-09-18", modelVersion: "v4" } }), /COORD_V2_1_SOURCE_PROJECTION_MISMATCH/);
});
