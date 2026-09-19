import { describe, expect, it } from "vitest";
import {
  CapturePolicyError,
  contractVersionFor,
  parseInboundOcrLines,
  parseInboundOcrText,
} from "./capture-policy";

const text = [
  "DONATION NO: MM26-09-0001",
  "BLOOD TYPE: AB_NEGATIVE",
  "COMPONENT: FRESH_FROZEN_PLASMA",
  "COLLECTED AT: 2026-09-17T00:00:00.000Z",
  "EXPIRES AT: 2027-09-17T00:00:00.000Z",
].join("\n");

describe("PA-S6-02 inbound OCR policy", () => {
  it("extracts and validates the five exact confirmed label fields", () => {
    expect(parseInboundOcrText(text, 96)).toEqual({
      label: {
        donationNumber: "MM26-09-0001",
        bloodType: "AB_NEGATIVE",
        componentType: "FRESH_FROZEN_PLASMA",
        collectedAt: "2026-09-17T00:00:00.000Z",
        expiresAt: "2027-09-17T00:00:00.000Z",
      },
      fieldConfidence: {
        donationNumber: 96,
        bloodType: 96,
        componentType: 96,
        collectedAt: 96,
        expiresAt: 96,
      },
    });
  });

  it("blocks low confidence, prohibited text, invalid issuer format, and invalid expiry", () => {
    const cases = [
      [text, 89, "INBOUND_OCR_CONFIDENCE_LOW"],
      [text + "\nDONOR: SYNTHETIC", 99, "CAPTURE_PROHIBITED_TEXT"],
      [text.replace("MM26-09-0001", "UNAPPROVED-1"), 99, "INBOUND_DONATION_NUMBER_INVALID"],
      [text.replace("2027-09-17T00:00:00.000Z", "2026-09-16T00:00:00.000Z"), 99, "INBOUND_EXPIRY_INVALID"],
    ] as const;
    for (const [input, confidence, code] of cases) {
      expect(() => parseInboundOcrText(input, confidence)).toThrowError(new CapturePolicyError(code));
    }
  });

  it("uses field-level confidence and rejects unknown OCR lines", () => {
    const lines = text.split("\n").map((line) => ({ text: line, confidence: 99 }));
    lines[2].confidence = 89;
    expect(() => parseInboundOcrLines(lines)).toThrowError("INBOUND_OCR_CONFIDENCE_LOW");
    expect(() => parseInboundOcrLines([
      ...lines.slice(0, 2),
      { text: "UNEXPECTED: VALUE", confidence: 99 },
      ...lines.slice(3),
    ])).toThrowError("CAPTURE_FIELD_NOT_ALLOWED");
  });

  it("selects V2.1 only for cryoprecipitate", () => {
    expect(contractVersionFor("CRYOPRECIPITATE")).toBe("V2.1");
    expect(contractVersionFor("WHOLE_BLOOD")).toBe("V2");
  });
});
