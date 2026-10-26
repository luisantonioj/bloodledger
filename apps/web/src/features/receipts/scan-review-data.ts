import type {ExtractionEvidence} from "./label-extraction";
import {parseInboundOcrLines,validateCapturedLabel,normalizePrintedValue} from "../../../../capture-pwa/src/capture-policy";
import type {CapturedInboundLabel} from "../../../../capture-pwa/src/types";
export type LabelDraft=Record<keyof CapturedInboundLabel,string>;
export const emptyLabel=():LabelDraft=>({donationNumber:"",bloodType:"",componentType:"",collectedAt:"",expiresAt:""});
export function validLabel(draft:LabelDraft){try{return validateCapturedLabel(draft as CapturedInboundLabel);}catch{return undefined;}}
// Keep only allowlisted field values, never arbitrary OCR text or prohibited data.
export function reviewOcrLines(lines:{text:string;confidence:number}[]){
 if(lines.some(line=>/\b(PATIENT|DONOR|DIAGNOSIS|TREATMENT|EMPLOYEE)\b/i.test(line.text)))throw Error("CAPTURE_PROHIBITED_TEXT");
 const draft=emptyLabel(),names:Record<string,keyof LabelDraft>={"DONATION NO":"donationNumber","BLOOD TYPE":"bloodType","COMPONENT":"componentType","COLLECTED AT":"collectedAt","EXPIRES AT":"expiresAt"};
 const seen=new Set<string>(),confidences:Partial<Record<keyof LabelDraft,number>>={};
 for(const line of lines){// Preview only: printed-form borders may be recognized as pipes or tildes.
 // Keep the exact heading and value; never repair letters/digits or raise an engine score.
 const match=/^\s*[|~]*\s*(DONATION NO|BLOOD TYPE|COMPONENT|COLLECTED AT|EXPIRES AT)\s*:\s*(.*?)\s*$/i.exec(line.text);if(!match)continue;const key=names[match[1].toUpperCase()];if(seen.has(key))throw Error("CAPTURE_DUPLICATE_FIELD");seen.add(key);const value=match[2].slice(0,128);draft[key]=key==="donationNumber"?value:normalizePrintedValue(key,value);confidences[key]=Number.isFinite(line.confidence)?Math.round(line.confidence):0;}
 let verified:ReturnType<typeof parseInboundOcrLines>|undefined;
 try{verified=parseInboundOcrLines(lines);}catch{/* A draft is reviewable, not verified capture evidence. */}
 // A readable printed form (PA-OCR-02) reviews as the exact value it maps to, so the unchanged draft stays verified.
 if(verified)Object.assign(draft,verified.label);
 return {...({correctionSourceAllowed:seen.size>0} as {correctionSourceAllowed?:boolean}),draft,confidences,verified,capturedAt:new Date().toISOString(),extraction:undefined as ExtractionEvidence|undefined,image:undefined as File|undefined};
}
export type ScanReview=ReturnType<typeof reviewOcrLines>;
export function unchangedVerifiedDraft(draft:LabelDraft,review?:ScanReview){return Boolean(review?.verified&&Object.keys(draft).every(key=>draft[key as keyof LabelDraft]===review.verified!.label[key as keyof LabelDraft]));}
