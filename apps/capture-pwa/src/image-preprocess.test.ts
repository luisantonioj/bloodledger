import { describe, expect, it } from "vitest";
import { MAX_OCR_IMAGE_EDGE, calculateOcrDimensions } from "./image-preprocess";

describe("synthetic OCR image preprocessing", () => {
  it("bounds a landscape image by its longest edge", () => {
    expect(calculateOcrDimensions(3600, 1800)).toEqual({
      width: MAX_OCR_IMAGE_EDGE,
      height: MAX_OCR_IMAGE_EDGE / 2,
    });
  });

  it("does not enlarge a small image", () => {
    expect(calculateOcrDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
