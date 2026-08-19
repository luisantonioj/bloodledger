export const MAX_OCR_IMAGE_EDGE = 1800;

export function calculateOcrDimensions(width: number, height: number): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  const scale = Math.min(1, MAX_OCR_IMAGE_EDGE / longestEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function imageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("CAPTURE_IMAGE_PREPROCESS_FAILED"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Normalizes camera orientation and produces a bounded, high-contrast image.
 * The returned image is a volatile OCR input; callers must not persist it.
 */
export async function preprocessImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const dimensions = calculateOcrDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("CAPTURE_IMAGE_PREPROCESS_FAILED");
    context.filter = "grayscale(1) contrast(1.35)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await imageBlob(canvas);
    return new File([blob], "synthetic-capture.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
