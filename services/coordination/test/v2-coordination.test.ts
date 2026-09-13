import assert from "node:assert/strict";
import test from "node:test";
import { rankRpsV2 } from "../src/rps-v2.js";
import { recommendBroaV2 } from "../src/broa-v2.js";

const evaluationTime = "2026-09-12T00:00:00.000Z";
const surplus = { evidenceId: "SURP_V2_001", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE" as const, componentType: "PACKED_RED_BLOOD_CELLS" as const, surplusQuantity: 5, asOf: "2026-09-11T23:00:00.000Z", horizonDate: "2026-09-13", forecastStatus: "AVAILABLE" as const, modelVersion: "SYNTHETIC_FORECAST_V2", inventorySnapshotId: "CENSUS_V2_001", sourceProjectionDigest: "a".repeat(64), classification: "SIMULATION_ONLY" as const, recommendationEligibility: "DISABLED_UNAPPROVED_POLICY" as const };

test("RPS V2 keeps 70/30 ordering and rejects mixed competition keys", () => {
  const result = rankRpsV2({ evaluationTime, requests: [
    { requestId: "TRF_V2_001", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", urgency: "ROUTINE", requestTime: "2026-09-11T00:00:00.000Z" },
    { requestId: "TRF_V2_002", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", urgency: "CRITICAL", requestTime: "2026-09-11T23:00:00.000Z" },
  ] });
  assert.equal(result.ranked[0]?.requestId, "TRF_V2_002");
  assert.throws(() => rankRpsV2({ evaluationTime, requests: [
    { requestId: "TRF_V2_003", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", urgency: "ROUTINE", requestTime: "2026-09-11T00:00:00.000Z" },
    { requestId: "TRF_V2_004", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PLATELETS", urgency: "ROUTINE", requestTime: "2026-09-11T00:00:00.000Z" },
  ] }), /COORD_RPS_V2_COMPETITION_MISMATCH/);
});

test("BROA V2 gates source surplus and excludes relationship context from scoring", () => {
  const result = recommendBroaV2({ evaluationTime, requiredQuantity: 2, sourceSurplus: surplus, candidates: [
    { destinationInstitutionId: "INST_METRO_LIPA", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", urgency: 10, stockShortage: 4, distanceKm: 20, eligible: true, context: { relationshipClass: "PARTNER", scheduledDonationWindow: null } },
    { destinationInstitutionId: "INST_SAN_ANTONIO", sourceInstitutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", urgency: 8, stockShortage: 6, distanceKm: 10, eligible: true, context: { relationshipClass: "NON_PARTNER", scheduledDonationWindow: null } },
  ] });
  assert.equal(result.automaticApproval, false); assert.equal(result.contextUsedForScoring, false); assert.equal(result.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  assert.throws(() => recommendBroaV2({ evaluationTime, requiredQuantity: 6, sourceSurplus: surplus, candidates: [] }), /COORD_BROA_V2_INPUT_INVALID/);
});
