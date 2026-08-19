import { describe, expect, it } from "vitest";
import { withTimeout } from "./recognition";

describe("OCR timeout boundary", () => {
  it("returns a completed operation", async () => {
    await expect(withTimeout(Promise.resolve("done"), 50)).resolves.toBe("done");
  });

  it("fails with a safe timeout code", async () => {
    await expect(withTimeout(new Promise(() => undefined), 1)).rejects.toThrow("CAPTURE_OCR_TIMEOUT");
  });
});
