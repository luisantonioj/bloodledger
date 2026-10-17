import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {LABEL_PROFILES,FIELD_ANCHORS,type LabelField,type LabelProfile} from "./label-profiles";
import {emptyLabel,type ScanReview} from "./scan-review-data";
export interface OcrBox {x0:number;y0:number;x1:number;y1:number}
export interface OcrLine {text:string;confidence:number;bbox?:OcrBox}
export type DatePrecision="INSTANT"|"DATE_ONLY"|"AMBIGUOUS"|"UNKNOWN";
export interface FieldSuggestion {candidate:string|null;recognizedValue:string|null;confidence:number|null;state:"recognized"|"needs review"|"missing";source:"OCR_REGION"|"OPERATOR_REGION";precision:DatePrecision;box?:OcrBox;image?:File;issue?:string}
export interface ExtractionEvidence {profileId:string|null;profileVersion:string|null;profileStatus:LabelProfile["status"]|"UNKNOWN";engineVersion:"7.0.0";previewOnly:true;fields:Record<LabelField,FieldSuggestion>;warnings:string[]}
const keys=Object.keys(FIELD_ANCHORS) as LabelField[];
function normalized(value:string){return value.toUpperCase().replace(/[.]/g,"").replace(/\s+/g," ").trim();}
export function normalizeCandidate(field:LabelField,value:string):{candidate:string|null;precision:DatePrecision;issue?:string}{
 const raw=value.trim(),text=normalized(raw);if(!raw)return {candidate:null,precision:"UNKNOWN"};
 if(field==="bloodType"){
  const match=/^(AB|A|B|O)\s*(POSITIVE|NEGATIVE|POS|NEG|\+|-)$/i.exec(raw);
  const candidate=V2_BLOOD_TYPES.includes(raw as typeof V2_BLOOD_TYPES[number])?raw:match?`${match[1].toUpperCase()}_${["POSITIVE","POS","+"].includes(match[2].toUpperCase())?"POSITIVE":"NEGATIVE"}`:null;
  return {candidate,precision:"UNKNOWN",...(!candidate?{issue:"Unrecognized blood group"}:{})};
 }
 if(field==="componentType"){
  const aliases:Record<string,string>={"WHOLE BLOOD":"WHOLE_BLOOD","PRBC":"PACKED_RED_BLOOD_CELLS","PACKED RED BLOOD CELLS":"PACKED_RED_BLOOD_CELLS","FFP":"FRESH_FROZEN_PLASMA","FRESH FROZEN PLASMA":"FRESH_FROZEN_PLASMA","PLATELETS":"PLATELETS","CRYO":"CRYOPRECIPITATE","CRYOPRECIPITATE":"CRYOPRECIPITATE"};
  const candidate=V2_COMPONENT_TYPES.includes(raw as typeof V2_COMPONENT_TYPES[number])?raw:aliases[text]??null;return {candidate,precision:"UNKNOWN",...(!candidate?{issue:"Component must be explicitly identified"}:{})};
 }
 if(field==="donationNumber")return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(raw)?{candidate:raw,precision:"UNKNOWN"}:{candidate:null,precision:"UNKNOWN",issue:"Review identifier exactly; characters are not auto-corrected"};
 const timestamp=Date.parse(raw);
 const datePart=/^(\d{4})-(\d\d)-(\d\d)/.exec(raw);
 const calendarValid=Boolean(datePart&&new Date(Date.UTC(Number(datePart[1]),Number(datePart[2])-1,Number(datePart[3]))).toISOString().slice(0,10)===datePart[0]);
 if(calendarValid&&Number.isFinite(timestamp)&&/^\d{4}-\d\d-\d\dT/.test(raw)&&/(Z|[+-]\d\d:\d\d)$/.test(raw))return {candidate:new Date(timestamp).toISOString(),precision:"INSTANT"};
 if(/^\d{4}-\d\d-\d\d$/.test(raw)&&Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===raw)return {candidate:raw,precision:"DATE_ONLY",issue:"Date only; time and expiry interpretation are not established"};
 return {candidate:null,precision:"AMBIGUOUS",issue:"Date format or century/time is unresolved; no timestamp inferred"};
}
function findAnchor(line:OcrLine,anchors:Partial<Record<LabelField,string[]>>){
 const text=normalized(line.text);
 for(const field of keys)for(const anchor of [...(anchors[field]??[])].sort((a,b)=>b.length-a.length)){
  if(text===anchor||text.startsWith(anchor+":")||text.startsWith(anchor+" ")||text.startsWith(anchor+"/")){
   const remainder=line.text.trim().slice(anchor.length).replace(/^[\s.:/]+/,"");
   // Multilingual printed headings are anchors; their translation is not a value.
   return {field,remainder:remainder.includes("/")&&!/^\d/.test(remainder)?"":remainder};
  }
 }
 return undefined;
}
function validBox(box:OcrBox|undefined):box is OcrBox{return Boolean(box&&Object.values(box).every(Number.isFinite)&&box.x0>=0&&box.y0>=0&&box.x1>box.x0&&box.y1>box.y0);}
export function extractLabelReview(lines:OcrLine[],options:{profileId?:string;field?:LabelField;capturedAt?:string}={}):ScanReview{
 if(lines.some(line=>/\b(PATIENT|DONOR|DIAGNOSIS|TREATMENT|EMPLOYEE)\b/i.test(line.text)))throw Error("CAPTURE_PROHIBITED_TEXT");
 const text=normalized(lines.map(line=>line.text).join(" "));
 const matches=LABEL_PROFILES.filter(profile=>profile.institutionAnchors.some(anchor=>text.includes(anchor)));
 const profile=options.profileId?LABEL_PROFILES.find(row=>row.id===options.profileId):matches.length===1?matches[0]:undefined;
 const warnings:string[]=[];
 if(options.profileId&&!profile)warnings.push("Unknown label profile");
 if(matches.length>1)warnings.push("Conflicting institution anchors; select a profile or field crop manually");
 if(!profile)warnings.push("Unsupported layout: use a guided field crop or Manual review");
 if(profile?.status==="REFERENCE_PENDING")warnings.push("This hospital’s layout reference and evaluation are pending; use a guided field crop");
 if(options.profileId)warnings.push("Profile selected manually; issuing institution is not verified");
 const buckets=Object.fromEntries(keys.map(key=>[key,[]])) as unknown as Record<LabelField,{value:string;confidence:number;box?:OcrBox}[]>;
 const anchorMap=profile?.status==="DRAFT_REFERENCE"?profile.anchors:{};
 for(let index=0;index<lines.length;index++){
  const line=lines[index],anchor=findAnchor(line,anchorMap);if(!anchor)continue;
  if(anchor.remainder){buckets[anchor.field].push({value:anchor.remainder,confidence:line.confidence,box:validBox(line.bbox)?line.bbox:undefined});continue;}
  const box=validBox(line.bbox)?line.bbox:undefined;
  if(!box){warnings.push("OCR position evidence missing; use a guided field crop");continue;}
  const height=box.y1-box.y0;
  const nextAnchor=lines.filter(row=>row!==line&&validBox(row.bbox)&&findAnchor(row,anchorMap)&&row.bbox.y0>=box.y1&&row.bbox.x0<box.x1&&row.bbox.x1>box.x0).map(row=>row.bbox!.y0);
  const bottom=Math.min(box.y1+height*4,...nextAnchor);
  for(const candidate of lines){
   if(!validBox(candidate.bbox)||findAnchor(candidate,anchorMap)||candidate.bbox.y0<box.y1||candidate.bbox.y0>=bottom||candidate.bbox.x0>=box.x1||candidate.bbox.x1<=box.x0)continue;
   if(/\b(LOT|CATALOG|CATALOGUE|MANUFACTUR|CPDA|SCREENING|ML|CONTENTS?)\b/i.test(candidate.text))continue;
   buckets[anchor.field].push({value:candidate.text,confidence:candidate.confidence,box:candidate.bbox});
  }
 }
 if(options.field){
  // In guided mode the user crops exactly one operational value; never search arbitrary numbers.
  const candidates=lines.filter(line=>line.text.trim()&&!findAnchor(line,FIELD_ANCHORS));
  if(candidates.length===1)buckets[options.field]=[{value:candidates[0].text,confidence:candidates[0].confidence,box:validBox(candidates[0].bbox)?candidates[0].bbox:undefined}];
  else if(candidates.length>1){buckets[options.field]=candidates.map(line=>({value:line.text,confidence:line.confidence,box:validBox(line.bbox)?line.bbox:undefined}));}
 }
 const draft=emptyLabel(),confidences:ScanReview["confidences"]={};
 const fields={} as ExtractionEvidence["fields"];
 for(const field of keys){
  const candidates=buckets[field],unique=[...new Set(candidates.map(item=>item.value.trim()))];
  if(unique.length!==1){fields[field]={candidate:null,recognizedValue:null,confidence:null,state:unique.length?"needs review":"missing",source:options.field===field?"OPERATOR_REGION":"OCR_REGION",precision:"UNKNOWN",...(unique.length?{issue:"Conflicting values; recapture this field"}:{})};continue;}
  const items=candidates.filter(item=>item.value.trim()===unique[0]),confidence=items.every(item=>Number.isFinite(item.confidence)&&item.confidence>=0&&item.confidence<=100)?Math.min(...items.map(item=>item.confidence)):null;
  const value=normalizeCandidate(field,unique[0]);
  fields[field]={...value,recognizedValue:unique[0],confidence,state:value.candidate&&confidence!==null&&confidence>=90&&!(value.precision==="DATE_ONLY")?"recognized":"needs review",source:options.field===field?"OPERATOR_REGION":"OCR_REGION",box:items.find(item=>item.box)?.box};
  draft[field]=value.candidate??"";if(confidence!==null)confidences[field]=confidence;
 }
 return {draft,confidences,verified:undefined,image:undefined,capturedAt:options.capturedAt??new Date().toISOString(),extraction:{profileId:profile?.id??null,profileVersion:profile?.version??null,profileStatus:profile?.status??"UNKNOWN",engineVersion:"7.0.0",previewOnly:true,fields,warnings:[...new Set(warnings)]}};
}

// A guided recapture replaces only that field. Each crop keeps its own volatile image.
// Neither merged nor manually edited evidence can inherit legacy verification.
export function mergeFieldReview(previous:ScanReview|undefined,next:ScanReview,field:LabelField):ScanReview{
 if(!previous?.extraction||!next.extraction)return next;
 const fields={...previous.extraction.fields};
 for(const key of keys)fields[key]={...fields[key],image:fields[key].image??previous.image};
 fields[field]={...next.extraction.fields[field],image:next.image};
 return {...next,draft:{...previous.draft,[field]:next.draft[field]},confidences:{...previous.confidences,[field]:next.confidences[field]},verified:undefined,
  extraction:{...previous.extraction,fields,warnings:[...new Set([...previous.extraction.warnings,...next.extraction.warnings])]},
  // The editable draft is held separately by the workspace; original values remain immutable.
 };
}
