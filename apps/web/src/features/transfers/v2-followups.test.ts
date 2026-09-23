import { afterEach, describe, expect, it, vi } from "vitest";
import { permittedReservationActions } from "./v2-followups";
import { readCensusIndex, readReservation, readReservations, readReconciliationReasons } from "../../services/api/v2";
import type { V2Reservation } from "../../services/api/v2";

const reservation: V2Reservation = {
  reservationId: "RES_SYNTH_001", purpose: "TRANSFER", status: "ACTIVE", version: 1,
  sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SECONDARY",
  transferId: "TRF_SYNTH_001", localReleaseId: null, preparedAt: null,
  preparedEvidencePresent: false, updatedAt: "2026-09-19T00:00:00.000Z",
  components: [{ componentId: "COMP_SYNTH_001", componentType: "CRYOPRECIPITATE", inventoryStatus: "RESERVED", inventoryVersion: 2 }],
  classification: "SIMULATION_ONLY",
};

afterEach(() => vi.unstubAllGlobals());

describe("Sprint 6 reservation follow-ups", () => {
  it("permits only valid role and state actions; preparation gates dispatch", () => {
    expect(permittedReservationActions(reservation, "ROLE-01")).toEqual(["prepare", "cancel"]);
    expect(permittedReservationActions(reservation, "ROLE-03")).toEqual(["cancel"]);
    expect(permittedReservationActions(reservation, "ROLE-04")).toEqual([]);
    expect(permittedReservationActions({ ...reservation, preparedEvidencePresent: true }, "ROLE-02")).toEqual(["dispatch", "cancel"]);
    expect(permittedReservationActions({ ...reservation, status: "IN_TRANSIT" }, "ROLE-03")).toEqual(["receive"]);
    expect(permittedReservationActions({ ...reservation, purpose: "LOCAL_RELEASE", preparedEvidencePresent: true }, "ROLE-01")).toEqual(["local-release-complete", "cancel"]);
    expect(permittedReservationActions({ ...reservation, purpose: "LOCAL_RELEASE" }, "ROLE-03")).toEqual([]);
    expect(permittedReservationActions({ ...reservation, status: "COMPLETED" }, "ROLE-01")).toEqual([]);
  });

  it("uses V2.1 on list and detail so cryoprecipitate cannot disappear silently", async () => {
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_path: string, init: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify(requests.length === 1 ? { scope: "SOURCE_INSTITUTION", reservations: [reservation], nextCursor: null, classification: "SIMULATION_ONLY" } : reservation), { status: 200 });
    }));
    expect((await readReservations()).items[0]?.components[0]?.componentType).toBe("CRYOPRECIPITATE");
    expect((await readReservation(reservation.reservationId)).version).toBe(1);
    expect(requests.every((item) => (item.headers as Record<string, string>)["X-BloodLedger-Contract-Version"] === "V2.1")).toBe(true);
  });

  it("rejects an unversioned or free-text reconciliation policy response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ policyVersion: "UNKNOWN", reasons: [], effect: "RECONCILIATION_HOLD_ONLY", freeTextAllowed: true, classification: "SIMULATION_ONLY" }), { status: 200 })));
    await expect(readReconciliationReasons()).rejects.toThrow("V2_REASONS_RESPONSE_INVALID");
  });

  it("rejects a census index whose column order differs from the approved display policy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ classification: "SIMULATION_ONLY", displayPolicyVersion: "DOH_CENSUS_COLUMN_ORDER_V1", totalColumn: "CALCULATED", snapshots: [], displayBloodTypeOrder: ["A_POSITIVE", "O_POSITIVE"] }), { status: 200 })));
    await expect(readCensusIndex()).rejects.toThrow("V2_CENSUS_RESPONSE_INVALID");
  });
});
