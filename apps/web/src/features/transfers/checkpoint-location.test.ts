import { describe, expect, it } from "vitest";
import { captureCheckpointLocation, fromPosition } from "./checkpoint-location";

const now = new Date("2026-10-19T02:00:00.000Z");
describe("checkpoint location (TC-T04/TC-G01)", () => {
  it("keeps a usable device reading and falls back on poor accuracy", () => {
    expect(fromPosition({ coords: { latitude: 13.94, longitude: 121.16, accuracy: 25 } }, now)).toMatchObject({ source: "DEVICE", fallbackReason: null, accuracyMetres: 25 });
    expect(fromPosition({ coords: { latitude: 13.94, longitude: 121.16, accuracy: 5000 } }, now)).toMatchObject({ source: "FACILITY_FALLBACK", fallbackReason: "SIGNAL_UNAVAILABLE", latitude: null });
  });
  it("maps a denied permission and a missing device to explicit fallback reasons", async () => {
    const denied = { getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) => fail({ code: 1 }) } as unknown as Geolocation;
    expect(await captureCheckpointLocation(denied)).toMatchObject({ source: "FACILITY_FALLBACK", fallbackReason: "PERMISSION_DENIED" });
    expect(await captureCheckpointLocation(undefined)).toMatchObject({ fallbackReason: "DEVICE_UNAVAILABLE" });
  });
});
