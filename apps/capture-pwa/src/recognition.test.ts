import { BarcodeFormat } from "@zxing/browser";
import { describe, expect, it } from "vitest";
import { fallbackCaptureMethod } from "./recognition";

describe("PA-S4-01 fallback format evidence", () => {
  it.each([
    [BarcodeFormat.CODE_128, "CODE_128_FALLBACK"],
    [BarcodeFormat.DATA_MATRIX, "DATA_MATRIX_FALLBACK"],
    [BarcodeFormat.QR_CODE, "SYNTHETIC_QR_FALLBACK"],
  ] as const)("maps format %s to %s", (format, expected) => {
    expect(fallbackCaptureMethod(format)).toBe(expected);
  });

  it("rejects decoded formats outside the accepted fallback policy", () => {
    expect(() => fallbackCaptureMethod(BarcodeFormat.EAN_13)).toThrowError(
      "CAPTURE_FALLBACK_FORMAT_NOT_ALLOWED",
    );
  });
});
