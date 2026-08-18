import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/browser";
import { createWorker, OEM } from "tesseract.js";
import {
  CapturePolicyError,
  OCR_ENGINE_VERSION,
  parseSyntheticMachinePayload,
  parseSyntheticOcrLines,
} from "./capture-policy";
import type { CaptureMethod, CapturedUnit, FieldConfidence } from "./types";

export interface RecognitionResult {
  unit: CapturedUnit;
  fieldConfidence: FieldConfidence | null;
  captureMethod: CaptureMethod;
}

export async function recognizeSyntheticLabel(image: File): Promise<RecognitionResult> {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/ocr-assets/worker.min.js",
    corePath: "/ocr-assets/core",
    langPath: "/ocr-assets/lang",
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
    const parsed = parseSyntheticOcrLines(lines);
    return { ...parsed, captureMethod: "OCR" };
  } finally {
    await worker.terminate();
  }
}

export function fallbackCaptureMethod(format: BarcodeFormat): Exclude<CaptureMethod, "OCR"> {
  switch (format) {
    case BarcodeFormat.CODE_128:
      return "CODE_128_FALLBACK";
    case BarcodeFormat.DATA_MATRIX:
      return "DATA_MATRIX_FALLBACK";
    case BarcodeFormat.QR_CODE:
      return "SYNTHETIC_QR_FALLBACK";
    default:
      throw new CapturePolicyError("CAPTURE_FALLBACK_FORMAT_NOT_ALLOWED");
  }
}

export async function decodeSyntheticFallback(image: File): Promise<RecognitionResult> {
  const objectUrl = URL.createObjectURL(image);
  try {
    const result = await new BrowserMultiFormatReader().decodeFromImageUrl(objectUrl);
    return {
      unit: parseSyntheticMachinePayload(result.getText()),
      fieldConfidence: null,
      captureMethod: fallbackCaptureMethod(result.getBarcodeFormat()),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export { OCR_ENGINE_VERSION };
