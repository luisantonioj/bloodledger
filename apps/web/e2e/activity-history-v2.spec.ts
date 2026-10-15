import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {activityFixture,prcActivityFixture,readPage} from "./fixtures/transaction-reads";
async function setup(page:Page,mode="v2"){
 const calls:string[]=[];let secondFailure=true;
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url()),send=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  if(url.pathname==="/api/v1/auth/session")return send({principal:{accountId:"USR_SYNTH",accountCategory:"BLOOD_BANK",userId:"USR_SYNTH",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic bank",displayName:"Synthetic viewer",roleId:"ROLE-02",roleDisplayName:"Synthetic role",operators:[],permissions:["audit:read"],classification:"SIMULATION_ONLY"}});
  if(url.pathname!=="/api/v2/activity-history")return send({error:{code:"UNAVAILABLE"}},503);
  calls.push(url.search);
  if(mode==="401"||mode==="403")return send({error:{code:mode==="401"?"AUTH_REQUIRED":"FORBIDDEN"}},Number(mode));
  if(mode==="fallback"&&url.searchParams.get("contract")==="ACTIVITY_HISTORY_READ_V2")return send({error:{code:"ACTIVITY_CONTRACT_UNSUPPORTED"}},400);
  if(mode==="fallback")return send(readPage("ACTIVITY_HISTORY_READ_V1",[activityFixture]));
  if(mode==="mismatch")return send(readPage("ACTIVITY_HISTORY_READ_V1",[activityFixture]));
  const cursor=url.searchParams.get("cursor");
  if(cursor&&secondFailure){secondFailure=false;return send({error:{code:"UNAVAILABLE"}},503);}
  if(cursor)expect(cursor).toBe("ACT2_NEXT");
  const rows=cursor?[{...prcActivityFixture,eventId:"AUD_SYNTH2",eventTime:"2026-10-15T00:01:00.721Z",recordedAt:"2026-10-15T00:01:00.721Z"}]:[{...activityFixture,recordedAt:"2026-10-15T00:01:00.723Z",actor:{...activityFixture.actor,institutionId:"INST_MEDIATRIX"},links:{...activityFixture.links,prcSupplyRequestId:null},coordination:null},prcActivityFixture];
  return send({...readPage("ACTIVITY_HISTORY_READ_V2",[]),rows,nextCursor:cursor?null:"ACT2_NEXT"});
 });return calls;
}
test("ADR-045 mixed activity includes PRC by default with filtering, search, link and eight-column PDF",async({page})=>{
 const calls=await setup(page);await page.goto("/audit");await expect(page.locator(".audit-table tbody tr")).toHaveCount(2);await expect(page.locator(".audit-table th")).toHaveCount(8);await expect(page.getByRole("link",{name:prcActivityFixture.links.prcSupplyRequestId,exact:true})).toHaveAttribute("href",/tab=prc&prcRequestId=PRCSR_/);await expect(page.locator(".audit-table")).toContainText("INST_SYNTH_PRC");
 await page.getByLabel("Event source",{exact:true}).selectOption("PRC");await expect(page.locator(".audit-table tbody tr")).toHaveCount(1);await expect(page.locator(".audit-table tbody tr td").nth(4)).toHaveText("—");await expect(page.locator(".audit-table tbody tr td").nth(6)).toHaveText("Off-chain");await page.getByLabel("Search activity",{exact:true}).fill(prcActivityFixture.links.prcSupplyRequestId);
 const pending=page.waitForEvent("download");await page.getByRole("button",{name:"Export PDF",exact:true}).click();const pdf=await pending;const bytes=await readFile((await pdf.path())!,"latin1");expect(bytes).toContain("SIMULATION_ONLY");expect(bytes).toContain("Off-chain");expect(bytes).not.toContain("PRC Request ID");
 await page.getByLabel("Search activity",{exact:true}).fill("");await page.getByRole("button",{name:"Load more",exact:true}).click();await expect(page.getByRole("alert")).toContainText("unavailable");await expect(page.locator(".audit-table tbody tr")).toHaveCount(1);await page.getByRole("button",{name:"Load more",exact:true}).click();await expect(page.getByText("3 loaded rows · All rows loaded",{exact:true})).toBeVisible();await expect(page.locator(".audit-table tbody tr")).toHaveCount(2);expect(calls.every(query=>new URLSearchParams(query).get("contract")==="ACTIVITY_HISTORY_READ_V2")).toBe(true);
});
test("unsupported V2 alone falls back to V1 with an explicit history notice",async({page})=>{const calls=await setup(page,"fallback");await page.goto("/audit");await expect(page.locator(".audit-table")).toContainText("REGISTER INBOUND COMPONENT");await expect(page.getByRole("status")).toContainText("each PRC supply request’s history");expect(calls.some(q=>q.includes("ACTIVITY_HISTORY_READ_V1"))).toBe(true);});
for(const mode of ["401","403","mismatch"])test(`V2 ${mode} does not downgrade or mask authorization/schema failures`,async({page})=>{const calls=await setup(page,mode);await page.goto("/audit");if(mode==="403")await expect(page.getByRole("alert")).toContainText("not permitted");else if(mode==="mismatch")await expect(page.getByRole("alert")).toContainText("unavailable");else await expect(page.getByLabel("Institution email or username",{exact:true})).toBeVisible();expect(calls.some(q=>q.includes("ACTIVITY_HISTORY_READ_V1"))).toBe(false);});
