import {describe,it,expect} from "vitest";
import {extractLabelReview,normalizeCandidate,mergeFieldReview,type OcrLine} from "./label-extraction";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {LABEL_PROFILES} from "./label-profiles";
import {locateFieldRegions} from "./field-regions";
import {defaultPreparation,validatePreparation} from "./label-image-preparation";
const profileId="MEDIATRIX_BAG_PREVIEW";
const line=(text:string,y:number,x=10):OcrLine=>({text,confidence:94,bbox:{x0:x,y0:y,x1:x+200,y1:y+20}});
describe("synthetic label extraction preview, FR-02 / RQ-02 / RQ-19",()=>{
 it("associates printed headings with values below and preserves partial success",()=>{
  const result=extractLabelReview([line("Donation No.",10),line("MM26-10-7001",35),line("Blood Type",65),line("B positive",90),line("Collection Date",120),line("10/12/26",145),line("Expiry Date",175),line("2026-11-01",200)],{profileId});
  expect(result.draft).toMatchObject({donationNumber:"MM26-10-7001",bloodType:"B_POSITIVE",componentType:"",collectedAt:"",expiresAt:"2026-11-01"});
  expect(result.extraction!.fields.collectedAt.precision).toBe("AMBIGUOUS");expect(result.extraction!.fields.expiresAt.precision).toBe("DATE_ONLY");expect(result.extraction!.fields.componentType.state).toBe("missing");expect(result.verified).toBeUndefined();
 });
 it("recognizes approved-vocabulary aliases without guessing component, issuer or date",()=>{
  expect(normalizeCandidate("bloodType","AB negative").candidate).toBe("AB_NEGATIVE");
  expect(normalizeCandidate("bloodType","0+").candidate).toBeNull();
  expect(normalizeCandidate("componentType","450 ml red bag").candidate).toBeNull();
  expect(normalizeCandidate("componentType","Cryo").candidate).toBe("CRYOPRECIPITATE");
  expect(normalizeCandidate("collectedAt","2026-02-30T00:00:00Z").candidate).toBeNull();
  expect(normalizeCandidate("collectedAt","2026-10-01T08:00:00+08:00").candidate).toBe("2026-10-01T00:00:00.000Z");
 });
 it("rejects conflicting operational values and excludes manufacturer identifiers",()=>{
  const result=extractLabelReview([line("Donation No: MM26-10-7001",10),line("Donation No: MM26-10-7002",40),line("LOT: 999999",70),line("CATALOG: 333333",100),line("BLOOD TYPE: A+",130)],{profileId});
  expect(result.draft.donationNumber).toBe("");expect(result.extraction!.fields.donationNumber.state).toBe("needs review");expect(result.draft.bloodType).toBe("A_POSITIVE");expect(result.verified).toBeUndefined();
 });
 it("does not fabricate missing bank profiles or infer an issuer from branding",()=>{
  expect(LABEL_PROFILES.filter(row=>row.status==="REFERENCE_PENDING")).toHaveLength(2);
  for(const profile of LABEL_PROFILES.filter(row=>row.status==="REFERENCE_PENDING"))expect(extractLabelReview([line("Donation No: MM26-10-7001",10)],{profileId:profile.id}).draft.donationNumber).toBe("");
  expect(extractLabelReview([line("KARMI",10),line("Donation No: MM26-10-7001",40)]).extraction!.profileStatus).toBe("UNKNOWN");
 });
 it("guided recapture replaces only one original field and never preserves verified authority",()=>{
  const previous=extractLabelReview([line("Blood type: A+",10),line("Donation No: MM26-10-7001",50)],{profileId});
  const next=extractLabelReview([line("B positive",10)],{field:"bloodType"});
  const merged=mergeFieldReview(previous,next,"bloodType");
  expect(merged.draft.bloodType).toBe("B_POSITIVE");expect(merged.draft.donationNumber).toBe("MM26-10-7001");expect(merged.extraction!.fields.donationNumber.confidence).toBe(94);expect(merged.verified).toBeUndefined();
 });
 it("preserves engine score precision and does not create confidence for an invalid score",()=>{
  const result=extractLabelReview([{text:"Blood type: A+",confidence:89.7}],{profileId});expect(result.extraction!.fields.bloodType.confidence).toBe(89.7);expect(result.extraction!.fields.bloodType.state).toBe("needs review");
  expect(extractLabelReview([{text:"Blood type: A+",confidence:101}],{profileId}).extraction!.fields.bloodType.confidence).toBeNull();
 });
 it("maps all forty canonical product combinations without granting verification",()=>{
  for(const blood of V2_BLOOD_TYPES)for(const component of V2_COMPONENT_TYPES){const result=extractLabelReview([line("Blood type: "+blood,10),line("Component: "+component,50)],{profileId});expect(result.draft.bloodType).toBe(blood);expect(result.draft.componentType).toBe(component);expect(result.verified).toBeUndefined();}
 });
 it("prohibited text cannot be retained in review evidence",()=>{expect(()=>extractLabelReview([line("PATIENT: example",10)],{profileId})).toThrow("CAPTURE_PROHIBITED_TEXT");});
 it("bounds field windows and refuses windows for unsupported profiles",()=>{
  const lines=[line("Blood Type",10),line("Expiry Date",80)];const windows=locateFieldRegions(lines,profileId,600,200);
  expect(windows[0].box.y1).toBeLessThan(80);expect(windows.every(row=>row.box.x1<=600&&row.box.y1<=200)).toBe(true);expect(locateFieldRegions(lines,"MEDIX_REFERENCE_PENDING",600,200)).toEqual([]);
 });
 it("validates local image transforms before decoding",()=>{expect(validatePreparation(defaultPreparation())).toEqual(defaultPreparation());expect(()=>validatePreparation({...defaultPreparation(),crop:{x:90,y:0,width:20,height:100}})).toThrow();expect(()=>validatePreparation({...defaultPreparation(),deskew:11})).toThrow();});
});
