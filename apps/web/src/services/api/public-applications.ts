import {ApiRequestError,requestJson,retryAfterContextChange} from "./client";
import type {MutationKeys} from "./mutation-keys";
export type ApplicationCategory="BLOOD_BANK"|"REQUESTOR";
export interface SampleReference{catalogVersion:"SYNTHETIC_FACILITY_CATALOG_V1";sampleId:string;instance:number}
export interface ApplicationDocument{slot:string;fixtureId:string}
export const documentDefinitions=(bank:boolean)=>[
 {title:"Hospital / Health Facility LTO",slot:"HEALTH_FACILITY_LTO",fixtureId:"SYNTH_DOC_HEALTH_FACILITY_LTO_V1",required:true},
 ...(bank?[
 {title:"DOH Blood Service Facility LTO",slot:"BSF_LTO",fixtureId:"SYNTH_DOC_BSF_LTO_V1",required:true},
 {title:"BSF assessment, personnel and equipment documents",slot:"BSF_ASSESSMENT_PACKAGE",fixtureId:"SYNTH_DOC_BSF_ASSESSMENT_PACKAGE_V1",required:true},
 ]:[
 {title:"Blood Station ATO or transfusion-service authorization",slot:"BLOOD_STATION_AUTHORIZATION",fixtureId:"SYNTH_DOC_BLOOD_STATION_AUTHORIZATION_V1",required:true},
 {title:"Referral agreement or facility capability documents",slot:"REFERRAL_AGREEMENT",fixtureId:"SYNTH_DOC_REFERRAL_AGREEMENT_V1",required:false},
 ])];
const facilityMap={displayName:"institutionDisplayName",legalName:"legalName",ownership:"ownership",facilityClassification:"facilityClassification",streetAddress:"address",city:"locality",province:"province",officialPhone:"officialPhone",officialEmail:"genericContact",facilityLicenseReference:"facilityLto",facilityLicenseExpiresOn:"facilityLtoExpiration"};
const qualificationMap={authorityReference:"licenseReference",authorityExpiresOn:"authorityExpiration",medicalTechnologistReference:"technologist",medicalTechnologistLicenseReference:"technologistLicense",applicationReason:"applicationReason"};
const bankMap={bsfCategory:"bsfCategory",headOfFacilityReference:"facilityHead",headOfFacilityLicenseReference:"physicianLicense"};
const requestorMap={referralFacilityName:"referralFacility"};
const accountMap={applicantPosition:"officialPosition",applicantReference:"applicantReference",requestedLoginEmail:"accountEmail"};
export const identityKeys=new Set(["institutionDisplayName","legalName","genericContact","facilityLto","licenseReference","accountEmail"]);
const invalid=()=>new Error("Application data is unavailable or incompatible. Refresh to try again.");
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw invalid();return value as Record<string,unknown>;}
function text(value:unknown){if(typeof value!=="string"||!value.trim())throw invalid();return value;}
function category(value:unknown):ApplicationCategory{if(value!=="BLOOD_BANK"&&value!=="REQUESTOR")throw invalid();return value;}
function sameKeys(row:Record<string,unknown>,keys:string[]){if(Object.keys(row).some(key=>!keys.includes(key))||keys.some(key=>!(key in row)))throw invalid();}
export function parseSample(value:unknown,expected:ApplicationCategory):SampleReference{
 const row=object(value);sameKeys(row,["catalogVersion","sampleId","instance"]);
 if(row.catalogVersion!=="SYNTHETIC_FACILITY_CATALOG_V1"||typeof row.sampleId!=="string"||!new RegExp(`^SAMPLE_${expected==="BLOOD_BANK"?"BANK":"REQUESTOR"}_0[1-5]$`).test(row.sampleId)||!Number.isSafeInteger(row.instance)||Number(row.instance)<1||Number(row.instance)>99)throw invalid();
 return row as unknown as SampleReference;
}
function mapRead(value:unknown,map:Record<string,string>){const row=object(value);sameKeys(row,Object.keys(map));return Object.fromEntries(Object.entries(map).map(([key,field])=>[field,text(row[key])]));}
function mapWrite(fields:Record<string,string>,map:Record<string,string>){return Object.fromEntries(Object.entries(map).map(([key,field])=>[key,fields[field]??""]));}
export function createApplicantPassword(){return "Sample-"+Array.from(crypto.getRandomValues(new Uint8Array(18)),value=>value.toString(16).padStart(2,"0")).join("");}
export function parseSampleSelection(value:unknown,expected:ApplicationCategory){
 const row=object(value);
 if(row.catalogVersion!=="SYNTHETIC_FACILITY_CATALOG_V1"||category(row.category)!==expected||row.classification!=="SIMULATION_ONLY"||!Number.isSafeInteger(row.eligibleCount)||Number(row.eligibleCount)<0||Number(row.eligibleCount)>5)throw invalid();
 if(row.status==="EXHAUSTED"&&row.sample===null&&row.eligibleCount===0)return {status:"EXHAUSTED" as const};
 if(row.status!=="SELECTED"||Number(row.eligibleCount)<1||typeof row.repeated!=="boolean")throw invalid();
 const sample=parseSample(row.sample,expected),fill=object(row.fill);
 sameKeys(fill,["category","facility","qualification","primaryAccount","documents"]);
 if(fill.category!==expected||!Array.isArray(row.notFilled)||row.notFilled.length!==3||!["primaryAccount.password","qualification.capabilityDeclarations","declaration"].every(key=>(row.notFilled as unknown[]).includes(key)))throw invalid();
 const fields={...mapRead(fill.facility,facilityMap),...mapRead(fill.qualification,{...qualificationMap,...(expected==="BLOOD_BANK"?bankMap:requestorMap)}),...mapRead(fill.primaryAccount,accountMap)};
 if(!["PRIVATE","GOVERNMENT"].includes(fields.ownership)||!["LEVEL_1_HOSPITAL","LEVEL_2_HOSPITAL","LEVEL_3_HOSPITAL","OTHER_LICENSED_HEALTH_FACILITY"].includes(fields.facilityClassification)||fields.officialPosition!==(expected==="BLOOD_BANK"?"BLOOD_BANK_HEAD":"FACILITY_ADMINISTRATOR")||(expected==="BLOOD_BANK"&&!["BLOOD_BANK","BLOOD_BANK_WITH_ADDITIONAL_FUNCTIONS","BLOOD_CENTER"].includes(fields.bsfCategory)))throw invalid();
 for(const key of ["facilityLtoExpiration","authorityExpiration"])if(!/^\d{4}-\d{2}-\d{2}$/.test(fields[key])||!Number.isFinite(Date.parse(fields[key])))throw invalid();
 const documents=parseDocuments(fill.documents,expected,true);
 return {status:"SELECTED" as const,sample,fields,documents,repeated:row.repeated};
}
export function parseDocuments(value:unknown,expected:ApplicationCategory,requireAll=false):Record<string,ApplicationDocument>{
 if(!Array.isArray(value)||value.length>3)throw invalid();
 const definitions=documentDefinitions(expected==="BLOOD_BANK"),result:Record<string,ApplicationDocument>={};
 for(const entry of value){const row=object(entry);sameKeys(row,["slot","fixtureId"]);const definition=definitions.find(item=>item.slot===row.slot);if(!definition||row.fixtureId!==definition.fixtureId||result[definition.slot])throw invalid();result[definition.slot]={slot:definition.slot,fixtureId:definition.fixtureId};}
 if(definitions.some(item=>(requireAll||item.required)&&!result[item.slot]))throw invalid();return result;
}
export function parseSampleCatalog(value:unknown,expected:ApplicationCategory){
 const row=object(value);if(row.catalogVersion!=="SYNTHETIC_FACILITY_CATALOG_V1"||row.classification!=="SIMULATION_ONLY"||!Array.isArray(row.samples)||row.samples.length!==5)throw invalid();
 const ids=new Set<string>();let eligible=0;
 for(const entry of row.samples){const item=object(entry);if(item.category!==expected||typeof item.sampleId!=="string"||!new RegExp(`^SAMPLE_${expected==="BLOOD_BANK"?"BANK":"REQUESTOR"}_0[1-5]$`).test(item.sampleId)||ids.has(item.sampleId)||!text(item.displayName).startsWith("Synthetic ")||!["ELIGIBLE","APPLICATION_IN_PROGRESS","REGISTERED","INSTANCES_EXHAUSTED"].includes(String(item.availability)))throw invalid();ids.add(item.sampleId);if(item.availability==="ELIGIBLE")eligible++;}
 if(eligible!==row.eligibleCount)throw invalid();return {eligibleCount:eligible};
}
export function buildPublicApplication(category:ApplicationCategory,fields:Record<string,string>,sample:SampleReference|null,documents:Record<string,ApplicationDocument>,declarations:boolean[],attested:boolean,correlationId:string){
 if(!attested||declarations.length!==3||declarations.some(value=>!value))throw Error("Review and confirm every declaration before submitting.");
 const definitions=documentDefinitions(category==="BLOOD_BANK");if(definitions.some(item=>item.required&&!documents[item.slot]))throw Error("Attach every required synthetic fixture before submitting.");
 const docs=definitions.filter(item=>documents[item.slot]).map(item=>documents[item.slot]);parseDocuments(docs,category);
 return {schemaVersion:"PUBLIC_APPLICATION_V1",category,sample,facility:mapWrite(fields,facilityMap),qualification:{...mapWrite(fields,{...qualificationMap,...(category==="BLOOD_BANK"?bankMap:requestorMap)}),capabilityDeclarations:{proceduresDocumented:true,personnelEquipmentContinuity:true,verificationConsent:true}},primaryAccount:{applicantPosition:fields.officialPosition??"",applicantReference:fields.applicantReference??"",requestedLoginEmail:fields.accountEmail??"",password:fields.password??""},documents:docs,declaration:{syntheticDataOnly:true,accuracyAttested:true},correlationId};
}
export function parseApplicationResult(value:unknown,expected:ApplicationCategory,expectedSample?:SampleReference|null){
 const row=object(value);if(row.schemaVersion!=="PUBLIC_APPLICATION_V1"||row.category!==expected||row.classification!=="SIMULATION_ONLY"||typeof row.applicationId!=="string"||!/^ONB_[A-F0-9]{40}$/.test(row.applicationId)||row.status!=="SUBMITTED"||row.version!==1||(row.replayed!==undefined&&row.replayed!==true))throw invalid();
 const actualSample=row.sample===null?null:parseSample(row.sample,expected);if(expectedSample!==undefined&&(Boolean(actualSample)!==Boolean(expectedSample)||actualSample?.catalogVersion!==expectedSample?.catalogVersion||actualSample?.sampleId!==expectedSample?.sampleId||actualSample?.instance!==expectedSample?.instance))throw invalid();return {applicationId:row.applicationId,replayed:row.replayed===true};
}
export const publicApplicationsEnabled=import.meta.env.VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY==="true";
export const readPublicSamples=(category:ApplicationCategory,signal:AbortSignal,active:()=>boolean)=>retryAfterContextChange(()=>requestJson<unknown>("/api/v2/onboarding/sample-facilities?"+new URLSearchParams({category}),{signal,cache:"no-store"}),active);
export const selectPublicSample=(category:ApplicationCategory,exclude:string|undefined,signal:AbortSignal,active:()=>boolean)=>retryAfterContextChange(()=>requestJson<unknown>("/api/v2/onboarding/sample-facilities/selection?"+new URLSearchParams({category,...(exclude?{exclude}:{})}),{signal,cache:"no-store"}),active);
export const submitPublicApplication=(keys:MutationKeys,payload:unknown)=>requestJson<unknown>("/api/v2/onboarding/public-applications",{method:"POST",headers:{"Idempotency-Key":keys.idempotencyKey},body:JSON.stringify(payload)});
export function applicationField(field:string){
 const [group,key]=field.split(".");
 if(group==="facility")return {step:1,key:facilityMap[key as keyof typeof facilityMap]??""};
 if(group==="qualification")return {step:2,key:{...qualificationMap,...bankMap,...requestorMap}[key as keyof typeof qualificationMap]??key};
 if(group==="primaryAccount")return {step:3,key:key==="password"?"password":accountMap[key as keyof typeof accountMap]??""};
 return {step:4,key:field};
}
export function applicationError(reason:unknown){
 const code=reason instanceof ApiRequestError?reason.code:undefined;
 const messages:Record<string,string>={
 ONB_APPLICATION_INVALID:"Review the highlighted fields.",ONB_SCHEMA_UNSUPPORTED:"The application form needs an update. Please try again later.",ONB_CATEGORY_UNSUPPORTED:"The application category is not supported.",ONB_SAMPLE_UNKNOWN:"This sample reference is no longer available. Use Fill Up again.",ONB_SAMPLE_CATEGORY_MISMATCH:"Choose a new sample for this facility type.",ONB_SAMPLE_METADATA_MISMATCH:"Sample identity changed. Continue manually with a different facility identity, or use Fill Up again.",ONB_SAMPLE_UNAVAILABLE:"This sample facility was just used by another application. Use Fill Up to choose another.",ONB_SAMPLE_STALE:"The sample catalog or instance changed. Use Fill Up again.",ONB_SAMPLE_IDENTITY_RESERVED:"This identity belongs to a sample facility. Use Fill Up for it or enter another facility identity.",ONB_DUPLICATE_APPLICATION:"An application for this facility is already in progress or registered. Check its application status.",ONB_IDEMPOTENCY_CONFLICT:"The attempt key conflicts with a different request. Review and submit again with a new key.",ORIGIN_FORBIDDEN:"Application submission is unavailable because of the site configuration.",ONB_PUBLIC_RATE_LIMITED:"Too many requests. Try again later.",
 };
 return messages[code??""]??(reason instanceof ApiRequestError&&reason.status===404?"Public applications are not available on this server yet.":"The application service is unavailable. Please try again.");
}
