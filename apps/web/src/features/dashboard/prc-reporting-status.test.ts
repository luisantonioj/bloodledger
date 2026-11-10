import { describe, expect, it } from "vitest";
import type { CensusSnapshot } from "../../services/api/census-index";
import type { PrcSupplyRequest } from "../../services/api/prc-supply";
import { latestReachedSlot, reportingLabel, reportingRows, replenishmentOrder } from "./prc-reporting-status";

const record = (institutionId: string, scheduledFor: string): CensusSnapshot => ({ snapshotId: "CENSUS_" + institutionId + scheduledFor.slice(0, 13), institutionId, scheduledFor, capturedAt: scheduledFor.replace(":00.000Z", ":05.000Z"), reportPolicyVersion: "SYNTHETIC_STOCK_CHECKPOINT_V2", triggerType: "SCHEDULED" });
const banks = [{ institutionId: "INST_A", name: "Bank A", available: 10 }, { institutionId: "INST_B", name: "Bank B", available: 0 }, { institutionId: "INST_C", name: "Bank C", available: 3 }];
// 09:00 Manila = 01:00 UTC; 16:00 Manila = 08:00 UTC.
describe("PRC blood-bank reporting status", () => {
  it("uses the latest started 09:00 or 16:00 Manila slot", () => {
    expect(new Date(latestReachedSlot(Date.parse("2026-11-10T02:00:00Z"))).toISOString()).toBe("2026-11-10T01:00:00.000Z");
    expect(new Date(latestReachedSlot(Date.parse("2026-11-10T09:00:00Z"))).toISOString()).toBe("2026-11-10T08:00:00.000Z");
    expect(new Date(latestReachedSlot(Date.parse("2026-11-09T23:00:00Z"))).toISOString()).toBe("2026-11-09T08:00:00.000Z");
  });
  it("marks up to date, missed and never-recorded banks without inventing records", () => {
    const now = Date.parse("2026-11-10T03:00:00Z");
    const rows = reportingRows(banks, [record("INST_A", "2026-11-10T01:00:00.000Z"), record("INST_B", "2026-11-09T08:00:00.000Z"), record("INST_A", "2026-11-11T01:00:00.000Z")], now);
    expect(rows.map(row => row.state)).toEqual(["UP_TO_DATE", "MISSED", "NO_RECORDS"]);
    expect(rows[0].lastRecordAt).toBe("2026-11-10T01:00:05.000Z");
    expect(rows.map(reportingLabel)).toEqual(["Up to date", "Missed 9:00 AM record", "No saved records"]);
  });
  it("shows a slot as still saving during its 30-minute window", () => {
    expect(reportingRows(banks.slice(1, 2), [record("INST_B", "2026-11-09T08:00:00.000Z")], Date.parse("2026-11-10T01:10:00Z"))[0].state).toBe("AWAITING");
  });
  it("lists open replenishment requests first, soonest needed first", () => {
    const request = (requestId: string, status: string, requiredBy: string) => ({ requestId, status, requiredBy }) as PrcSupplyRequest;
    expect(replenishmentOrder([request("A", "FULFILLED", "2026-11-01T00:00:00Z"), request("B", "SUBMITTED", "2026-11-20T00:00:00Z"), request("C", "ACKNOWLEDGED", "2026-11-12T00:00:00Z"), request("D", "DECLINED", "2026-11-05T00:00:00Z")]).map(row => row.requestId)).toEqual(["C", "B", "D", "A"]);
  });
});
