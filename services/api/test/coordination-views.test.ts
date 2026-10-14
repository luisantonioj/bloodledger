// TP-JOP-D07 / FR-06 / FR-07 / FR-14: read-only RPS, surplus and BROA views over synthetic live-shaped inputs.
import assert from "node:assert/strict";
import test from "node:test";
import { censusProjectionDigest, type CensusV21Snapshot } from "@bloodledger/coordination/build/src/surplus-v21.js";
import { V5_FORECAST_MODEL_SHA256, type ForecastV5Evidence } from "@bloodledger/coordination/build/src/surplus-v5.js";
import { priorityView, redistributionView, surplusView, type CoordinationReader, type PendingRequestRow } from "../src/coordination-views.js";

const now = new Date("2026-10-15T02:00:00.000Z"); // 10:00 Asia/Manila
const today = "2026-10-15";
const snapshotBase = {
  snapshotId: "CENSUS_SYNTH_TODAY", institutionId: "INST_MEDIATRIX",
  scheduledFor: "2026-10-15T00:30:00.000Z", capturedAt: "2026-10-15T00:31:00.000Z",
  timezone: "Asia/Manila" as const, reportPolicyVersion: "INTERVIEW_ML_INVENTORY_SNAPSHOT_V1",
  groups: [{ componentType: "PACKED_RED_BLOOD_CELLS" as const, bloodTypes: [
    { bloodType: "A_POSITIVE" as const, availableCount: 30, reservedCount: 2, forecastEligibleAvailableCount: 28, reportableCount: 32 },
    { bloodType: "B_POSITIVE" as const, availableCount: 9, reservedCount: 0, forecastEligibleAvailableCount: 9, reportableCount: 9 },
  ] }],
};
const snapshot: CensusV21Snapshot = { ...snapshotBase, sourceProjectionDigest: censusProjectionDigest(snapshotBase), classification: "SIMULATION_ONLY" };
const forecast = (id: string, bloodType: "A_POSITIVE" | "B_POSITIVE", pointForecast: number): ForecastV5Evidence => ({
  forecastId: `FC_${id.repeat(40)}`, forecastRunId: `RUN_${"B".repeat(32)}`, institutionId: "INST_MEDIATRIX",
  bloodType, componentType: "PACKED_RED_BLOOD_CELLS", originDate: "2026-10-14", horizonDate: today, pointForecast,
  forecastStatus: "AVAILABLE", generatedAt: "2026-10-15T00:40:00.000Z", datasetVersion: "SYNTHETIC_FORECAST_V5_RUNTIME_V1",
  modelVersion: "bloodledger-v5-series-mean-1.0.0", modelSha256: V5_FORECAST_MODEL_SHA256, payloadSha256: "c".repeat(64),
  runStatus: "COMPLETED", classification: "SIMULATION_ONLY", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY",
});
const forecasts = [forecast("A", "A_POSITIVE", 4.5), forecast("C", "B_POSITIVE", 3)];
const request = (transferId: string, destinationInstitutionId: string, urgency: PendingRequestRow["urgency"], requestTime: string, quantity = 1, sourceInstitutionId = "INST_MEDIATRIX"): PendingRequestRow =>
  ({ transferId, sourceInstitutionId, destinationInstitutionId, urgency, requestTime, quantity });

function reader(overrides: Partial<{ requests: PendingRequestRow[]; census: CensusV21Snapshot | null; forecasts: ForecastV5Evidence[] }> = {}): CoordinationReader {
  const requests = overrides.requests ?? [
    request("TRF_DEMO_ROUTINE", "INST_SYNTH_MEDIX", "ROUTINE", "2026-10-14T00:00:00.000Z", 2),
    request("TRF_DEMO_CRITICAL", "INST_SYNTH_METROLIPA", "CRITICAL", "2026-10-15T01:00:00.000Z", 1),
    request("TRF_DEMO_ELSEWHERE", "INST_SYNTH_NLVILLA", "URGENT", "2026-10-15T00:00:00.000Z", 3, "INST_SYNTH_MEDIX"),
  ];
  const census = overrides.census === undefined ? snapshot : overrides.census;
  const available = overrides.forecasts ?? forecasts;
  return {
    async pendingRequests(input) { return requests.filter((row) => !input.sourceInstitutionId || row.sourceInstitutionId === input.sourceInstitutionId); },
    async v5ForecastIds() { return available.map((item) => item.forecastId); },
    async latestCensus() { return census ? { snapshotId: census.snapshotId, capturedAt: census.capturedAt ?? "", sourceProjectionDigest: census.sourceProjectionDigest } : null; },
    snapshotReader: { async get() { return census; } },
    forecastReader: { async get(id) { return available.find((item) => item.forecastId === id) ?? null; } },
  };
}

test("TP-JOP-D07 RPS ranks only this supplier's pending requests and explains each score", async () => {
  const view = await priorityView(reader(), "INST_MEDIATRIX", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", now);
  assert.equal(view.status, "AVAILABLE");
  assert.deepEqual(view.ranked.map((row) => row.transferId), ["TRF_DEMO_CRITICAL", "TRF_DEMO_ROUTINE"]);
  assert.deepEqual(view.weights, { urgency: 0.7, wait: 0.3, waitCapHours: 24 });
  const first = view.ranked[0]!;
  assert.equal(first.rank, 1); assert.equal(first.destinationInstitutionId, "INST_SYNTH_METROLIPA");
  assert.equal(Number((first.urgencyContribution + first.waitContribution).toFixed(6)), Number(first.score.toFixed(6)));
  assert.equal(view.recommendationEligibility, "DISABLED_UNAPPROVED_POLICY"); assert.equal(view.classification, "SIMULATION_ONLY");
  const empty = await priorityView(reader({ requests: [] }), "INST_MEDIATRIX", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", now);
  assert.equal(empty.status, "EMPTY"); assert.deepEqual(empty.ranked, []);
});

test("TP-JOP-D07 surplus uses today's census and V5 forecast with the reserve policy", async () => {
  const view = await surplusView(reader(), "INST_MEDIATRIX", today, now);
  assert.equal(view.status, "CURRENT"); assert.equal(view.unavailableReason, null);
  assert.deepEqual(view.reserve, { safetyAllowance: 2, minimumReserve: 10, rounding: "FLOOR" });
  const a = view.series.find((row) => row.bloodType === "A_POSITIVE")!;
  assert.equal(a.availableCount, 28); assert.equal(a.forecastDemand, 4.5); assert.equal(a.surplusQuantity, 11); // floor(28 - 4.5 - 2 - 10)
  const b = view.series.find((row) => row.bloodType === "B_POSITIVE")!;
  assert.equal(b.surplusQuantity, 0); // never negative
  assert.equal(view.forecast?.datasetVersion, "SYNTHETIC_FORECAST_V5_RUNTIME_V1");
});

test("TP-JOP-D07 surplus is honestly unavailable without today's inputs", async () => {
  assert.equal((await surplusView(reader(), "INST_MEDIATRIX", "2026-10-14", now)).unavailableReason, "SURPLUS_REQUIRES_TODAY");
  assert.equal((await surplusView(reader({ census: null }), "INST_MEDIATRIX", today, now)).unavailableReason, "CENSUS_NOT_CURRENT");
  const yesterday = { ...snapshotBase, capturedAt: "2026-10-14T03:00:00.000Z" };
  const stale = await surplusView(reader({ census: { ...yesterday, sourceProjectionDigest: censusProjectionDigest(yesterday), classification: "SIMULATION_ONLY" } }), "INST_MEDIATRIX", today, now);
  assert.equal(stale.unavailableReason, "CENSUS_NOT_CURRENT"); assert.deepEqual(stale.series, []);
  assert.equal((await surplusView(reader({ forecasts: [] }), "INST_MEDIATRIX", today, now)).unavailableReason, "V5_FORECAST_NOT_CURRENT");
  const tampered = await surplusView(reader({ census: { ...snapshot, sourceProjectionDigest: "f".repeat(64) } }), "INST_MEDIATRIX", today, now);
  assert.equal(tampered.status, "UNAVAILABLE"); assert.match(tampered.unavailableReason ?? "", /^COORD_/);
});

test("TP-JOP-D07 BROA gates on surplus, ranks pending needs and never approves", async () => {
  const view = await redistributionView(reader(), "INST_MEDIATRIX", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", 2, now);
  assert.equal(view.status, "AVAILABLE");
  assert.deepEqual(view.gate, { eligible: true, reason: "SURPLUS_AVAILABLE", surplusQuantity: 11, requiredQuantity: 2 });
  assert.equal(view.automaticApproval, false); assert.equal(view.contextUsedForScoring, false);
  assert.equal(view.candidateAssumption, "SYNTHETIC_BROA_CANDIDATES_V1");
  assert.deepEqual(view.ranked.map((row) => row.destinationInstitutionId).sort(), ["INST_SYNTH_MEDIX", "INST_SYNTH_METROLIPA", "INST_SYNTH_NLVILLA"]);
  const nlv = view.ranked.find((row) => row.destinationInstitutionId === "INST_SYNTH_NLVILLA")!;
  assert.equal(nlv.urgency, 2); assert.equal(nlv.stockShortage, 3); assert.equal(nlv.distanceKm, 2.5); // need placed with another supplier still counts
  assert.equal(view.ranked[0]!.rank, 1);
  const short = await redistributionView(reader(), "INST_MEDIATRIX", "B_POSITIVE", "PACKED_RED_BLOOD_CELLS", 1, now);
  assert.equal(short.status, "UNAVAILABLE"); assert.equal(short.gate.eligible, false); assert.equal(short.unavailableReason, "SURPLUS_BELOW_REQUIRED");
  const none = await redistributionView(reader({ requests: [] }), "INST_MEDIATRIX", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", 1, now);
  assert.equal(none.unavailableReason, "NO_PENDING_NEED");
  const unknown = await redistributionView(reader({ requests: [request("TRF_DEMO_FAR", "INST_SYNTH_UNMAPPED", "CRITICAL", "2026-10-15T01:00:00.000Z")] }), "INST_MEDIATRIX", "A_POSITIVE", "PACKED_RED_BLOOD_CELLS", 1, now);
  assert.equal(unknown.unavailableReason, "NO_ELIGIBLE_DESTINATION");
  assert.deepEqual(unknown.excluded, [{ destinationInstitutionId: "INST_SYNTH_UNMAPPED", reason: "DISTANCE_NOT_DEFINED" }]);
});
