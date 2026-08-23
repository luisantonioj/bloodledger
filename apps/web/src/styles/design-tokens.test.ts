import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("./global.css", import.meta.url), "utf8");

describe("DESIGN.md CSS token boundary", () => {
  it("defines the normative color, typography, radius, and layout tokens", () => {
    for (const token of ["--primary", "--canvas", "--surface", "--chrome", "--ink", "--line", "--critical", "--warning", "--success", "--information", "--font-serif", "--font-sans", "--font-mono", "--radius-sm", "--sidebar-width"]) {
      expect(tokens).toContain(token + ":");
    }
  });

  it("keeps component and page styles free of repeated hexadecimal color literals", () => {
    expect(globalStyles.match(/#[0-9A-Fa-f]{3,8}/g) ?? []).toEqual([]);
  });
});
