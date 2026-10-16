import {describe,it,expect,vi,afterEach} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ApplicationDetails} from "../../features/auth/application-details";
import {catalog,selection,result} from "../../../e2e/public-application-fixtures";
import {ApiRequestError,requestJson,setCommandVerifier} from "./client";
import {applicationField,buildPublicApplication,createApplicantPassword,parseApplicationResult,parseSampleCatalog,parseSampleSelection,parseDocuments} from "./public-applications";
afterEach(()=>{setCommandVerifier();vi.unstubAllGlobals();});
describe("PUBLIC_APPLICATION_V1",()=>{
 for(const category of ["BLOOD_BANK","REQUESTOR"] as const){
  it(`${category} maps all five published samples and preserves reuse instance`,()=>{
   for(let i=0;i<5;i++){
    const data=parseSampleSelection(selection(category,i,2),category);expect(data.status).toBe("SELECTED");if(data.status!=="SELECTED")throw Error("Expected sample");
    const fields={...data.fields,password:createApplicantPassword()};
    const body=buildPublicApplication(category,fields,data.sample,data.documents,[true,true,true],true,"CORR_"+"A".repeat(32));
    expect(Object.keys(body).sort()).toEqual(["schemaVersion","category","sample","facility","qualification","primaryAccount","documents","declaration","correlationId"].sort());
    expect(body.sample?.instance).toBe(2);expect(body.primaryAccount.requestedLoginEmail).toContain("-i2.bloodledger");
    expect(body.facility).not.toHaveProperty("password");expect(body.primaryAccount).not.toHaveProperty("confirmation");
    expect(Object.keys(body.primaryAccount).sort()).toEqual(["applicantPosition","applicantReference","requestedLoginEmail","password"].sort());
    expect(body.qualification).not.toHaveProperty(category==="BLOOD_BANK"?"referralFacilityName":"headOfFacilityReference");
    expect(parseApplicationResult(result(category,body.sample,true),category,body.sample).replayed).toBe(true);
    expect(()=>parseApplicationResult(result(category,{...body.sample,instance:1}),category,body.sample)).toThrow();
   }
   expect(parseSampleCatalog(catalog(category),category).eligibleCount).toBe(5);
  });
 }
 it("never accepts server-generated passwords or filled declarations",()=>{
  const raw=selection("BLOOD_BANK");Object.assign(raw.fill.primaryAccount,{password:"SERVER_SECRET"});
  expect(()=>parseSampleSelection(raw,"BLOOD_BANK")).toThrow();
  const raw2=selection("REQUESTOR");Object.assign(raw2.fill.qualification,{capabilityDeclarations:{proceduresDocumented:true}});
  expect(()=>parseSampleSelection(raw2,"REQUESTOR")).toThrow();
 });
 it("rejects wrong-category or duplicate document fixtures, unknown enums and mismatched sample instances",()=>{
  expect(()=>parseDocuments([{slot:"BSF_LTO",fixtureId:"SYNTH_DOC_BSF_LTO_V1"}],"REQUESTOR")).toThrow();
  const raw=selection("BLOOD_BANK");raw.fill.facility.ownership="UNKNOWN";expect(()=>parseSampleSelection(raw,"BLOOD_BANK")).toThrow();
  expect(()=>parseSampleSelection(selection("BLOOD_BANK"),"REQUESTOR")).toThrow();
  const raw2=selection("REQUESTOR");raw2.sample.instance=0;expect(()=>parseSampleSelection(raw2,"REQUESTOR")).toThrow();
 });
 it("exhaustion is explicit and does not fabricate another sample",()=>{
  const raw={...catalog("REQUESTOR"),category:"REQUESTOR",eligibleCount:0,status:"EXHAUSTED",sample:null};expect(parseSampleSelection(raw,"REQUESTOR")).toEqual({status:"EXHAUSTED"});
 });
 it("requires human capability and final declarations",()=>{
  const data=parseSampleSelection(selection("REQUESTOR"),"REQUESTOR");if(data.status!=="SELECTED")throw Error();
  expect(()=>buildPublicApplication("REQUESTOR",data.fields,data.sample,data.documents,[true,false,true],true,"CORR_TEST")).toThrow();
  expect(()=>buildPublicApplication("REQUESTOR",data.fields,data.sample,data.documents,[true,true,true],false,"CORR_TEST")).toThrow();
  expect(createApplicantPassword()).not.toBe(createApplicantPassword());
 });
 it("maps structured errors to their exact step",()=>{
  expect(applicationField("facility.officialPhone")).toEqual({step:1,key:"officialPhone"});
  expect(applicationField("qualification.referralFacilityName")).toEqual({step:2,key:"referralFacility"});
  expect(applicationField("primaryAccount.password")).toEqual({step:3,key:"password"});
  expect(applicationField("documents[0].fixtureId").step).toBe(4);
 });
 it("retains field errors and Retry-After without attaching an operator grant to public submission",async()=>{
  const verifier=vi.fn();setCommandVerifier(verifier);
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"ONB_PUBLIC_RATE_LIMITED",message:"Try later",details:[{field:"facility.city",rule:"PATTERN"}]}}),{status:429,headers:{"Retry-After":"7"}})));
  await expect(requestJson("/api/v2/onboarding/public-applications",{method:"POST",headers:{"Idempotency-Key":"IDEM_TEST"},body:"{}"})).rejects.toMatchObject({code:"ONB_PUBLIC_RATE_LIMITED",retryAfter:7,details:[{field:"facility.city",rule:"PATTERN"}]});
  expect(verifier).not.toHaveBeenCalled();
 });
 it("read-only application details never render credential or unsupported fields",()=>{
  const raw=selection("BLOOD_BANK");const html=renderToStaticMarkup(createElement(ApplicationDetails,{value:{category:"BLOOD_BANK",detail:{...raw.fill,primaryAccount:{...raw.fill.primaryAccount,password:"DO_NOT_RENDER",operatorPin:"SECRET_PIN"}}}}));
  expect(html).toContain(raw.fill.facility.displayName);expect(html).not.toContain("DO_NOT_RENDER");expect(html).not.toContain("SECRET_PIN");
  expect(new ApiRequestError(409,"Conflict","ONB_SAMPLE_UNAVAILABLE").status).toBe(409);
 });
});
