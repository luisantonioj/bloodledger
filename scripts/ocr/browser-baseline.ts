// Experiment-only baseline preserves the strict path while exposing raw line scores.
import {createWorker, OEM} from "tesseract.js";
import {reviewOcrLines} from "../../apps/web/src/features/receipts/scan-review-data";

export async function recognizeBaseline(file: File) {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/capture/ocr-assets/worker.min.js", workerBlobURL: false,
    corePath: "/capture/ocr-assets/core", langPath: "/capture/ocr-assets/lang",
    cacheMethod: "none", logger: () => undefined,
  });
  try {
    const result = await worker.recognize(file, {}, {blocks: true});
    const lines = result.data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({text: line.text, confidence: line.confidence}))));
    if (!lines) throw Error("CAPTURE_OCR_LINE_EVIDENCE_MISSING");
    const review = reviewOcrLines(lines);
    const names: Record<string, string> = {"DONATION NO": "donationNumber", "BLOOD TYPE": "bloodType", "COMPONENT": "componentType", "COLLECTED AT": "collectedAt", "EXPIRES AT": "expiresAt"};
    const originalConfidence: Record<string, number> = {};
    for (const line of lines) {
      const match = /^\s*(DONATION NO|BLOOD TYPE|COMPONENT|COLLECTED AT|EXPIRES AT)\s*:/i.exec(line.text);
      if (match) originalConfidence[names[match[1].toUpperCase()]] = line.confidence;
    }
    return {...review, originalConfidence};
  } finally {await worker.terminate();}
}
