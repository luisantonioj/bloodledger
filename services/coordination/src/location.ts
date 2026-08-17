import { fail } from "./errors.js";
import { sha256 } from "./hash.js";
import { locationPolicy, type LocationPhase } from "./policies.js";

const LOCATION_ID = /^LOC_[A-Z0-9_-]{1,56}$/;

export interface LocationCaptureInput {
  evidenceId: string;
  institutionId: string;
  phase: LocationPhase;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  source: "DEVICE" | "FACILITY_FALLBACK";
  fallbackReason: string | null;
  capturedAt: string;
}

export interface LocationEvidence extends LocationCaptureInput {
  schemaVersion: "LOCATION_EVIDENCE_V1";
  evidenceDigest: string;
  facilityMatched: boolean;
  fallback: boolean;
  policyVersion: "SYNTHETIC_LOCATION_V1";
  classification: "SYNTHETIC_DATA";
  deleteAfter: string;
  chaincodeSummary: {
    evidenceId: string;
    evidenceDigest: string;
    phase: LocationPhase;
    capturedAt: string;
    source: "DEVICE" | "FACILITY_FALLBACK";
    facilityMatched: boolean;
    fallback: boolean;
    policyVersion: "SYNTHETIC_LOCATION_V1";
  };
}

function parseUtc(value: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail("COORD_TIME_INVALID");
  }
  return milliseconds;
}

function distanceMetres(leftLat: number, leftLon: number, rightLat: number, rightLon: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(rightLat - leftLat);
  const lonDelta = radians(rightLon - leftLon);
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(leftLat)) * Math.cos(radians(rightLat)) * Math.sin(lonDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function captureLocationEvidence(input: LocationCaptureInput): LocationEvidence {
  if (!LOCATION_ID.test(input.evidenceId)) fail("COORD_LOCATION_ID_INVALID");
  if (!["DISPATCH", "RECEIPT"].includes(input.phase)) fail("COORD_LOCATION_PHASE_INVALID");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 ||
      !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    fail("COORD_LOCATION_COORDINATES_INVALID");
  }
  if (!Number.isFinite(input.accuracyMetres) || input.accuracyMetres <= 0 ||
      input.accuracyMetres > locationPolicy.maximumAccuracyMetres) {
    fail("COORD_LOCATION_ACCURACY_INVALID");
  }
  const facility = locationPolicy.facilities.find((candidate) => candidate.institutionId === input.institutionId);
  if (facility === undefined) fail("COORD_LOCATION_INSTITUTION_INVALID");
  const fallback = input.source === "FACILITY_FALLBACK";
  if (fallback) {
    if (input.fallbackReason === null || !locationPolicy.allowedFallbackReasons.includes(input.fallbackReason) ||
        input.latitude !== facility.latitude || input.longitude !== facility.longitude) {
      fail("COORD_LOCATION_FALLBACK_INVALID");
    }
  } else if (input.source !== "DEVICE" || input.fallbackReason !== null) {
    fail("COORD_LOCATION_FALLBACK_INVALID");
  }
  const capturedMs = parseUtc(input.capturedAt);
  const facilityMatched = distanceMetres(
    input.latitude, input.longitude, facility.latitude, facility.longitude,
  ) <= locationPolicy.facilityMatchRadiusMetres;
  if (!facilityMatched && fallback) fail("COORD_LOCATION_FALLBACK_INVALID");
  const digestInput = { ...input, policyVersion: locationPolicy.policyVersion };
  const evidenceDigest = sha256(digestInput);
  const deleteAfter = new Date(capturedMs + locationPolicy.retentionDays * 86_400_000).toISOString();
  return {
    schemaVersion: "LOCATION_EVIDENCE_V1",
    ...input,
    evidenceDigest,
    facilityMatched,
    fallback,
    policyVersion: locationPolicy.policyVersion,
    classification: locationPolicy.classification,
    deleteAfter,
    chaincodeSummary: {
      evidenceId: input.evidenceId,
      evidenceDigest,
      phase: input.phase,
      capturedAt: input.capturedAt,
      source: input.source,
      facilityMatched,
      fallback,
      policyVersion: locationPolicy.policyVersion,
    },
  };
}
