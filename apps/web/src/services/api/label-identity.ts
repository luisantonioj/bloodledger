import {object,choice,nullableChoice,nullableText,invalidRead} from "./contract-validation";
export interface LabelIdentity {status:"AVAILABLE"|"UNAVAILABLE";kind:"DONATION_NUMBER";value:string|null;source:"CONFIRMED_OCR_CAPTURE"|"LEGACY_REGISTRATION"|null;unavailableReason:"NOT_RECORDED"|"TEMPORARILY_UNAVAILABLE"|"NOT_COMMITTED"|null;policyVersion:"LABEL_IDENTITY_READ_V1"}
export function parseLabelIdentity(value:unknown):LabelIdentity {
 if(value===undefined)return {status:"UNAVAILABLE",kind:"DONATION_NUMBER",value:null,source:null,unavailableReason:"NOT_RECORDED",policyVersion:"LABEL_IDENTITY_READ_V1"};
 const row=object(value),status=choice(row.status,["AVAILABLE","UNAVAILABLE"]),label=nullableText(row.value),source=nullableChoice(row.source,["CONFIRMED_OCR_CAPTURE","LEGACY_REGISTRATION"]),reason=nullableChoice(row.unavailableReason,["NOT_RECORDED","TEMPORARILY_UNAVAILABLE","NOT_COMMITTED"]);
 if(row.kind!=="DONATION_NUMBER"||row.policyVersion!=="LABEL_IDENTITY_READ_V1"||(status==="AVAILABLE"?label===null||label.length>64||source===null||reason!==null:label!==null||source!==null||reason===null))throw invalidRead();
 return {status,kind:"DONATION_NUMBER",value:label,source,unavailableReason:reason,policyVersion:"LABEL_IDENTITY_READ_V1"};
}
export const labelText=(label:LabelIdentity|undefined)=>label?.status==="AVAILABLE"?label.value!:"Label unavailable";
