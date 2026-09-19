import { describe, expect, it } from "vitest";
import { OCR_ENGINE_VERSION } from "./recognition";

describe("PA-S6-02 recognition boundary", () => {
  it("pins the on-device OCR engine evidence version", () => {
    expect(OCR_ENGINE_VERSION).toBe("7.0.0");
  });
});
