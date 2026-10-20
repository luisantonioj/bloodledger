// TC-T04/TC-G01: one location reading at dispatch or receipt (SYNTHETIC_LOCATION_V2). No continuous tracking.
// When the device cannot provide a usable reading, the API records the facility fallback with the stated reason.
export type CheckpointLocation = { latitude: number | null; longitude: number | null; accuracyMetres: number; source: "DEVICE" | "FACILITY_FALLBACK"; fallbackReason: null | "DEVICE_UNAVAILABLE" | "PERMISSION_DENIED" | "SIGNAL_UNAVAILABLE"; capturedAt: string };

const MAXIMUM_ACCURACY_METRES = 1000;
export const fallbackLocation = (reason: NonNullable<CheckpointLocation["fallbackReason"]>, now = new Date()): CheckpointLocation =>
  ({ latitude: null, longitude: null, accuracyMetres: 500, source: "FACILITY_FALLBACK", fallbackReason: reason, capturedAt: now.toISOString() });

export function fromPosition(position: { coords: { latitude: number; longitude: number; accuracy: number } }, now = new Date()): CheckpointLocation {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAXIMUM_ACCURACY_METRES) return fallbackLocation("SIGNAL_UNAVAILABLE", now);
  return { latitude, longitude, accuracyMetres: Math.round(accuracy * 10) / 10, source: "DEVICE", fallbackReason: null, capturedAt: now.toISOString() };
}

export function captureCheckpointLocation(geolocation: Geolocation | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation, timeoutMs = 8000): Promise<CheckpointLocation> {
  if (!geolocation) return Promise.resolve(fallbackLocation("DEVICE_UNAVAILABLE"));
  return new Promise(resolve => geolocation.getCurrentPosition(
    position => resolve(fromPosition(position)),
    error => resolve(fallbackLocation(error.code === 1 ? "PERMISSION_DENIED" : "SIGNAL_UNAVAILABLE")),
    { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
  ));
}

export const locationLabel = (location: CheckpointLocation) => location.source === "DEVICE"
  ? `Device location captured (±${Math.round(location.accuracyMetres)} m)`
  : `Facility fallback — ${location.fallbackReason === "PERMISSION_DENIED" ? "location permission denied" : location.fallbackReason === "DEVICE_UNAVAILABLE" ? "no location on this device" : "no usable signal"}`;
