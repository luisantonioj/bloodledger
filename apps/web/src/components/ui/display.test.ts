import { describe, expect, it } from "vitest";
import { formatManilaDateTime, humanizeCode, statusClassName } from "./display";

describe("shared data presentation", () => {
  it("formats UTC evidence in Asia/Manila and preserves missing projection state", () => {
    expect(formatManilaDateTime("2026-08-20T01:00:00.000Z")).toContain("9:00 AM");
    expect(formatManilaDateTime(null)).toBe("Not yet projected");
  });
  it("pairs status text with semantic classes", () => {
    expect(humanizeCode("IN_TRANSIT")).toBe("IN TRANSIT");
    expect(statusClassName("DELAYED")).toBe("status warning");
    expect(statusClassName("FAILED")).toBe("status critical");
    expect(statusClassName("COMMITTED")).toBe("status ");
  });
});
