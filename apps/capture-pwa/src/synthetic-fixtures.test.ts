import { describe, expect, it } from "vitest";
import labels from "../test/inbound-labels-v2.json";
import { parseInboundOcrText } from "./capture-policy";
import type { CapturedInboundLabel } from "./types";

function ocrText(label: CapturedInboundLabel): string {
  return [
    "DONATION NO: " + label.donationNumber,
    "BLOOD TYPE: " + label.bloodType,
    "COMPONENT: " + label.componentType,
    "COLLECTED AT: " + label.collectedAt,
    "EXPIRES AT: " + label.expiresAt,
  ].join("\n");
}

describe("Sprint 6 synthetic inbound fixture matrix", () => {
  it("covers all eight ABO/Rh groups and every V2/V2.1 component value", () => {
    expect(new Set(labels.map((label) => label.bloodType)).size).toBe(8);
    expect(new Set(labels.map((label) => label.componentType))).toEqual(new Set([
      "WHOLE_BLOOD",
      "PACKED_RED_BLOOD_CELLS",
      "FRESH_FROZEN_PLASMA",
      "PLATELETS",
      "CRYOPRECIPITATE",
    ]));
  });

  it.each(labels)("extracts confirmed inbound label  exactly", (label) => {
    const expected = label as CapturedInboundLabel;
    expect(parseInboundOcrText(ocrText(expected), 99).label).toEqual(expected);
  });
});
