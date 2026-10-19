import assert from "node:assert/strict";
import test from "node:test";
import { isNearExpiry, NEAR_EXPIRY_LEAD_HOURS } from "../src/near-expiry-policy.js";

test("TC-E01 SYNTHETIC_NEAR_EXPIRY_V1 lead boundaries per component, never for expired stock", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  assert.deepEqual([NEAR_EXPIRY_LEAD_HOURS.PACKED_RED_BLOOD_CELLS, NEAR_EXPIRY_LEAD_HOURS.PLATELETS, NEAR_EXPIRY_LEAD_HOURS.FRESH_FROZEN_PLASMA], [12, 6, 24]);
  assert.equal(isNearExpiry("PLATELETS", "2026-10-19T06:00:00.000Z", now), true);
  assert.equal(isNearExpiry("PLATELETS", "2026-10-19T06:00:00.001Z", now), false);
  assert.equal(isNearExpiry("PACKED_RED_BLOOD_CELLS", "2026-10-19T11:59:00.000Z", now), true);
  assert.equal(isNearExpiry("PACKED_RED_BLOOD_CELLS", "2026-10-19T00:00:00.000Z", now), false);
  assert.equal(isNearExpiry("UNKNOWN", "2026-10-19T01:00:00.000Z", now), false);
});
