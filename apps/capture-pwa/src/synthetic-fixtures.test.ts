import { describe, expect, it } from "vitest";
import labels from "../test/synthetic-labels.json";
import { parseSyntheticMachinePayload, parseSyntheticOcrText } from "./capture-policy";
import type { CapturedUnit } from "./types";

function ocrText(unit: CapturedUnit): string {
  return [
    `UNIT ID: ${unit.unitId}`,
    `BLOOD TYPE: ${unit.bloodType}`,
    `COMPONENT: ${unit.component}`,
    `COLLECTED AT: ${unit.collectedAt}`,
    `EXPIRES AT: ${unit.expiresAt}`,
  ].join("\n");
}

describe("Sprint 4 synthetic fixture matrix", () => {
  it("contains four clean examples for every supported blood-type/component series", () => {
    expect(labels).toHaveLength(16);
    const counts = new Map<string, number>();
    for (const label of labels) {
      const key = `${label.bloodType}/${label.component}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.values()].sort()).toEqual([4, 4, 4, 4]);
  });

  it.each(labels)("extracts $unitId exactly from OCR and fallback contracts", (label) => {
    const expected = label as CapturedUnit;
    expect(parseSyntheticOcrText(ocrText(expected), 99).unit).toEqual(expected);
    expect(parseSyntheticMachinePayload([
      "BL1", expected.unitId, expected.bloodType, expected.component,
      expected.collectedAt, expected.expiresAt,
    ].join("|"))).toEqual(expected);
  });
});
