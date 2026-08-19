import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/browser";
import { createWorker, OEM } from "tesseract.js";
import {
  CapturePolicyError,
  OCR_ENGINE_VERSION,
  parseSyntheticMachinePayload,
  parseSyntheticOcrLines,
} from "./capture-policy";
import { preprocessImage } from "./image-preprocess";
import type { CaptureMethod, CapturedUnit, FieldConfidence } from "./types";

export type RecognitionStage =
  | "PREPARING_IMAGE"
  | "LOADING_OCR_ENGINE"
  | "READING_LABEL";

export interface RecognitionOptions {
  onStage?: (stage: RecognitionStage) => void;
  timeoutMs?: number;
}

const DEFAULT_OCR_TIMEOUT_MS = 90_000;
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
let workerPromise: Promise<OcrWorker> | undefined;
let workerInstance: OcrWorker | undefined;

async function getWorker(onStage?: (stage: RecognitionStage) => void): Promise<OcrWorker> {
  if (workerPromise !== undefined) return workerPromise;
  onStage?.("LOADING_OCR_ENGINE");
  workerPromise = createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/ocr-assets/worker.min.js",
    corePath: "/ocr-assets/core",
    langPath: "/ocr-assets/lang",
    cacheMethod: "write",
    logger: () => undefined,
  }).then((worker) => {
    workerInstance = worker;
    return worker;
  }).catch((error) => {
    workerPromise = undefined;
    throw error;
  });
  return workerPromise;
}

async function resetWorker(): Promise<void> {
  const worker = workerInstance;
  workerInstance = undefined;
  workerPromise = undefined;
  if (worker !== undefined) await worker.terminate();
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("CAPTURE_OCR_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function recognizeImage(worker: OcrWorker, image: File): Promise<RecognitionResult> {
  const result = await worker.recognize(image, {}, { blocks: true });
  const lines = result.data.blocks?.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
      text: line.text,
      confidence: line.confidence,
    }))),
  );
  if (!lines) throw new Error("CAPTURE_OCR_LINE_EVIDENCE_MISSING");
  const parsed = parseSyntheticOcrLines(lines);
  return { ...parsed, captureMethod: "OCR" as const };
}

export interface RecognitionResult {
  unit: CapturedUnit;
  fieldConfidence: FieldConfidence | null;
  captureMethod: CaptureMethod;
}

export async function recognizeSyntheticLabel(
  image: File,
  options: RecognitionOptions = {},
): Promise<RecognitionResult> {
  const operation = (async () => {
    options.onStage?.("PREPARING_IMAGE");
    const preparedImage = await preprocessImage(image);
    const worker = await getWorker(options.onStage);
    options.onStage?.("READING_LABEL");
    try {
      return await recognizeImage(worker, preparedImage);
    } catch (error) {
      // Keep the strict policy, but retry the volatile original camera input
      // when preprocessing changes OCR evidence enough to fail validation.
      if (error instanceof CapturePolicyError) return await recognizeImage(worker, image);
      throw error;
    }
  })();
  try {
    return await withTimeout(operation, options.timeoutMs ?? DEFAULT_OCR_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof Error && error.message === "CAPTURE_OCR_TIMEOUT") {
      await resetWorker();
    }
    throw error;
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
