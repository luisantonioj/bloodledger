// FR-03 / FR-12: institution sign-in must render first inventory without waiting for polling.
import {test,expect} from "@playwright/test";
import {labelFixture} from "./fixtures/transaction-reads";

test("institution login on /inventory displays its label on the first load without a refresh error",async({page})=>{
  let signedIn=false, logins=0, componentReads=0, domainPosts=0;
  const principal={userId:"USR_SYNTH_LOGIN",accountId:"USR_SYNTH_LOGIN",accountCategory:"BLOOD_BANK",verificationRequired:true,institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic bank",displayName:"Synthetic institution account",roleId:"ROLE-02",roleDisplayName:"Synthetic blood bank",operators:[],permissions:["inventory:read"],classification:"SIMULATION_ONLY"};
  await page.addInitScript(()=>{
    const state=window as typeof window & {inventoryRefreshNoticeSeen?:boolean};
    state.inventoryRefreshNoticeSeen=false;
    document.addEventListener("DOMContentLoaded",()=>{
      new MutationObserver(()=>{if(document.body.textContent?.includes("Inventory could not refresh"))state.inventoryRefreshNoticeSeen=true;}).observe(document.body,{childList:true,subtree:true,characterData:true});
    });
  });
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname, method=route.request().method();
    const send=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
    if(path==="/api/v1/auth/session"){
      if(method==="POST"){logins++;signedIn=true;return send({principal});}
      return signedIn?send({principal}):send({error:{code:"AUTH_REQUIRED"}},401);
    }
    if(method!=="GET")domainPosts++;
    if(!signedIn)return send({error:{code:"AUTH_REQUIRED"}},401);
    if(path==="/api/v2/components"){
      componentReads++;
      return send({scope:"INSTITUTION",classification:"SIMULATION_ONLY",components:[{componentId:"COMP_SYNTH_LOGIN",donationId:"DON_SYNTH_LOGIN",issuerInstitutionId:"INST_MEDIATRIX",institutionId:"INST_MEDIATRIX",componentType:"WHOLE_BLOOD",bloodType:"AB_POSITIVE",collectedAt:"2026-10-01T00:00:00Z",expiresAt:"2026-11-01T00:00:00Z",inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"SYNTHETIC_TEST",classification:"SIMULATION_ONLY",labelIdentity:labelFixture}]});
    }
    if(path==="/api/v2/reports/inbound-intake")return send({scope:"INSTITUTION",statuses:{},includedInventoryStatuses:["COMMITTED"],excludedFromInventory:["QUEUED"],classification:"SIMULATION_ONLY"});
    return send({error:{code:"UNAVAILABLE"}},404);
  });
  await page.goto("/inventory");
  await page.getByLabel("Institution email or username",{exact:true}).fill("synthetic-bank@example.test");
  await page.getByLabel("Password",{exact:true}).fill("SYNTHETIC_TEST_PASSWORD");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.locator(".inventory-table").getByRole("button",{name:"Open component COMP_SYNTH_LOGIN",exact:true})).toHaveText(labelFixture.value,{timeout:2500});
  await expect(page.getByText("Inventory could not refresh",{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as typeof window & {inventoryRefreshNoticeSeen?:boolean}).inventoryRefreshNoticeSeen)).toBe(false);
  expect(logins).toBe(1);
  expect(componentReads).toBeGreaterThan(0);
  expect(componentReads).toBeLessThanOrEqual(2);
  expect(domainPosts).toBe(0);
});
