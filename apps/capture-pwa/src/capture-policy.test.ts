import { describe, expect, it } from "vitest";
import { CapturePolicyError, parseSyntheticMachinePayload, parseSyntheticOcrLines, parseSyntheticOcrText } from "./capture-policy";

const text = [
  "UNIT ID: UNIT_SYNTH_S4_001",
  "BLOOD TYPE: A_POSITIVE",
  "COMPONENT: RED_BLOOD_CELLS",
  "COLLECTED AT: 2026-08-17T00:00:00.000Z",
  "EXPIRES AT: 2026-08-20T00:00:00.000Z",
].join("\n");

describe("PA-S4-01 capture policy", () => {
  it("extracts and validates the five exact synthetic fields", () => {
    expect(parseSyntheticOcrText(text, 96)).toEqual({
      unit: {
        unitId: "UNIT_SYNTH_S4_001",
        bloodType: "A_POSITIVE",
        component: "RED_BLOOD_CELLS",
        collectedAt: "2026-08-17T00:00:00.000Z",
        expiresAt: "2026-08-20T00:00:00.000Z",
      },
      fieldConfidence: { unitId: 96, bloodType: 96, component: 96, collectedAt: 96, expiresAt: 96 },
    });
  });

  it("blocks low-confidence, prohibited, missing, and invalid-expiry text", () => {
    for (const [input, confidence, code] of [
      [text, 89, "CAPTURE_CONFIDENCE_TOO_LOW"],
      [`${text}\nDONOR: SYNTHETIC`, 99, "CAPTURE_PROHIBITED_TEXT"],
      [text.replace(/UNIT ID:.+\n/, ""), 99, "CAPTURE_REQUIRED_FIELD_MISSING"],
      [text.replace("2026-08-20T00:00:00.000Z", "2026-08-21T00:00:00.000Z"), 99, "CAPTURE_EXPIRY_INVALID"],
    ] as const) {
      expect(() => parseSyntheticOcrText(input, confidence)).toThrowError(new CapturePolicyError(code));
    }
  });

  it("accepts exact fallback payloads and rejects extra fields", () => {
    const payload = "BL1|UNIT_SYNTH_S4_002|O_POSITIVE|PLATELETS|2026-08-17T00:00:00.000Z|2026-08-18T12:00:00.000Z";
    expect(parseSyntheticMachinePayload(payload).component).toBe("PLATELETS");
    expect(() => parseSyntheticMachinePayload(`${payload}|EXTRA`)).toThrowError("CAPTURE_MACHINE_PAYLOAD_INVALID");
  });

  it("uses field-level line confidence and rejects unknown OCR lines", () => {
    const lines = text.split("\n").map((line) => ({ text: line, confidence: 99 }));
    lines[2].confidence = 89;
    expect(() => parseSyntheticOcrLines(lines)).toThrowError("CAPTURE_CONFIDENCE_TOO_LOW");
    expect(() => parseSyntheticOcrLines([
      ...lines.slice(0, 2),
      { text: "UNEXPECTED: VALUE", confidence: 99 },
      ...lines.slice(3),
    ])).toThrowError("CAPTURE_FIELD_NOT_ALLOWED");
  });
});
