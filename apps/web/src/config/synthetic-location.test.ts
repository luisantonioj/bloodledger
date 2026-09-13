import { describe, expect, it } from "vitest";
import { syntheticFacilityPoint, syntheticLocationPolicyVersion } from "./synthetic-location";

describe("synthetic location policy adapter", () => {
  it("reads source and destination fixture points from the authoritative policy", () => {
    expect(syntheticLocationPolicyVersion).toBe("SYNTHETIC_LOCATION_V1");
    expect(syntheticFacilityPoint("INST_MEDIATRIX")).toEqual({ latitude: 0, longitude: 0 });
    expect(syntheticFacilityPoint("INST_METRO_LIPA")).toEqual({ latitude: 0, longitude: 0.018 });
  });

  it("does not invent a point for an institution outside the policy", () => {
    expect(syntheticFacilityPoint("INST_NOT_IN_POLICY")).toBeUndefined();
  });
});
