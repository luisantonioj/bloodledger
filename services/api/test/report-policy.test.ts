import assert from "node:assert/strict";
import test from "node:test";
import { readDohReportPolicy } from "../src/report-policy.js";

test("keeps copy mode disabled without an approved blood-type order", () => {
  const policy = readDohReportPolicy({});
  assert.equal(policy.copyModeEnabled, false);
  assert.equal(policy.version, "INTERVIEW_REPORT_PENDING");
});

test("enables copy mode only for a complete configured order", () => {
  const policy = readDohReportPolicy({ BLOODLEDGER_DOH_REPORT_POLICY_VERSION: "INTERVIEW_REPORT_V2", BLOODLEDGER_DOH_BLOOD_TYPE_ORDER: "O_NEGATIVE,O_POSITIVE,A_NEGATIVE,A_POSITIVE,B_NEGATIVE,B_POSITIVE,AB_NEGATIVE,AB_POSITIVE" });
  assert.equal(policy.copyModeEnabled, true);
  assert.equal(policy.bloodTypeOrder[0], "O_NEGATIVE");
});

test("keeps copy mode disabled when only the confirmed display order is configured", () => {
  const policy = readDohReportPolicy({ BLOODLEDGER_DOH_REPORT_POLICY_VERSION: "DOH_CENSUS_COLUMN_ORDER_V1", BLOODLEDGER_DOH_BLOOD_TYPE_ORDER: "O_POSITIVE,A_POSITIVE,B_POSITIVE,AB_POSITIVE,O_NEGATIVE,A_NEGATIVE,B_NEGATIVE,AB_NEGATIVE" });
  assert.equal(policy.copyModeEnabled, false);
});
