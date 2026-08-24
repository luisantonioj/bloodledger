import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveTransfer,
  cancelTransfer,
  createTransfer,
  delayTransfer,
  dispatchTransfer,
  receiveTransfer,
  rejectTransfer,
  resumeTransfer,
  startTransferTransit,
  transferDetailPath,
} from "./transfer-api";

afterEach(() => vi.unstubAllGlobals());

const keys = { idempotencyKey: "IDEM_TRANSFER_TEST", correlationId: "CORR_TRANSFER_TEST" };
const versioned = { expectedVersion: 3, eventTime: "2026-08-24T00:00:00.000Z", correlationId: keys.correlationId };
const reasoned = { ...versioned, reasonCode: "SYNTHETIC_REASON" };
const located = {
  ...versioned,
  location: {
    latitude: 0,
    longitude: 0,
    accuracyMetres: 50,
    source: "FACILITY_FALLBACK" as const,
    fallbackReason: "DEVICE_UNAVAILABLE",
    capturedAt: versioned.eventTime,
  },
};

describe("transfer feature API", () => {
  it("maps every lifecycle mutation to the same-origin API boundary", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      approveTransfer("TRF/01", versioned, keys),
      rejectTransfer("TRF/01", reasoned, keys),
      delayTransfer("TRF/01", reasoned, keys),
      resumeTransfer("TRF/01", versioned, keys),
      receiveTransfer("TRF/01", located, keys),
      startTransferTransit("TRF/01", versioned, keys),
      dispatchTransfer("TRF/01", located, keys),
      cancelTransfer("TRF/01", reasoned, keys),
    ]);

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "/api/v1/transfers/TRF%2F01/approval",
      "/api/v1/transfers/TRF%2F01/rejection",
      "/api/v1/transfers/TRF%2F01/delay",
      "/api/v1/transfers/TRF%2F01/resume",
      "/api/v1/transfers/TRF%2F01/receipt",
      "/api/v1/transfers/TRF%2F01/transit-start",
      "/api/v1/transfers/TRF%2F01/dispatch",
      "/api/v1/transfers/TRF%2F01/cancellation",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toEqual(expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({ "Idempotency-Key": keys.idempotencyKey }),
      }));
    }
    expect(transferDetailPath("TRF/01")).toBe("/api/v1/transfers/TRF%2F01");
  });

  it("creates a transfer with controlled payload and returns its identifier", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ transferId: "TRF_SYNTH_01" }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const payload = { bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "ROUTINE", requestTime: versioned.eventTime, eventTime: versioned.eventTime, correlationId: keys.correlationId };

    await expect(createTransfer(payload, keys)).resolves.toEqual({ transferId: "TRF_SYNTH_01" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/transfers", expect.objectContaining({ body: JSON.stringify(payload) }));
  });

  it("preserves the action-specific safe fallback when no API envelope exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(approveTransfer("TRF_SYNTH_01", versioned, keys)).rejects.toThrow("Transfer approval failed.");
  });
});
