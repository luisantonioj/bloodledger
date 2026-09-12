import assert from "node:assert/strict";
import test from "node:test";
import { buildCensusSnapshot, censusPolicyEnabled, censusTsv } from "../src/census.js";

test("zero-fills all eight blood groups and counts AVAILABLE plus RESERVED", () => {
  const snapshot = buildCensusSnapshot({ snapshotId: "CENSUS_CORE_001", scheduledFor: "2026-09-12T01:00:00.000Z", capturedAt: "2026-09-12T01:01:00.000Z", reportPolicyVersion: "INTERVIEW_REPORT_PENDING", rows: [
    { componentType: "PLATELETS", bloodType: "O_NEGATIVE", inventoryStatus: "AVAILABLE", count: 2 },
    { componentType: "PLATELETS", bloodType: "O_NEGATIVE", inventoryStatus: "RESERVED", count: 1 },
    { componentType: "PLATELETS", bloodType: "O_NEGATIVE", inventoryStatus: "EXPIRED", count: 10 },
  ] });
  const platelets = snapshot.groups.find((group) => group.componentType === "PLATELETS");
  assert.equal(platelets?.bloodTypes.length, 8); assert.equal(platelets?.bloodTypes.find((item) => item.bloodType === "O_NEGATIVE")?.reportableCount, 3);
  assert.equal(censusPolicyEnabled(undefined), false); assert.match(censusTsv(snapshot, "PLATELETS"), /component_type\tA_POSITIVE/);
});

test("rejects incomplete report policy ordering", () => {
  assert.throws(() => buildCensusSnapshot({ snapshotId: "CENSUS_CORE_002", scheduledFor: "2026-09-12T01:00:00.000Z", capturedAt: "2026-09-12T01:01:00.000Z", reportPolicyVersion: "INTERVIEW_REPORT_PENDING", bloodTypeOrder: ["A_POSITIVE"], rows: [] }), /REPORT_POLICY_BLOOD_ORDER_INVALID/);
});
