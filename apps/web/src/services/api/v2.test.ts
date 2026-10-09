import { afterEach, describe, expect, it, vi } from "vitest";
import {
  V2_COMMAND_STATUSES,
  contractVersionFor,
  parseComponentsResponse,
  parseV2Command,
  readCommand,
} from "./v2";

afterEach(() => vi.unstubAllGlobals());

function command(status: (typeof V2_COMMAND_STATUSES)[number]) {
  return {
    commandId: "CMD_0123456789ABCDEF",
    resourceType: "TRANSFER",
    resourceId: "TRF_0123456789ABCDEF",
    status,
    statusUrl: "/api/v2/commands/CMD_0123456789ABCDEF",
    acceptedAt: "2026-09-18T00:00:00.000Z",
    correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF",
    safeErrorCode: null,
    classification: "SIMULATION_ONLY",
    replayed: false,
  };
}

describe("Sprint 6 V2 frontend contracts", () => {
  // TP-LAT-006 / FR-11–12: status reads stay bound to the requested command.
  it.each([
    { commandId: "CMD_OTHER" },
    { statusUrl: "/api/v2/commands/CMD_OTHER" },
  ])("rejects a status response with unrelated command identity %j", async (override) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...command("COMMITTED"), ...override }))));
    await expect(readCommand(command("QUEUED").statusUrl)).rejects.toThrow("V2_COMMAND_IDENTITY_MISMATCH");
  });

  it("accepts a status transition for the requested command", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(command("COMMITTED")))));
    await expect(readCommand(command("QUEUED").statusUrl)).resolves.toMatchObject({ status: "COMMITTED" });
  });

  it.each(V2_COMMAND_STATUSES)("parses truthful command state %s", (status) => {
    expect(parseV2Command(command(status)).status).toBe(status);
  });

  it("rejects a backend-provided status URL outside the same-origin command path", () => {
    expect(() => parseV2Command({ ...command("QUEUED"), statusUrl: "https://example.test/command" }))
      .toThrowError("V2_STATUS_URL_INVALID");
  });

  it("parses the corrected scoped component envelope without a Donation No.", () => {
    const parsed = parseComponentsResponse({
      scope: "INSTITUTION",
      classification: "SIMULATION_ONLY",
      components: [{
        componentId: "COMP_SYNTH_001",
        donationId: "DON_SYNTH_001",
        issuerInstitutionId: "INST_MEDIATRIX",
        componentType: "PACKED_RED_BLOOD_CELLS",
        bloodType: "O_NEGATIVE",
        collectedAt: "2026-09-17T00:00:00.000Z",
        expiresAt: "2026-10-17T00:00:00.000Z",
        institutionId: "INST_MEDIATRIX",
        inventoryStatus: "AVAILABLE",
        reservationId: null,
        reservationVersion: null,
        inventoryVersion: 1,
        policyVersion: "INTERVIEW_DERIVED_CORE_V2",
        classification: "SIMULATION_ONLY",
      }],
    });
    expect(parsed.components[0]?.componentId).toBe("COMP_SYNTH_001");
    expect(JSON.stringify(parsed)).not.toContain("donationNumber");
  });

  it("uses V2.1 only for cryoprecipitate", () => {
    expect(contractVersionFor("CRYOPRECIPITATE")).toBe("V2.1");
    expect(contractVersionFor("PLATELETS")).toBe("V2");
  });
});
