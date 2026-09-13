import { afterEach, describe, expect, it, vi } from "vitest";
import { acknowledgeAlert } from "./alert-api";

afterEach(() => vi.unstubAllGlobals());

describe("alert feature API", () => {
  it("encodes the alert identifier and submits only controlled mutation evidence", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      alertId: "ALRT_SYNTH_01",
      acknowledgedAt: "2026-08-24T00:00:00.000Z",
      replayed: false,
      classification: "SIMULATION_ONLY",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const keys = { idempotencyKey: "IDEM_ALERT_TEST", correlationId: "CORR_ALERT_TEST" };

    await expect(acknowledgeAlert("ALRT/01", { correlationId: keys.correlationId }, keys)).resolves.toMatchObject({ replayed: false });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/alerts/ALRT%2F01/acknowledgements", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Idempotency-Key": keys.idempotencyKey }),
      body: JSON.stringify({ correlationId: keys.correlationId }),
    }));
  });

  it("preserves the action-specific safe fallback when no API envelope exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(acknowledgeAlert("ALRT_SYNTH_01", { correlationId: "CORR_ALERT_TEST" }, { idempotencyKey: "IDEM_ALERT_TEST", correlationId: "CORR_ALERT_TEST" })).rejects.toThrow("Acknowledgement failed.");
  });
});
