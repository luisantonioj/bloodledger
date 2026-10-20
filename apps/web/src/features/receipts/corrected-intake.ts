import {normalizePrintedValue} from "../../../../capture-pwa/src/capture-policy";
import {validLabel,type LabelDraft,type ScanReview} from "./scan-review-data";

// PA-OCR-03 / ADR-050. This opt-in does not enable the corresponding server policy.
export const correctedIntakeReady=import.meta.env.VITE_BLOODLEDGER_CORRECTED_INTAKE_READY==="true";
export const reviewedIntakeReady=import.meta.env.VITE_BLOODLEDGER_REVIEWED_INTAKE_READY==="true";
export const intakeFields=["donationNumber","bloodType","componentType","collectedAt","expiresAt"] as const;
export type IntakeField=typeof intakeFields[number];
export type CorrectionReason="OCR_MISREAD"|"OCR_NOT_READ"|"OCR_LOW_CONFIDENCE";
export type CorrectionField={ocrValue:string|null;ocrConfidence:number|null;corrected:boolean;reason?:CorrectionReason};
export const correctionReasonText:Record<CorrectionReason,string>={OCR_MISREAD:"OCR read differs from your value",OCR_NOT_READ:"OCR did not read this field",OCR_LOW_CONFIDENCE:"Low engine score; operator review required"};

export function correctedIntakeReview(draft:LabelDraft,review?:ScanReview,donationConfirmation="",allowAllFields=false){
 if(!review||review.extraction||(!allowAllFields&&!review.correctionSourceAllowed))return undefined; // Unaccepted profiles and regional extraction remain preview-only.
 const fields={} as Record<IntakeField,CorrectionField>;
 for(const key of intakeFields){
  // The original review is immutable. Apply only PA-OCR-02's existing closed synthetic grammar.
  const raw=review.draft[key];
  const value=raw?(key==="donationNumber"?raw:normalizePrintedValue(key,raw)):null;
  const score=review.confidences[key];
  const confidence=value!==null&&typeof score==="number"&&Number.isInteger(score)&&score>=0&&score<=100?score:null;
  // A partial/invalid evidence pair must never be invented as an unread field.
  if((value===null)!==(confidence===null))return undefined;
  const corrected=value!==draft[key]||confidence===null||confidence<90;
  fields[key]={ocrValue:value,ocrConfidence:confidence,corrected,...(corrected?{reason:value===null?"OCR_NOT_READ" as const:value!==draft[key]?"OCR_MISREAD" as const:"OCR_LOW_CONFIDENCE" as const}:{})};
 }
 const hasCorrection=intakeFields.some(key=>fields[key].corrected);
 const hasOcrField=intakeFields.some(key=>!fields[key].corrected);
 const needsDonationConfirmation=fields.donationNumber.corrected;
 const eligible=Boolean(validLabel(draft)&&hasCorrection&&(allowAllFields||hasOcrField)&&(!needsDonationConfirmation||donationConfirmation===draft.donationNumber));
 return {fields,hasCorrection,hasOcrField,needsDonationConfirmation,eligible};
}

export const correctedIntakeErrors:Record<string,string>={
 REVIEWED_INTAKE_DISABLED:"Fully reviewed intake after OCR is not enabled on this host. No intake was accepted.",
 CORRECTED_INTAKE_DISABLED:"Corrected OCR intake is not enabled on this host. No intake was accepted.",
 CORRECTION_REASON_REQUIRED:"Review the correction reason for every edited field.",
 CORRECTION_REASON_INCONSISTENT:"A correction reason does not match the original OCR read. Scan again and review the field.",
 CORRECTED_CAPTURE_FIELD_MISMATCH:"An unchanged field differs from its original OCR read. Review the correction before resubmitting.",
 CORRECTED_DONATION_CONFIRMATION_MISMATCH:"The repeated Donation No. must match the corrected Donation No.",
 INBOUND_OCR_CONFIDENCE_LOW:"An unchanged field has a low engine score. Review it as a correction or scan again.",
 CORRECTED_CAPTURE_REQUIRES_OCR_FIELD:"At least one field must remain an unchanged OCR read with an engine score of 90 or above. Fully manual intake is unavailable.",
 CORRECTED_CAPTURE_WITHOUT_CORRECTION:"No correction was recorded. Scan again to submit the unchanged OCR read.",
};
