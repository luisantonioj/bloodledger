import { readFileSync } from "node:fs";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";

export interface LocationCaptureInput<P extends "DISPATCH" | "RECEIPT" = "DISPATCH" | "RECEIPT"> {
  institutionId: string;
  phase: P;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  source: "DEVICE" | "FACILITY_FALLBACK";
  fallbackReason: "DEVICE_UNAVAILABLE" | "PERMISSION_DENIED" | "SIGNAL_UNAVAILABLE" | null;
  capturedAt: string;
}

export interface LocationEvidence<P extends "DISPATCH" | "RECEIPT" = "DISPATCH" | "RECEIPT", V extends LocationPolicyVersion = "SYNTHETIC_LOCATION_V1"> extends LocationCaptureInput<P> {
  evidenceId: string;
  evidenceDigest: string;
  facilityMatched: boolean;
  fallback: boolean;
  policyVersion: V;
  classification: "SYNTHETIC_DATA";
  deleteAfter: string;
}

export type LocationPolicyVersion = "SYNTHETIC_LOCATION_V1" | "SYNTHETIC_LOCATION_V2";
type LocationPolicy = {
  classification: "SYNTHETIC_DATA";
  policyVersion: LocationPolicyVersion;
  maximumAccuracyMetres: number;
  facilityMatchRadiusMetres: number;
  retentionDays: number;
  allowedFallbackReasons: string[];
  facilities: { institutionId:string; latitude:number; longitude:number }[];
};

const loadPolicy = (file: string) => JSON.parse(readFileSync(new URL(`../../../coordination/policy/${file}`, import.meta.url), "utf8")) as LocationPolicy;
// V1 serves the V1 transfer contract; V2 (TC-T04 remediation, Proposed) covers the V2 institution-account hospitals.
const policies: Record<LocationPolicyVersion, LocationPolicy> = { SYNTHETIC_LOCATION_V1: loadPolicy("synthetic-location-v1.json"), SYNTHETIC_LOCATION_V2: loadPolicy("synthetic-location-v2.json") };

function invalid(): never {
  throw new ApiFailure(400, "INVALID_LOCATION_EVIDENCE", "Synthetic location evidence is invalid.");
}

function parseUtc(value: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) invalid();
  return milliseconds;
}

function distanceMetres(leftLat:number,leftLon:number,rightLat:number,rightLon:number):number {
  const radians=(degrees:number)=>degrees*Math.PI/180;
  const latDelta=radians(rightLat-leftLat),lonDelta=radians(rightLon-leftLon);
  const a=Math.sin(latDelta/2)**2+Math.cos(radians(leftLat))*Math.cos(radians(rightLat))*Math.sin(lonDelta/2)**2;
  return 6_371_000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export function captureSyntheticLocationEvidence<P extends "DISPATCH"|"RECEIPT",V extends LocationPolicyVersion="SYNTHETIC_LOCATION_V1">(input:LocationCaptureInput<P>,evidenceId:string,policyVersion:V=("SYNTHETIC_LOCATION_V1" as V)):LocationEvidence<P,V> {
  const policy=policies[policyVersion];
  if(policy.policyVersion!==policyVersion||policy.classification!=="SYNTHETIC_DATA"||policy.retentionDays!==30)invalid();
  if(!/^LOC_[A-Z0-9_-]{1,56}$/.test(evidenceId)||!["DISPATCH","RECEIPT"].includes(input.phase))invalid();
  if(!Number.isFinite(input.latitude)||input.latitude < -90||input.latitude > 90||!Number.isFinite(input.longitude)||input.longitude < -180||input.longitude > 180)invalid();
  if(!Number.isFinite(input.accuracyMetres)||input.accuracyMetres<=0||input.accuracyMetres>policy.maximumAccuracyMetres)invalid();
  const facility=policy.facilities.find(item=>item.institutionId===input.institutionId);
  if(!facility)invalid();
  const fallback=input.source==="FACILITY_FALLBACK";
  if(fallback){
    if(input.fallbackReason===null||!policy.allowedFallbackReasons.includes(input.fallbackReason)||input.latitude!==facility.latitude||input.longitude!==facility.longitude)invalid();
  }else if(input.source!=="DEVICE"||input.fallbackReason!==null)invalid();
  const capturedMs=parseUtc(input.capturedAt);
  const facilityMatched=distanceMetres(input.latitude,input.longitude,facility.latitude,facility.longitude)<=policy.facilityMatchRadiusMetres;
  if(fallback&&!facilityMatched)invalid();
  const evidenceDigest=sha256({...input,policyVersion});
  return{...input,evidenceId,evidenceDigest,facilityMatched,fallback,policyVersion,classification:policy.classification,deleteAfter:new Date(capturedMs+policy.retentionDays*86_400_000).toISOString()};
}
