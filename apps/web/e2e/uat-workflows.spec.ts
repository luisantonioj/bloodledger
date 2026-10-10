import { test, expect, type Page, type Route } from "@playwright/test";
// FR-05/08/12 / issue36. HTTP fixtures are not real API/Fabric/UAT evidence.
const reservation = { reservationId:"RES_UAT_SYNTH",purpose:"TRANSFER",status:"ACTIVE",version:7,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_SYNTH_METROLIPA",transferId:"TRF_UAT_SYNTH",localReleaseId:null,preparedAt:null,preparedEvidencePresent:false,updatedAt:"2026-10-10T01:00:00Z",components:[{componentId:"COMP_UAT_SYNTH",componentType:"CRYOPRECIPITATE",inventoryStatus:"RESERVED",inventoryVersion:3}],classification:"SIMULATION_ONLY" };
const component = { componentId:"COMP_UAT_SYNTH", donationId:"DON_UAT_SYNTH",issuerInstitutionId:"INST_MEDIATRIX",institutionId:"INST_MEDIATRIX",bloodType:"O_NEGATIVE",componentType:"CRYOPRECIPITATE",inventoryStatus:"AVAILABLE",expiryState:"CURRENT",collectedAt:"2026-10-09T00:00:00Z",expiresAt:"2026-10-14T00:00:00Z",reservationId:null,reservationVersion:null,inventoryVersion:3,policyVersion:"INTERVIEW_DERIVED_CORE_V2",classification:"SIMULATION_ONLY" };
const compromiseCodes = ["TEMPERATURE_EXCURSION_REPORTED","CONTAINER_DAMAGE_OR_LEAK_REPORTED","VISIBLE_COMPONENT_ABNORMALITY_REPORTED","HANDLING_OR_CUSTODY_DEVIATION_REPORTED"];
const reconciliationCodes = ["LABEL_RECORD_MISMATCH","POSSIBLE_DUPLICATE","COMPONENT_TYPE_MISMATCH","BLOOD_TYPE_MISMATCH","DATE_MISMATCH","CUSTODY_MISMATCH","STATUS_MISMATCH"];
function policy(kind: "compromise"|"reconciliation") { return {policyVersion:kind === "compromise" ? "SYNTHETIC_COMPROMISE_REASONS_V1" : "SYNTHETIC_RECONCILIATION_REASONS_V1",effect:kind === "compromise" ? "QUARANTINE_PENDING_MANUAL_REVIEW" : "RECONCILIATION_HOLD_ONLY",freeTextAllowed:false,classification:"SIMULATION_ONLY",reasons:(kind === "compromise" ? compromiseCodes : reconciliationCodes).map((code,index) => ({code,label:`API reason ${index+1}`}))}; }
function json(route: Route, body: unknown, status = 200) { return route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)}); }
function command(body: Record<string,unknown>, status = "QUEUED", resourceId = reservation.reservationId, resourceType = "TRANSFER") {return {commandId:"CMD_UAT_SYNTH",resourceType,resourceId,status,statusUrl:"/api/v2/commands/CMD_UAT_SYNTH",acceptedAt:"2026-10-10T02:00:00Z",correlationId:body.correlationId ?? "CORR_00000000000000000000000000000000",safeErrorCode:null,classification:"SIMULATION_ONLY",replayed:false};}
const capabilities = ["transfer:prepare","transfer:dispatch","transfer:transit","transfer:receive","transfer:cancel","transfer:compromise","inventory:local-release","inventory:reconcile"];
async function setup(page: Page, overrides: Partial<typeof reservation> = {}, intercept?: (route:Route,path:string) => Promise<boolean>, recipient = false, caps = capabilities) {
  const row = {...reservation,...overrides}; let active = true;
  const principal = {accountId:"ACC_UAT_SYNTH",accountCategory:recipient?"REQUESTOR":"BLOOD_BANK",verificationRequired:true,userId:"USR_UAT_SYNTH",displayName:"Synthetic UAT",institutionId:recipient?row.destinationInstitutionId:row.sourceInstitutionId,institutionDisplayName:"Synthetic facility",roleId:recipient?"ROLE-03":"ROLE-02",roleDisplayName:"Institution account",permissions:["dashboard:operational","inventory:read","transfers:read","alerts:read","profile:read"],operators:[{operatorId:"OP_UAT_SYNTH",roleId:recipient?"ROLE-03":"ROLE-02",capabilityProfile:"ROLE",version:1,actionCapabilities:caps}],classification:"SIMULATION_ONLY"};
  await page.route("**/api/**",async route => {
    const path = new URL(route.request().url()).pathname;
    if (intercept && await intercept(route,path)) return;
    if (path === "/api/v1/auth/session") {if(route.request().method()==="DELETE"){active=false;return route.fulfill({status:204});}return active?json(route,{principal}):json(route,{error:{code:"AUTH_REQUIRED",message:"Sign in"}},401);}
    if (path === "/api/v2/auth/operator-verifications") return json(route,{verificationId:"VFY_UAT_SYNTH"});
    if (path === "/api/v2/transfers") return json(route,{scope:"INSTITUTION",requests:[],reservations:[{reservation_id:row.reservationId,transfer_id:row.transferId,local_release_id:row.localReleaseId,purpose:row.purpose,status:row.status,version:row.version}],timeline:[],classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/reservations/RES_UAT_SYNTH") return json(route,row);
    if (path === "/api/v2/reservations/compromise-reasons") return json(route,policy("compromise"));
    if (path === "/api/v2/reconciliation/reasons") return json(route,policy("reconciliation"));
    if (path === "/api/v2/components") return json(route,{scope:"INSTITUTION",components:[component],classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/components/COMP_UAT_SYNTH") return json(route,component);
    if (path === "/api/v2/reports/inbound-intake") return json(route,{scope:"INSTITUTION",statuses:{},includedInventoryStatuses:["AVAILABLE","RESERVED"],excludedFromInventory:[],classification:"SIMULATION_ONLY"});
    return json(route,{error:{code:"TEST_ROUTE_MISSING",message:"Route not configured"}},404);
  });
}
async function verify(page:Page) {const dialog=page.getByRole("dialog",{name:"Verify operator"});await dialog.getByLabel("Operator PIN").fill("00000000");await dialog.getByRole("button",{name:"Verify and submit",exact:true}).click();}
async function open(page:Page) {await page.goto("/transfers?record=reservation&recordId=RES_UAT_SYNTH");await expect(page.getByRole("region",{name:"Reservation actions"})).toBeVisible();return page.getByRole("region",{name:"Reservation actions"});}
for (const [action,label,state,prepared,local,recipient] of [
  ["prepare","Prepare reservation","ACTIVE",false,false,false],
  ["dispatch","Dispatch reservation","ACTIVE",true,false,false],
  ["transit","Start transit","DISPATCHED",true,false,false],
  ["receive","Receive reservation","IN_TRANSIT",true,false,true],
  ["cancel","Cancel reservation","ACTIVE",false,false,false],
  ["local-release-complete","Complete local release","ACTIVE",true,true,false],
  ["compromise","Report compromise","DISPATCHED",true,false,false],
] as const) {
  test(`${action}: current read version, exact body, explicit confirmation, operator binding`,async ({page}) => {
    let body:Record<string,unknown>={},posts=0,verification:Record<string,unknown>={};
    await setup(page,{status:state,preparedEvidencePresent:prepared,...(local?{purpose:"LOCAL_RELEASE",transferId:null,localReleaseId:"REL_UAT_SYNTH",destinationInstitutionId:null}:{})},async(route,path)=>{
      if(path==="/api/v2/auth/operator-verifications"){verification=route.request().postDataJSON();await json(route,{verificationId:"VFY_UAT_SYNTH"});return true;}
      if(path===`/api/v2/reservations/RES_UAT_SYNTH/${action}`){body=route.request().postDataJSON();posts++;expect(body.expectedVersion).toBe(7);expect(body.eventTime).toEqual(expect.any(String));expect(Math.abs(Date.now()-Date.parse(String(body.eventTime)))).toBeLessThan(300000);expect(route.request().headers()["operator-verification"]).toBe("VFY_UAT_SYNTH");expect(verification).toMatchObject({action:`POST ${path}`,payload:body,idempotencyKey:route.request().headers()["idempotency-key"]});await json(route,command(body),202);return true;}return false;
    },recipient);
    const section=await open(page);await section.getByRole("button",{name:label,exact:true}).click();
    if(action==="prepare"){await section.getByLabel("Preparation evidence ID",{exact:true}).fill("EVD_UAT_SYNTH");await section.getByLabel("Preparation evidence SHA-256").fill("a".repeat(64));await section.getByLabel("Prepared at (ISO 8601 with timezone)").fill("2026-10-09T00:00:00Z");}
    if(action==="compromise"){await expect(section.getByLabel("Compromise reason").locator("option")).toHaveCount(5);await section.getByLabel("Compromise reason").selectOption(compromiseCodes[0]);await expect(section.getByText("This records quarantine pending manual review.",{exact:true})).toBeVisible();await expect(section.locator('textarea,input[type="text"]')).toHaveCount(0);}
    await expect(section.getByRole("button",{name:"Confirm reservation action",exact:true})).toBeDisabled();expect(posts).toBe(0);
    await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reservation action",exact:true}).click();await verify(page);
    await expect(section.getByRole("heading",{name:"Accepted and queued",exact:true})).toBeVisible();expect(posts).toBe(1);
    expect(Object.keys(body).sort()).toEqual(["correlationId","eventTime","expectedVersion",...(action==="prepare"?["preparedAt","preparedEvidenceDigest","preparedEvidenceId"]:[]),...(action==="compromise"?["reasonCode"]:[])].sort());
    if(action==="receive")await expect(section.getByText("Receipt records RECEIVED stock. It does not make the units usable.",{exact:true})).toBeVisible();
  });
}

test("reconciliation uses API options, exact case body, no release control",async({page})=>{
  let body:Record<string,unknown>={},posts=0;
  await setup(page,{},async(route,path)=>{if(path!=="/api/v2/reconciliation")return false;body=route.request().postDataJSON();posts++;await json(route,command(body,"QUEUED",String(body.caseId),"RECONCILIATION"),202);return true;});
  await page.goto("/inventory?record=component&recordId=COMP_UAT_SYNTH");const section=page.getByRole("region",{name:"Reconciliation hold"});await section.getByRole("button",{name:"Place reconciliation hold",exact:true}).click();
  await expect(section.getByLabel("Reconciliation reason").locator("option")).toHaveCount(8);await section.getByLabel("Reconciliation reason").selectOption(reconciliationCodes[0]);await expect(section.getByRole("button",{name:"Confirm reconciliation hold"})).toBeDisabled();await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reconciliation hold"}).click();await verify(page);await expect(section.getByRole("heading",{name:"Accepted and queued"})).toBeVisible();expect(posts).toBe(1);
  expect(body).toEqual({caseId:expect.stringMatching(/^RECON_[0-9A-F]{32}$/),componentId:component.componentId,correlationId:expect.stringMatching(/^CORR_[0-9A-F]{32}$/),reasonCode:reconciliationCodes[0]});await expect(section.getByRole("button",{name:/release/i})).toHaveCount(0);
});

test("malformed compromise policy fails closed; retry fetches without a command",async({page})=>{
  let reads=0,posts=0;await setup(page,{status:"DISPATCHED",preparedEvidencePresent:true},async(route,path)=>{if(route.request().method()==="POST")posts++;if(path!=="/api/v2/reservations/compromise-reasons")return false;reads++;await json(route,{...policy("compromise"),freeTextAllowed:true});return true;});
  const section=await open(page);await section.getByRole("button",{name:"Report compromise"}).click();await expect(section.getByRole("alert")).toContainText("inconsistent");await expect(section.getByLabel("Compromise reason")).toBeDisabled();await section.getByRole("checkbox").check();await expect(section.getByRole("button",{name:"Confirm reservation action"})).toBeDisabled();await section.getByRole("button",{name:"Reload reason policy"}).click();await expect.poll(()=>reads).toBe(2);expect(posts).toBe(0);
});

test("command recovery polls to commitment without resubmission",async({page})=>{
  let polls=0,posts=0;await setup(page,{},async(route,path)=>{if(route.request().method()==="POST")posts++;if(path!=="/api/v2/commands/CMD_UAT_SYNTH")return false;polls++;await json(route,command({},polls===1?"QUEUED":"COMMITTED"));return true;});
  await open(page);const section=page.locator(".requester-record-detail section").filter({has:page.getByRole("heading",{name:"Recover accepted command",exact:true})});await section.getByLabel("Accepted command ID").fill("CMD_UAT_SYNTH");await section.getByRole("button",{name:"Recover command status"}).click();await expect(section.getByRole("heading",{name:"Accepted and queued"})).toBeVisible();await expect(section.getByRole("heading",{name:"Committed",exact:true})).toBeVisible();expect(polls).toBe(2);expect(posts).toBe(0);
});
for(const status of [403,404,503])test(`recovery ${status} remains read-only and denies unavailable evidence`,async({page})=>{
  let posts=0;await setup(page,{},async(route,path)=>{if(route.request().method()==="POST")posts++;if(path!=="/api/v2/commands/CMD_UAT_SYNTH")return false;await json(route,{error:{code:"TEST_DENIED",message:"Command unavailable"}},status);return true;});await open(page);const section=page.locator(".requester-record-detail section").filter({has:page.getByRole("heading",{name:"Recover accepted command",exact:true})});await section.getByLabel("Accepted command ID").fill("CMD_UAT_SYNTH");await section.getByRole("button",{name:"Recover command status"}).click();await expect(section.getByRole("alert")).toContainText("unavailable");await expect(section.getByRole("heading",{name:"Committed",exact:true})).toHaveCount(0);expect(posts).toBe(0);
});

test("reservation time rejection creates fresh keys; ambiguous transport retains the exact attempt",async({page})=>{
  const calls:{body:Record<string,unknown>;key:string}[]=[];await setup(page,{},async(route,path)=>{if(path!=="/api/v2/reservations/RES_UAT_SYNTH/cancel")return false;calls.push({body:route.request().postDataJSON(),key:route.request().headers()["idempotency-key"]});await json(route,{error:{code:calls.length===1?"V2_COMMAND_TIME_OUT_OF_WINDOW":"SERVICE_UNAVAILABLE",message:"Temporary service failure"}},calls.length===1?400:503);return true;});const section=await open(page);await section.getByRole("button",{name:"Cancel reservation",exact:true}).click();await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reservation action"}).click();await verify(page);await expect(section.getByRole("alert")).toContainText("fresh time");await section.getByRole("button",{name:"Confirm reservation action"}).click();await verify(page);await expect(section.getByRole("alert")).toContainText("Temporary service failure");await section.getByRole("button",{name:"Retry same reservation command"}).click();await verify(page);await expect.poll(()=>calls.length).toBe(3);expect(calls[1].key).not.toBe(calls[0].key);expect(calls[1].body.eventTime).not.toBe(calls[0].body.eventTime);expect(calls[2]).toEqual(calls[1]);
});

test("reservation command protected 401 clears records and operator state",async({page})=>{
  await setup(page,{},async(route,path)=>{if(path!=="/api/v2/reservations/RES_UAT_SYNTH/cancel")return false;await json(route,{error:{code:"AUTH_SESSION_REVOKED",message:"Sign in"}},401);return true;});const section=await open(page);await section.getByRole("button",{name:"Cancel reservation",exact:true}).click();await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reservation action"}).click();await verify(page);await expect(page.getByRole("button",{name:"Sign in",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Reservation actions"})).toHaveCount(0);await expect(page.getByText(reservation.reservationId,{exact:true})).toHaveCount(0);
});

for(const [status,code] of [[400,"REQUEST_INVALID"],[413,"REQUEST_BODY_TOO_LARGE"],[415,"REQUEST_MEDIA_TYPE_UNSUPPORTED"]] as const)test(`reservation ${code} does not offer an unchanged retry`,async({page})=>{
 let posts=0;await setup(page,{},async(route,path)=>{if(path!=="/api/v2/reservations/RES_UAT_SYNTH/cancel")return false;posts++;await json(route,{error:{code,message:"Rejected"}},status);return true;});const section=await open(page);await section.getByRole("button",{name:"Cancel reservation",exact:true}).click();await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reservation action"}).click();await verify(page);await expect(section.getByRole("alert")).toBeVisible();await expect(section.getByRole("button",{name:"Confirm reservation action"})).toBeDisabled();await expect(section.getByRole("button",{name:"Retry same reservation command"})).toHaveCount(0);await section.getByRole("checkbox").uncheck();await section.getByRole("checkbox").check();await expect(section.getByRole("button",{name:"Confirm reservation action"})).toBeDisabled();expect(posts).toBe(1);
});

test("lost acceptance is recovered by saved request key with no second POST",async({page})=>{
 let posts=0,lookups=0,body:Record<string,unknown>={},key="";
 await setup(page,{},async(route,path)=>{
  if(path==="/api/v2/reservations/RES_UAT_SYNTH/cancel"){posts++;body=route.request().postDataJSON();key=route.request().headers()["idempotency-key"];await json(route,{error:{code:"SERVICE_UNAVAILABLE",message:"Acceptance response unavailable"}},503);return true;}
  if(path==="/api/v2/commands"){lookups++;expect(route.request().method()).toBe("GET");expect(new URL(route.request().url()).searchParams.get("idempotencyKey")).toBe(key);await json(route,{scope:"ACTOR_INSTITUTION",commands:[command(body,"COMMITTED")],nextCursor:null,classification:"SIMULATION_ONLY"});return true;}return false;
 });
 const section=await open(page);await section.getByRole("button",{name:"Cancel reservation",exact:true}).click();await section.getByRole("checkbox").check();await section.getByRole("button",{name:"Confirm reservation action"}).click();await verify(page);await expect(section.getByRole("alert")).toContainText("Acceptance response unavailable");await section.getByRole("button",{name:"Recover this attempt without resubmitting"}).click();await expect(section.getByRole("heading",{name:"Committed",exact:true})).toBeVisible();expect(posts).toBe(1);expect(lookups).toBe(1);
});
