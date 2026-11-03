import { test } from "node:test";
import assert from "node:assert/strict";
import { kendallTau, perturbWeights, runSensitivityStudy, seededRandom, TABLE_7_SCENARIO } from "../src/sensitivity.js";
import { rpsV2Score } from "../src/rps-v2.js";
import { broaV21Rank } from "../src/broa-v21.js";
import { distributableSurplus } from "../src/surplus-v21.js";

test("Franze #2 sensitivity study is reproducible from its fixed seed", () => {
  const first = runSensitivityStudy(), second = runSensitivityStudy();
  assert.equal(first.resultSha256, second.resultSha256);
  assert.deepEqual(first, second);
  assert.equal(first.classification, "SIMULATION_ONLY");
  assert.deepEqual(Array.from({ length: 3 }, seededRandom(7)), Array.from({ length: 3 }, seededRandom(7)));
});

test("perturbed weights stay normalized and Kendall tau spans identical to reversed orders", () => {
  for (const factor of [0.8, 0.9, 1.1, 1.2]) {
    const weights = perturbWeights({ urgency: 0.5, stockShortage: 0.3125, distancePenalty: 0.1875 }, "stockShortage", factor);
    assert.ok(Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  }
  assert.equal(kendallTau(["A", "B", "C"], ["A", "B", "C"]), 1);
  assert.equal(kendallTau(["A", "B", "C"], ["C", "B", "A"]), -1);
});

test("the extracted score functions reproduce the manuscript's Table 7, Table 8 and surplus values", () => {
  assert.deepEqual(TABLE_7_SCENARIO.map((request) => rpsV2Score(request.urgency, request.waitHours).score), [0.7, 0.65, 0.425, 0.3]);
  const ranked = broaV21Rank([
    { destinationInstitutionId: "INST_HOSPITAL_A", urgency: 3, stockShortage: 2, distanceKm: 2.0 },
    { destinationInstitutionId: "INST_HOSPITAL_B", urgency: 2, stockShortage: 4, distanceKm: 1.5 },
    { destinationInstitutionId: "INST_HOSPITAL_C", urgency: 1, stockShortage: 6, distanceKm: 4.0 },
  ]);
  assert.deepEqual(ranked.map((candidate) => [candidate.destinationInstitutionId, Number(candidate.score.toFixed(4))]), [["INST_HOSPITAL_A", 0.4625], ["INST_HOSPITAL_B", 0.4063], ["INST_HOSPITAL_C", 0.125]]);
  assert.equal(distributableSurplus(25, 4.59), 8);
  assert.equal(distributableSurplus(20, 0, { safetyAllowance: 0, minimumReserve: 12 }), 8);
});

test("baseline RPS keeps Critical precedence, and the study reports where it would break", () => {
  const { rps } = runSensitivityStudy().results;
  const lowered = rps.find((row) => row.parameter === "urgencyWeight" && row.factor === 0.8)!;
  assert.equal(lowered.criticalAlwaysOutranksUrgent, false, "0.56/0.86 < 2/3");
  assert.equal(rps.find((row) => row.parameter === "urgencyWeight" && row.factor === 1.1)!.criticalAlwaysOutranksUrgent, true);
});
