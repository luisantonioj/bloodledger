import { describe, expect, it } from "vitest";
import { INVENTORY_BLOOD_TYPES, INVENTORY_COMPONENTS, INVENTORY_EVIDENCE_SCHEMA, parseInventoryEvidence } from "./inventory-evidence";
function fixture() {
  return { schemaVersion: INVENTORY_EVIDENCE_SCHEMA, institutionId: "INST_MEDIATRIX", businessDate: "2026-10-01", evaluatedAt: "2026-10-01T04:00:00.000Z", evaluationDate: "2026-10-01", status: "CURRENT", unavailableReason: null, classification: "SIMULATION_ONLY", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", snapshot: { snapshotId: "CENSUS_SYNTH_BROWSER", institutionId: "INST_MEDIATRIX", snapshotKind: "INTERNAL_ML", schemaVersion: "BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1", reportPolicyVersion: "INTERVIEW_ML_INVENTORY_SNAPSHOT_V1", timezone: "Asia/Manila", capturedAt: "2026-10-01T03:00:00.000Z", scheduledFor: "2026-10-01T01:00:00.000Z", sourceProjectionDigest: "a".repeat(64), projectionWatermark: 0, coverage: "COMPLETE", expectedSeries: 40, persistedSeries: 40, classification: "SIMULATION_ONLY", groups: INVENTORY_COMPONENTS.map(componentType => ({ componentType, bloodTypes: INVENTORY_BLOOD_TYPES.map(bloodType => ({ bloodType, availableCount: 0, reservedCount: 0, forecastEligibleAvailableCount: 0, reportableCount: 0 })) })) } };
}
describe("FR-14 independent inventory evidence", () => {
  it("preserves verified zero and rejects missing coverage, inconsistent counts and foreign scope", () => {
    expect(parseInventoryEvidence(fixture(), "2026-10-01", "INST_MEDIATRIX").snapshot?.groups[0]?.bloodTypes[0]?.availableCount).toBe(0);
    const missing = fixture(); missing.snapshot.groups[0]!.bloodTypes.pop();
    expect(() => parseInventoryEvidence(missing, "2026-10-01", "INST_MEDIATRIX")).toThrow();
    const wrong = fixture(); wrong.snapshot.groups[0]!.bloodTypes[0]!.reportableCount = 1;
    expect(() => parseInventoryEvidence(wrong, "2026-10-01", "INST_MEDIATRIX")).toThrow();
    expect(() => parseInventoryEvidence(fixture(), "2026-10-01", "INST_OTHER")).toThrow();
  });
  it("keeps unavailable null and rejects future or falsely current evidence", () => {
    expect(parseInventoryEvidence({ ...fixture(), status: "UNAVAILABLE", snapshot: null, unavailableReason: "ML_SNAPSHOT_UNAVAILABLE" }, "2026-10-01", "INST_MEDIATRIX").snapshot).toBeNull();
    const body = fixture(); body.snapshot.capturedAt = "2026-10-01T05:00:00.000Z";
    expect(() => parseInventoryEvidence(body, "2026-10-01", "INST_MEDIATRIX")).toThrow();
    body.snapshot.capturedAt = "2026-09-30T03:00:00.000Z"; body.snapshot.scheduledFor = "2026-09-30T01:00:00.000Z";
    expect(() => parseInventoryEvidence(body, "2026-10-01", "INST_MEDIATRIX")).toThrow();
    expect(parseInventoryEvidence({ ...body, status: "STALE" }, "2026-10-01", "INST_MEDIATRIX").status).toBe("STALE");
  });
});
