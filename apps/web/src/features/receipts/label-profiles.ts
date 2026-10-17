import syntheticLayouts from "../../../../../contracts/synthetic-label-layout-v1.json";
import type {LabelDraft} from "./scan-review-data";
export type LabelField=keyof LabelDraft;
// PA-OCR-01: closed value forms and the printed time zone of the fictional corpus layouts only.
export interface SyntheticVocabulary {bloodTypeForms:Record<string,string>;componentForms:Record<string,string>;timeZoneOffset:string}
export interface LabelProfile {id:string;version:string;institutionId:string;name:string;status:"DRAFT_REFERENCE"|"REFERENCE_PENDING"|"SYNTHETIC_CORPUS";institutionAnchors:string[];anchors:Partial<Record<LabelField,string[]>>;vocabulary?:SyntheticVocabulary}
export const FIELD_ANCHORS:Record<LabelField,string[]>={
 donationNumber:["DONATION NO","DONATION NUMBER"],bloodType:["ABO/RH TYPE","ABO RH TYPE","BLOOD TYPE","BLOOD GROUP"],componentType:["COMPONENT","BLOOD COMPONENT","PRODUCT TYPE"],collectedAt:["COLLECTION DATE","DATE OF COLLECTION","COLLECTED AT"],expiresAt:["EXPIRY DATE","EXPIRATION DATE","EXPIRES AT"],
};
// Reference-derived preview configuration, not an accepted issuer/clinical policy.
export const LABEL_PROFILES:LabelProfile[]=[
 {id:"MEDIATRIX_BAG_PREVIEW",version:"1",institutionId:"INST_MEDIATRIX",name:"Mary Mediatrix",status:"DRAFT_REFERENCE",institutionAnchors:["MARY MEDIATRIX"],anchors:FIELD_ANCHORS},
 {id:"MEDIX_REFERENCE_PENDING",version:"1",institutionId:"INST_SYNTH_MEDIX",name:"Lipa Medix",status:"REFERENCE_PENDING",institutionAnchors:[],anchors:{}},
 {id:"NLVILLA_REFERENCE_PENDING",version:"1",institutionId:"INST_SYNTH_NLVILLA",name:"N.L. Villa",status:"REFERENCE_PENDING",institutionAnchors:[],anchors:{}},
 // SYNTHETIC_LABEL_LAYOUT_V1 (PA-OCR-01): fictional corpus layouts, frozen by version and SHA-256. They identify a
 // layout for preview extraction only; they never establish an issuer and their results are never submittable.
 ...syntheticLayouts.profiles.map((layout):LabelProfile=>({id:layout.id,version:layout.version,institutionId:layout.institutionId,name:"Synthetic "+layout.bankCode+" layout",status:"SYNTHETIC_CORPUS",institutionAnchors:[layout.bankLine],
  anchors:Object.fromEntries(layout.fields.map(entry=>[entry.field,[entry.heading]])) as Partial<Record<LabelField,string[]>>,
  vocabulary:{bloodTypeForms:syntheticLayouts.bloodTypeForms,componentForms:syntheticLayouts.componentForms,timeZoneOffset:syntheticLayouts.timeZoneOffset}})),
];
export const labelExtractionPreviewEnabled=import.meta.env.VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW==="true";
