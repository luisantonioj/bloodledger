import { describe, expect, it } from "vitest";
import { pollingDelay } from "./polling";

describe("visible refresh backoff", () => {
  it("starts at two seconds", () => expect(pollingDelay(0)).toBe(2000));
  it("backs off on repeated failure", () => expect(pollingDelay(3)).toBe(16000));
  it("caps at thirty seconds", () => expect(pollingDelay(99)).toBe(30000));
});
