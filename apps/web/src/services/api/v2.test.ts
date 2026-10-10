import { afterEach, describe, expect, it, vi } from "vitest";
import {
  V2_EXPIRY_STATES,
  V2_COMMAND_STATUSES,
  contractVersionFor,
  parseComponentsResponse,
  parseV2Component,
  parseV2Command,
  readCommand,
  readCommandByKey,
  submitExpiryEvaluation,
} from "./v2";
import { setCommandVerifier } from "./client";

afterEach(() => { setCommandVerifier(); vi.unstubAllGlobals(); });

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
        expiryState: "CURRENT",
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

  // J4 / FR-08–09: server state is mandatory and never inferred from the browser clock.
  const component = { componentId: "COMP_SYNTH_001", donationId: "DON_SYNTH_001", issuerInstitutionId: "INST_MEDIATRIX",
    componentType: "PLATELETS", bloodType: "A_POSITIVE", collectedAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-08T00:00:00Z",
    institutionId: "INST_MEDIATRIX", inventoryStatus: "AVAILABLE", reservationId: null, reservationVersion: null,
    inventoryVersion: 4, policyVersion: "INTERVIEW_DERIVED_CORE_V2", classification: "SIMULATION_ONLY" };
  it.each(V2_EXPIRY_STATES)("preserves the server expiry state %s", expiryState => {
    expect(parseV2Component({ ...component, expiryState }).expiryState).toBe(expiryState);
  });
  it.each([undefined, "NEAR_EXPIRY", null])("rejects missing/unknown expiry state %s", expiryState => {
    expect(() => parseV2Component({ ...component, expiryState })).toThrow("V2_COMPONENT_RESPONSE_INVALID");
  });
  it("binds expiry to the operator, original key and expected inventory version with no client time", async () => {
    const verifier = vi.fn(async () => "VFY_SYNTHETIC"); setCommandVerifier(verifier);
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ...command("QUEUED"), resourceType: "COMPONENT", resourceId: component.componentId }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const keys = { idempotencyKey: "IDEM_TEST", correlationId: command("QUEUED").correlationId };
    await submitExpiryEvaluation(component.componentId, 4, keys);
    expect(verifier).toHaveBeenCalledWith({ action: "POST /api/v2/components/COMP_SYNTH_001/expiry", idempotencyKey: keys.idempotencyKey, payload: { correlationId: keys.correlationId, expectedVersion: 4 } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ correlationId: keys.correlationId, expectedVersion: 4 });
    expect(new Headers(init.headers).get("Operator-Verification")).toBe("VFY_SYNTHETIC");
    expect(new Headers(init.headers).get("X-BloodLedger-Contract-Version")).toBe("V2.1");
  });
});

// issue36 / FR12: recover ambiguous acceptance using an authenticated GET only.
describe("request-key recovery", () => {
  it("looks up one scoped command without resubmitting", async () => {
    const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({scope:"ACTOR_INSTITUTION",commands:[command("QUEUED")],nextCursor:null,classification:"SIMULATION_ONLY"})));
    vi.stubGlobal("fetch",fetchMock);
    await expect(readCommandByKey("IDEM_WEB_SYNTH")).resolves.toMatchObject({commandId:command("QUEUED").commandId});
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v2/commands?idempotencyKey=IDEM_WEB_SYNTH");
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("method","POST");
  });
  it("does not turn an empty lookup into a retry", async () => {
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({scope:"ACTOR_INSTITUTION",commands:[],nextCursor:null,classification:"SIMULATION_ONLY"}))));
    await expect(readCommandByKey("IDEM_WEB_SYNTH")).resolves.toBeUndefined();
  });
  it.each([{scope:"GLOBAL"},{nextCursor:"CMD_NEXT"},{commands:[command("QUEUED"),command("QUEUED")]},{commands:[{...command("QUEUED"),statusUrl:"/api/v2/commands/CMD_OTHER"}]}])("rejects ambiguous or mismatched lookup %j", patch=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({scope:"ACTOR_INSTITUTION",commands:[],nextCursor:null,classification:"SIMULATION_ONLY",...patch}))));
    return expect(readCommandByKey("IDEM_WEB_SYNTH")).rejects.toThrow();
  });
});
