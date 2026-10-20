// TC-E04/TC-E01 (FR-07): one synthetic expiry and one near-expiry alert is visible in supported alert surfaces; requester dashboard omits stock alerts.
import {test,expect,type Page} from "@playwright/test";
const alert={alertId:"V2EXP_COMP_SYNTH_EXP1",alertType:"EXPIRED",severity:"CRITICAL",unitId:"COMP_SYNTH_EXP1",bloodType:"O_POSITIVE",component:"PACKED_RED_BLOOD_CELLS",expiresAt:"2026-10-18T00:00:00Z",evaluatedAt:"2026-10-18T00:05:00Z",status:"OPEN",acknowledged:false};
const near={...alert,alertId:"V2NEAR_COMP_SYNTH_NEAR1",alertType:"NEAR_EXPIRY",severity:"WARNING",unitId:"COMP_SYNTH_NEAR1",status:"ADVISORY"};
const roles={
 bank:{accountCategory:"BLOOD_BANK",roleId:"ROLE-02",institutionId:"INST_MEDIATRIX",permissions:["dashboard:operational","inventory:read","transfers:read","alerts:read","alerts:acknowledge","profile:read"]},
 requester:{accountCategory:"REQUESTOR",roleId:"ROLE-03",institutionId:"INST_SYNTH_MEDIX",permissions:["dashboard:operational","transfers:read","transfers:write","alerts:read","profile:read"]},
 prc:{accountCategory:"PRC",roleId:"ROLE-04",institutionId:"INST_SYNTH_PRC",permissions:["dashboard:regulatory","inventory:read","transfers:read","alerts:read","consortium:read","profile:read"]},
 doh:{accountCategory:"DOH",roleId:"ROLE-04",institutionId:"INST_SYNTH_DOH",permissions:["dashboard:regulatory","reports:read","alerts:read","audit:read","consortium:read","transfers:read","profile:read"]}
} as const;
async function setup(page:Page,role:keyof typeof roles){
 const r=roles[role];const aggregate=r.roleId==="ROLE-04";
 await page.route("**/api/**",route=>{
  const path=new URL(route.request().url()).pathname;
  const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  if(path==="/api/v1/auth/session")return json({principal:{userId:"USR_SYNTH_"+role.toUpperCase(),accountId:"ACC_SYNTH_"+role.toUpperCase(),institutionDisplayName:"Synthetic "+role,displayName:"Synthetic account",roleDisplayName:"Synthetic role",operators:[],verificationRequired:false,classification:"SIMULATION_ONLY",...r}});
  if(path==="/api/v2/alerts")return json(aggregate?{scope:"CITY_AGGREGATE",alerts:[],aggregates:[{institutionDisplayName:"Mary Mediatrix Medical Center",alertType:"EXPIRED",severity:"CRITICAL",status:"OPEN",lastEvaluatedAt:alert.evaluatedAt,count:1}],nearExpiryAggregates:[{institution_id:"INST_MEDIATRIX",blood_type:"O_POSITIVE",component_type:"PLATELETS",count:1}],classification:"SIMULATION_ONLY"}:{scope:"INSTITUTION",alerts:[alert,near],aggregates:[],classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/dashboard")return json({composition:aggregate?"REGULATORY":"OPERATIONAL",scope:aggregate?"CITY_AGGREGATE":"INSTITUTION",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/transfers")return json({scope:"INSTITUTION",requests:[],reservations:[],timeline:[],classification:"SIMULATION_ONLY"});
  return json({error:{code:"UNAVAILABLE"}},404);
 });
}
test("blood bank sees the expiry alert on Alerts",async({page})=>{await setup(page,"bank");await page.goto("/alerts");await expect(page.getByText("COMP_SYNTH_EXP1",{exact:false}).first()).toBeVisible();});
for(const role of ["prc","doh"] as const)test(`${role} dashboard omits expiry alerts`,async({page})=>{await setup(page,role);await page.goto("/");await expect(page.getByRole("heading",{name:role==="doh"?"Hospital Reports":"Blood-Bank Inventory Overview",exact:true})).toBeVisible();await expect(page.locator(".dashboard-alert-summary")).toHaveCount(0);});

test("requester dashboard omits stock expiry alerts",async({page})=>{await setup(page,"requester");await page.goto("/");await expect(page.getByRole("heading",{name:"Network Blood Availability",exact:true})).toBeVisible();await expect(page.locator(".dashboard-alert-summary")).toHaveCount(0);});

test("PRC Alerts retains the expired-unit network summary",async({page})=>{await setup(page,"prc");await page.goto("/alerts");const card=page.locator(".alert-card");await expect(card.getByRole("heading",{name:"EXPIRED",exact:true})).toBeVisible();await expect(card).toContainText("Mary Mediatrix Medical Center");await expect(card).toContainText("Network summary");});

test("refresh button stays visually steady while a read is in flight",async({page})=>{
 await setup(page,"requester");let reads=0;
 await page.route("**/api/v2/dashboard",async route=>{
  if(++reads>1)await new Promise(resolve=>setTimeout(resolve,800));
  await route.fulfill({contentType:"application/json",body:JSON.stringify({composition:"OPERATIONAL",scope:"INSTITUTION",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"})});
 });
 await page.goto("/");const refresh=page.getByRole("button",{name:"Refresh",exact:true});
 await expect(refresh).toBeEnabled();
 const width=await refresh.evaluate(el=>el.getBoundingClientRect().width);
 await refresh.click();await expect(refresh).toBeDisabled();await expect(refresh).toHaveText("Refresh");
 await expect(refresh).toHaveCSS("opacity","1");
 expect(await refresh.evaluate(el=>el.getBoundingClientRect().width)).toBe(width);
 await expect(refresh).toBeEnabled();
});
