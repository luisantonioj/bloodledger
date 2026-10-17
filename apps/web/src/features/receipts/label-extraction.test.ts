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

// PA-OCR-01 SYNTHETIC_LABEL_LAYOUT_V1: frozen fictional corpus layouts. A change to a layout or its shared value
// forms changes its SHA-256 and needs a new profile version, not an edit to these pins.
describe("SYNTHETIC_LABEL_LAYOUT_V1 corpus profiles (PA-OCR-01)",async()=>{
 const {createHash}=await import("node:crypto");
 const {default:layouts}=await import("../../../../../contracts/synthetic-label-layout-v1.json");
 const frozen:Record<string,string>={SYN_MEDIATRIX_LAYOUT:"d2f7e32f34b30a9f9c6ce4135c1aff046f8bff2238ce6ccae4d0ff29f857a8e4",SYN_MEDIX_LAYOUT:"a16303ec3cc23127b7755787bcef46afb6b011320e9fb79a2937dfd04fc1d502",SYN_NLVILLA_LAYOUT:"6946fcc1e2e635eb99af6db15a4a8071aa2d928925dd3a970ad51e9afcd3ed4f"};
 const vocabulary=LABEL_PROFILES.find(profile=>profile.id==="SYN_MEDIX_LAYOUT")!.vocabulary!;
 it("keeps each frozen profile version at its recorded SHA-256",()=>{
  const {profiles,...shared}=layouts;
  for(const profile of profiles){const canonical=JSON.stringify({schemaVersion:shared.schemaVersion,marker:shared.marker,timeCaption:shared.timeCaption,timeZoneOffset:shared.timeZoneOffset,dateFormats:shared.dateFormats,bloodTypeForms:shared.bloodTypeForms,componentForms:shared.componentForms,profile});
   expect([profile.id,profile.version,createHash("sha256").update(canonical,"utf8").digest("hex")]).toEqual([profile.id,"1",frozen[profile.id]]);}
  expect(profiles.map(profile=>profile.id).sort()).toEqual(Object.keys(frozen).sort());
 });
 it("maps only the closed PA-OCR-01 value forms onto the wire enums",()=>{
  expect(Object.values(layouts.bloodTypeForms).sort()).toEqual([...V2_BLOOD_TYPES].sort());expect([...new Set(Object.values(layouts.componentForms))].sort()).toEqual(["CRYOPRECIPITATE","FRESH_FROZEN_PLASMA","PACKED_RED_BLOOD_CELLS","PLATELETS","WHOLE_BLOOD"]);
  expect(normalizeCandidate("bloodType","AB-",vocabulary).candidate).toBe("AB_NEGATIVE");expect(normalizeCandidate("bloodType","A POS",vocabulary).candidate).toBeNull();expect(normalizeCandidate("bloodType","0+",vocabulary).candidate).toBeNull();
  expect(normalizeCandidate("componentType","PLT",vocabulary).candidate).toBe("PLATELETS");expect(normalizeCandidate("componentType","Platelet",vocabulary).candidate).toBeNull();
  // Outside the corpus layouts, PLT is not a recognized abbreviation.
  expect(normalizeCandidate("componentType","PLT").candidate).toBeNull();
 });
 it("reads printed corpus times in the layout's own UTC+08:00 and never invents a time for a date",()=>{
  expect(normalizeCandidate("collectedAt","2026-10-01 08:00",vocabulary)).toEqual({candidate:"2026-10-01T00:00:00.000Z",precision:"INSTANT"});
  expect(normalizeCandidate("expiresAt","2026-11-01",vocabulary)).toMatchObject({candidate:"2026-11-01",precision:"DATE_ONLY"});
  for(const value of ["2026-02-30 08:00","2026-10-01 24:00","01/10/26 08:00"])expect(normalizeCandidate("collectedAt",value,vocabulary).candidate).toBeNull();
  // Without a corpus layout, a printed local time is not interpreted as Asia/Manila.
  expect(normalizeCandidate("collectedAt","2026-10-01 08:00").candidate).toBeNull();
 });
 it("detects a corpus layout by its bank line and reads values printed below its headings",()=>{
  const result=extractLabelReview([line("SYNTHETIC - NOT A HOSPITAL LABEL",5),line("BANK CODE: MEDIX",30),line("BLOOD GROUP",60),line("O-",85),line("UNIT NUMBER",115),line("SYNMEDIX-2026-7001",140),line("PRODUCT",170),line("FFP",195),line("EXPIRY",225),line("2026-11-01 17:30",250),line("DRAWN",280),line("2026-10-01",305)]);
  expect(result.extraction).toMatchObject({profileId:"SYN_MEDIX_LAYOUT",profileVersion:"1",profileStatus:"SYNTHETIC_CORPUS",previewOnly:true});
  expect(result.draft).toMatchObject({donationNumber:"SYNMEDIX-2026-7001",bloodType:"O_NEGATIVE",componentType:"FRESH_FROZEN_PLASMA",expiresAt:"2026-11-01T09:30:00.000Z",collectedAt:"2026-10-01"});
  expect(result.verified).toBeUndefined();expect(result.extraction!.warnings).toContain("Synthetic corpus layout (PA-OCR-01); not a hospital label format");
 });
});
