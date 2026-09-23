import { createWorker, OEM } from "tesseract.js";
import { OCR_ENGINE_VERSION, parseInboundOcrLines } from "./capture-policy";
import type { CapturedInboundLabel, FieldConfidence } from "./types";

const OCR_ASSET_BASE = import.meta.env.BASE_URL + "ocr-assets";

export interface RecognitionResult {
  label: CapturedInboundLabel;
  fieldConfidence: FieldConfidence;
  capturedAt: string;
}

export async function recognizeInboundLabel(image: File): Promise<RecognitionResult> {
  const capturedAt = new Date().toISOString();
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: OCR_ASSET_BASE + "/worker.min.js",
    corePath: OCR_ASSET_BASE + "/core",
    langPath: OCR_ASSET_BASE + "/lang",
    cacheMethod: "none",
    logger: () => undefined,
  });
  try {
    const result = await worker.recognize(image, {}, { blocks: true });
    const lines = result.data.blocks?.flatMap((block) =>
      block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
        text: line.text,
        confidence: line.confidence,
      }))),
    );
    if (!lines) throw new Error("CAPTURE_OCR_LINE_EVIDENCE_MISSING");
    return { ...parseInboundOcrLines(lines), capturedAt };
  } finally {
    await worker.terminate();
  }
}

export { OCR_ENGINE_VERSION };
