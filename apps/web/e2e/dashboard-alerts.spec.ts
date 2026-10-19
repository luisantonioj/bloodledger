// TC-E04 (FR-07): one synthetic expiry alert is visible in every authorized role's scope.
import {test,expect,type Page} from "@playwright/test";
const alert={alertId:"V2EXP_COMP_SYNTH_EXP1",alertType:"EXPIRED",severity:"CRITICAL",unitId:"COMP_SYNTH_EXP1",bloodType:"O_POSITIVE",component:"PACKED_RED_BLOOD_CELLS",expiresAt:"2026-10-18T00:00:00Z",evaluatedAt:"2026-10-18T00:05:00Z",status:"OPEN",acknowledged:false};
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
  if(path==="/api/v2/alerts")return json(aggregate?{scope:"CITY_AGGREGATE",alerts:[],aggregates:[{institution_id:"INST_MEDIATRIX",blood_type:"O_POSITIVE",component_type:"PACKED_RED_BLOOD_CELLS",count:1}],classification:"SIMULATION_ONLY"}:{scope:"INSTITUTION",alerts:[alert],aggregates:[],classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/dashboard")return json({composition:aggregate?"REGULATORY":"OPERATIONAL",scope:aggregate?"CITY_AGGREGATE":"INSTITUTION",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/transfers")return json({scope:"INSTITUTION",requests:[],reservations:[],timeline:[],classification:"SIMULATION_ONLY"});
  return json({error:{code:"UNAVAILABLE"}},404);
 });
}
test("blood bank sees the expiry alert on Alerts",async({page})=>{await setup(page,"bank");await page.goto("/alerts");await expect(page.getByText("COMP_SYNTH_EXP1",{exact:false}).first()).toBeVisible();});
for(const role of ["requester","prc","doh"] as const)test(`${role} dashboard shows the expiry alert count`,async({page})=>{await setup(page,role);await page.goto("/");const card=page.locator(".dashboard-alert-summary");await expect(card).toContainText("Expiry alerts");await expect(card.getByTestId("dashboard-alert-count")).toHaveText("1");if(role==="doh")await expect(card.getByRole("link")).toHaveCount(0);});
