import type {LabelDraft} from "./scan-review-data";
export type LabelField=keyof LabelDraft;
export interface LabelProfile {id:string;version:string;institutionId:string;name:string;status:"DRAFT_REFERENCE"|"REFERENCE_PENDING";institutionAnchors:string[];anchors:Partial<Record<LabelField,string[]>>}
export const FIELD_ANCHORS:Record<LabelField,string[]>={
 donationNumber:["DONATION NO","DONATION NUMBER"],bloodType:["ABO/RH TYPE","ABO RH TYPE","BLOOD TYPE","BLOOD GROUP"],componentType:["COMPONENT","BLOOD COMPONENT","PRODUCT TYPE"],collectedAt:["COLLECTION DATE","DATE OF COLLECTION","COLLECTED AT"],expiresAt:["EXPIRY DATE","EXPIRATION DATE","EXPIRES AT"],
};
// Reference-derived preview configuration, not an accepted issuer/clinical policy.
export const LABEL_PROFILES:LabelProfile[]=[
 {id:"MEDIATRIX_BAG_PREVIEW",version:"1",institutionId:"INST_MEDIATRIX",name:"Mary Mediatrix",status:"DRAFT_REFERENCE",institutionAnchors:["MARY MEDIATRIX"],anchors:FIELD_ANCHORS},
 {id:"MEDIX_REFERENCE_PENDING",version:"1",institutionId:"INST_SYNTH_MEDIX",name:"Lipa Medix",status:"REFERENCE_PENDING",institutionAnchors:[],anchors:{}},
 {id:"NLVILLA_REFERENCE_PENDING",version:"1",institutionId:"INST_SYNTH_NLVILLA",name:"N.L. Villa",status:"REFERENCE_PENDING",institutionAnchors:[],anchors:{}},
];
export const labelExtractionPreviewEnabled=import.meta.env.VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW==="true";
