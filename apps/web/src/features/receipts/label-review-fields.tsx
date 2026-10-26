import {correctionReasonText,type CorrectionField,type IntakeField} from "./corrected-intake";
import {FieldExtractionEvidence} from "./field-extraction-evidence";
import {formatBloodType} from "../../components/ui/display";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {componentLabel} from "../transfers/requester-transfer-data";
import type {LabelDraft,ScanReview} from "./scan-review-data";
export function LabelReviewFields({draft,onChange,disabled=false,review,corrections}:{draft:LabelDraft;onChange:(value:LabelDraft)=>void;disabled?:boolean;review?:ScanReview;corrections?:Record<IntakeField,CorrectionField>}){
 const change=(key:keyof LabelDraft,value:string)=>onChange({...draft,[key]:value});
 const original=(key:IntakeField)=>corrections&&<small className="scan-field-confidence">Original OCR: {corrections[key].ocrValue??"Not read"} · Engine score: {corrections[key].ocrConfidence??"None"}{corrections[key].reason&&<> · {correctionReasonText[corrections[key].reason!]}</>}</small>;
 const confidence=(key:keyof LabelDraft)=>corrections?original(key):review?.extraction?<FieldExtractionEvidence field={key} draft={draft} review={review}/>:review&&<small className="scan-field-confidence">{review.confidences[key]===undefined?"Not recognized":`OCR engine score: ${review.confidences[key]}/100`}</small>;
 return <fieldset className="scan-review-fields" disabled={disabled}><legend>Review blood-unit details</legend>
 <label>Donation No. / Unit ID<input aria-label="Donation No. / Unit ID" autoComplete="off" required maxLength={64} value={draft.donationNumber} onChange={event=>change("donationNumber",event.target.value)}/>{confidence("donationNumber")}</label>
 <label>Blood type<span className="requester-select"><select aria-label="Review blood type" required value={draft.bloodType} onChange={event=>change("bloodType",event.target.value)}><option value="">Select blood type</option>{!V2_BLOOD_TYPES.includes(draft.bloodType as typeof V2_BLOOD_TYPES[number])&&draft.bloodType&&<option value={draft.bloodType}>Unrecognized — choose a blood type</option>}{V2_BLOOD_TYPES.map(type=><option key={type} value={type}>{formatBloodType(type)}</option>)}</select></span>{confidence("bloodType")}</label>
 <label>Component<span className="requester-select"><select aria-label="Review component" required value={draft.componentType} onChange={event=>change("componentType",event.target.value)}><option value="">Select component</option>{!V2_COMPONENT_TYPES.includes(draft.componentType as typeof V2_COMPONENT_TYPES[number])&&draft.componentType&&<option value={draft.componentType}>Unrecognized — choose a component</option>}{V2_COMPONENT_TYPES.map(type=><option key={type} value={type}>{componentLabel(type)}</option>)}</select></span>{confidence("componentType")}</label>
 <label>Collection time (UTC)<input aria-label="Collection time (UTC)" required autoComplete="off" placeholder="2026-10-16T00:00:00.000Z" value={draft.collectedAt} onChange={event=>change("collectedAt",event.target.value)}/>{confidence("collectedAt")}</label>
 <label>Expiration time (UTC)<input aria-label="Expiration time (UTC)" required autoComplete="off" placeholder="2026-11-16T00:00:00.000Z" value={draft.expiresAt} onChange={event=>change("expiresAt",event.target.value)}/>{confidence("expiresAt")}</label>
 </fieldset>;
}
