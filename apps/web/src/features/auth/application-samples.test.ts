// FR-15: consistent synthetic application drafts without account creation.
import {describe,expect,it} from "vitest";
import {applicationSamples,chooseApplicationSample,createSampleDraft} from "./application-samples";

describe("application Fill Up samples",()=>{
 it("provides five distinct facility identities per category",()=>{
  expect(new Set(applicationSamples.map(sample=>sample.id)).size).toBe(10);
  expect(new Set(applicationSamples.map(sample=>sample.name)).size).toBe(10);
  for(const category of ["BLOOD_BANK","REQUESTOR"] as const)expect(applicationSamples.filter(sample=>sample.category===category)).toHaveLength(5);
 });
 for(const category of ["BLOOD_BANK","REQUESTOR"] as const){
  it(`${category} cycles without repeats and can preview samples again without registration`,()=>{
   let seen:string[]=[],current:string|undefined;
   const firstCycle:string[]=[];
   for(let i=0;i<5;i++){
    const selection=chooseApplicationSample(category,seen,current);
    expect(applicationSamples.find(sample=>sample.id===selection.id)?.category).toBe(category);
    expect(firstCycle).not.toContain(selection.id);
    firstCycle.push(selection.id);seen=selection.seen;current=selection.id;
   }
   const next=chooseApplicationSample(category,seen,current);
   expect(firstCycle).toContain(next.id);expect(next.id).not.toBe(current);expect(next.seen).toHaveLength(1);
  });
 }
 it("fills every catalog facility with consistent, synthetic values and fresh matching passwords",()=>{
  for(const sample of applicationSamples){
   const draft=createSampleDraft(sample.id),again=createSampleDraft(sample.id);
   expect(draft.fields.institutionDisplayName).toBe(sample.name);
   expect(draft.fields.legalName).toContain(sample.name);
   expect(draft.fields.genericContact).toMatch(/@.*\.example\.invalid$/);
   expect(draft.fields.accountEmail).toMatch(/@.*\.example\.invalid$/);
   expect(draft.fields.employeeReference).toMatch(/^SYNTH-/);
   expect(draft.fields.password.length).toBeGreaterThanOrEqual(12);
   expect(draft.confirmation).toBe(draft.fields.password);
   expect(again.fields.password).not.toBe(draft.fields.password);
   expect(Object.values(draft.fields).every(value=>value.trim().length>0)).toBe(true);
   expect(Object.values(draft.documents)).toHaveLength(3);
   for(const file of Object.values(draft.documents)){
    expect(file.name).toMatch(/\.txt$/);expect(file.content).toContain(sample.name);
    expect(file.content).toContain("BLOODLEDGER_SYNTHETIC_APPLICATION_DOCUMENT_V1");
   }
  }
 });
 it("rejects an unknown catalog identity",()=>{expect(()=>createSampleDraft("EXISTING_REAL_FACILITY")).toThrow("Unknown application sample");});
});
