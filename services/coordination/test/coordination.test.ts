import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendBroa } from "../src/broa.js";
import { CoordinationError } from "../src/errors.js";
import { captureLocationEvidence } from "../src/location.js";
import { validatePolicies } from "../src/policies.js";
import { rankRps } from "../src/rps.js";

function errorCode(action: () => unknown): string | undefined {
  try { action(); } catch (error) {
    return error instanceof CoordinationError ? error.code : undefined;
  }
  return undefined;
}

test("S3-08 validates the two versioned synthetic policies", () => {
  assert.doesNotThrow(validatePolicies);
});

test("S3-08 captures deterministic dispatch evidence and an on-chain-safe summary", () => {
  const input = {
    evidenceId: "LOC_DISPATCH_001",
    institutionId: "INST_MEDIATRIX",
    phase: "DISPATCH" as const,
    latitude: 0.0001,
    longitude: 0.0001,
    accuracyMetres: 20,
    source: "DEVICE" as const,
    fallbackReason: null,
    capturedAt: "2026-08-14T00:00:00.000Z",
  };
  const first = captureLocationEvidence(input);
  const second = captureLocationEvidence(input);
  assert.deepEqual(first, second);
  assert.equal(first.facilityMatched, true);
  assert.equal(first.deleteAfter, "2026-09-13T00:00:00.000Z");
  assert.equal("latitude" in first.chaincodeSummary, false);
  assert.equal(first.classification, "SYNTHETIC_DATA");
});

test("S3-08 accepts an explicit synthetic facility fallback", () => {
  const evidence = captureLocationEvidence({
    evidenceId: "LOC_RECEIPT_001",
    institutionId: "INST_METRO_LIPA",
    phase: "RECEIPT",
    latitude: 0,
    longitude: 0.018,
    accuracyMetres: 50,
    source: "FACILITY_FALLBACK",
    fallbackReason: "DEVICE_UNAVAILABLE",
    capturedAt: "2026-08-14T01:00:00.000Z",
  });
  assert.equal(evidence.fallback, true);
  assert.equal(evidence.facilityMatched, true);
});

test("S3-08 rejects inaccurate, mismatched, and malformed location evidence", () => {
  const valid = {
    evidenceId: "LOC_INVALID_001",
    institutionId: "INST_MEDIATRIX",
    phase: "DISPATCH" as const,
    latitude: 0,
    longitude: 0,
    accuracyMetres: 20,
    source: "DEVICE" as const,
    fallbackReason: null,
    capturedAt: "2026-08-14T00:00:00.000Z",
  };
  assert.equal(errorCode(() => captureLocationEvidence({ ...valid, accuracyMetres: 1001 })), "COORD_LOCATION_ACCURACY_INVALID");
  assert.equal(errorCode(() => captureLocationEvidence({ ...valid, source: "FACILITY_FALLBACK", fallbackReason: null })), "COORD_LOCATION_FALLBACK_INVALID");
  assert.equal(errorCode(() => captureLocationEvidence({ ...valid, capturedAt: "not-a-time" })), "COORD_TIME_INVALID");
});

test("S3-09 ranks requests using the synthetic 70/30 score and stable tie breaks", () => {
  const result = rankRps({
    evaluationTime: "2026-08-14T12:00:00.000Z",
    requests: [
      { requestId: "TRF_ROUTINE", urgency: "ROUTINE", requestTime: "2026-08-13T12:00:00.000Z" },
      { requestId: "TRF_CRITICAL", urgency: "CRITICAL", requestTime: "2026-08-14T12:00:00.000Z" },
    ],
  });
  assert.equal(result.ranked[0]?.requestId, "TRF_CRITICAL");
  assert.equal(result.ranked[0]?.score, 0.7);
  assert.equal(result.ranked[1]?.score, 0.3);
  assert.equal(result.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
  assert.deepEqual(result, rankRps({
    evaluationTime: "2026-08-14T12:00:00.000Z",
    requests: [
      { requestId: "TRF_ROUTINE", urgency: "ROUTINE", requestTime: "2026-08-13T12:00:00.000Z" },
      { requestId: "TRF_CRITICAL", urgency: "CRITICAL", requestTime: "2026-08-14T12:00:00.000Z" },
    ],
  }));
});

test("S3-09 rejects future request times and duplicates", () => {
  const evaluationTime = "2026-08-14T12:00:00.000Z";
  assert.equal(errorCode(() => rankRps({ evaluationTime, requests: [
    { requestId: "TRF_ONE", urgency: "URGENT", requestTime: "2026-08-14T13:00:00.000Z" },
  ] })), "COORD_RPS_TIME_INVALID");
  assert.equal(errorCode(() => rankRps({ evaluationTime, requests: [
    { requestId: "TRF_ONE", urgency: "URGENT", requestTime: evaluationTime },
    { requestId: "TRF_ONE", urgency: "URGENT", requestTime: evaluationTime },
  ] })), "COORD_RPS_REQUEST_INVALID");
});

test("S3-10 selects the FEFO unit and ranks BROA without approving anything", () => {
  const result = recommendBroa({
    evaluationTime: "2026-08-14T00:00:00.000Z",
    trigger: "FORECAST_SURPLUS",
    scenarioMode: true,
    forecastStatus: "AVAILABLE",
    units: [
      { unitId: "UNIT_LATER", expiresAt: "2026-08-16T00:00:00.000Z", eligible: true },
      { unitId: "UNIT_FIRST", expiresAt: "2026-08-15T00:00:00.000Z", eligible: true },
    ],
    candidates: [
      { institutionId: "INST_ALPHA", urgency: 3, stockShortage: 5, mlSurplus: 2, distanceKm: 10, eligible: true },
      { institutionId: "INST_BETA", urgency: 1, stockShortage: 1, mlSurplus: 1, distanceKm: 2, eligible: true },
    ],
  });
  assert.equal(result.selectedUnitId, "UNIT_FIRST");
  assert.equal(result.ranked[0]?.institutionId, "INST_ALPHA");
  assert.equal(result.ranked[0]?.score, 0.7);
  assert.equal(result.automaticApproval, false);
  assert.equal(result.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY");
});

test("S3-10 rejects stale or non-scenario forecast inputs", () => {
  const input = {
    evaluationTime: "2026-08-14T00:00:00.000Z",
    trigger: "FORECAST_SURPLUS" as const,
    scenarioMode: true,
    forecastStatus: "AVAILABLE" as const,
    units: [{ unitId: "UNIT_ONE", expiresAt: "2026-08-15T00:00:00.000Z", eligible: true }],
    candidates: [{ institutionId: "INST_ALPHA", urgency: 1, stockShortage: 1, mlSurplus: 1, distanceKm: 1, eligible: true }],
  };
  assert.equal(errorCode(() => recommendBroa({ ...input, forecastStatus: "STALE" })), "COORD_FORECAST_STALE");
  assert.equal(errorCode(() => recommendBroa({ ...input, scenarioMode: false })), "COORD_FORECAST_NOT_ELIGIBLE");
});

test("S3-10 rejects duplicate candidates and malformed FEFO units", () => {
  const input = {
    evaluationTime: "2026-08-14T00:00:00.000Z",
    trigger: "NEAR_EXPIRY" as const,
    scenarioMode: false,
    forecastStatus: "UNAVAILABLE" as const,
    units: [{ unitId: "UNIT_ONE", expiresAt: "2026-08-15T00:00:00.000Z", eligible: true }],
    candidates: [{ institutionId: "INST_ALPHA", urgency: 1, stockShortage: 1, mlSurplus: 1, distanceKm: 1, eligible: true }],
  };
  assert.equal(errorCode(() => recommendBroa({
    ...input,
    candidates: [input.candidates[0]!, { ...input.candidates[0]! }],
  })), "COORD_BROA_CANDIDATES_INVALID");
  assert.equal(errorCode(() => recommendBroa({
    ...input,
    units: [{ unitId: "UNIT_ONE", expiresAt: "not-a-time", eligible: true }],
  })), "COORD_BROA_UNITS_INVALID");
});
