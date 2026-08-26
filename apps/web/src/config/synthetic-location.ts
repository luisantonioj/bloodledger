import locationPolicy from "../../../../services/coordination/policy/synthetic-location-v1.json";

export const syntheticLocationPolicyVersion = locationPolicy.policyVersion;

export type SyntheticFacilityPoint = Readonly<{
  latitude: number;
  longitude: number;
}>;

export function syntheticFacilityPoint(institutionId: string): SyntheticFacilityPoint | undefined {
  const facility = locationPolicy.facilities.find(candidate => candidate.institutionId === institutionId);
  if (!facility) return undefined;
  return { latitude: facility.latitude, longitude: facility.longitude };
}
