import {locateFieldRegions} from "./field-regions";
import type {OcrLine} from "./label-extraction";
import {extractLabelReview} from "./label-extraction";
import {labelExtractionPreviewEnabled} from "./label-profiles";
import {prepareLabelImage,preparationChanged} from "./label-image-preparation";
import type {ExtractionOptions} from "./label-image-controls";
import {reviewOcrLines} from "./scan-review-data";
import { createWorker, OEM } from "tesseract.js";
import { parseInboundOcrLines } from "../../../../capture-pwa/src/capture-policy";
export type ReceiptRecognition = ReturnType<typeof parseInboundOcrLines>;

// Reuse the capture PWA's locally served engine assets and strict five-field policy.
// This recognizes a label only; it never uploads an image or records custody.
async function recognizeLines(image: File, signal: AbortSignal, progress: (value: number) => void, refine?: (lines:OcrLine[],read:(input:File)=>Promise<OcrLine[]>)=>Promise<OcrLine[]>) {
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
    const read=async(input:File)=>{
    const result = await worker.recognize(input, {}, {blocks:true});
    signal.throwIfAborted();
    const lines = result.data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({text:line.text,confidence:line.confidence,bbox:line.bbox}))));
    if (!lines) throw new Error("CAPTURE_OCR_LINE_EVIDENCE_MISSING");
    return lines;
    };
    const lines=await read(image);return refine?await refine(lines,read):lines;
  } finally {
    signal.removeEventListener("abort", abort);
    await terminate();
  }
}


export async function recognizeReceiptLabel(image:File,signal:AbortSignal,progress:(value:number)=>void):Promise<ReceiptRecognition>{
  return parseInboundOcrLines(await recognizeLines(image,signal,progress));
}
export async function recognizeReceiptDraft(image:File,signal:AbortSignal,progress:(value:number)=>void,options?:ExtractionOptions){
  const preview=labelExtractionPreviewEnabled&&Boolean(options);
  const changed=Boolean(preview&&options&&(preparationChanged(options.preparation)||options.field||options.profileId));
  const input=preview&&options?await prepareLabelImage(image,options.preparation,signal):image;
  let regional:OcrLine[]=[];
  const lines=await recognizeLines(input,signal,progress,preview&&options&&!options.field?async(full,read)=>{
   const initial=extractLabelReview(full,{profileId:options.profileId});const profileId=initial.extraction?.profileId;if(!profileId)return full;
   const bitmap=await createImageBitmap(input);
   try{for(const region of locateFieldRegions(full,profileId,bitmap.width,bitmap.height)){
    signal.throwIfAborted();const box=region.box,canvas=document.createElement("canvas");canvas.width=box.x1-box.x0;canvas.height=box.y1-box.y0;
    const context=canvas.getContext("2d");if(!context)throw Error("Field crop unavailable");context.drawImage(bitmap,box.x0,box.y0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error("Field crop failed")),"image/png"));
    const cropped=await read(new File([blob],"field-region.png",{type:"image/png"}));
    regional.push(...cropped.map(line=>({...line,bbox:line.bbox?{x0:line.bbox.x0+box.x0,x1:line.bbox.x1+box.x0,y0:line.bbox.y0+box.y0,y1:line.bbox.y1+box.y0}:undefined})));
   }}finally{bitmap.close();}return full;
  }:undefined);
  if(!preview)return reviewOcrLines(lines);
  // Only the unchanged legacy layout can retain its existing verified path.
  if(!changed){try{const legacy=reviewOcrLines(lines);if(legacy.verified)return legacy;}catch{/* Experimental extraction remains preview-only. */}}
  return {...extractLabelReview([...lines,...regional],{profileId:options?.profileId,field:options?.field||undefined}),image:input};
}
