import { createWorker, OEM } from "tesseract.js";
import { parseInboundOcrLines } from "../../../../capture-pwa/src/capture-policy";
export type ReceiptRecognition = ReturnType<typeof parseInboundOcrLines>;

// Reuse the capture PWA's locally served engine assets and strict five-field policy.
// This recognizes a label only; it never uploads an image or records custody.
export async function recognizeReceiptLabel(image: File, signal: AbortSignal, progress: (value: number) => void): Promise<ReceiptRecognition> {
  signal.throwIfAborted();
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/capture/ocr-assets/worker.min.js",
    workerBlobURL: false,
    corePath: "/capture/ocr-assets/core",
    langPath: "/capture/ocr-assets/lang",
    cacheMethod: "none",
    logger: message => { if (!signal.aborted && message.status === "recognizing text") progress(Math.round(message.progress * 100)); },
    errorHandler: () => undefined,
  });
  let terminated = false;
  const terminate = () => { if (!terminated) { terminated = true; return worker.terminate(); } };
  const abort = () => { void terminate(); };
  signal.addEventListener("abort", abort, {once:true});
  try {
    signal.throwIfAborted();
    const result = await worker.recognize(image, {}, {blocks:true});
    signal.throwIfAborted();
    const lines = result.data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({text:line.text,confidence:line.confidence}))));
    if (!lines) throw new Error("CAPTURE_OCR_LINE_EVIDENCE_MISSING");
    return parseInboundOcrLines(lines);
  } finally {
    signal.removeEventListener("abort", abort);
    await terminate();
  }
}
