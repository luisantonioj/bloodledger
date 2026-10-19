// FR-11/12: DOH reviews saved captures without inventing submission/compliance outcomes.
import {test,expect,type Page} from "@playwright/test";
const types=["O_POSITIVE","A_POSITIVE","B_POSITIVE","AB_POSITIVE","O_NEGATIVE","A_NEGATIVE","B_NEGATIVE","AB_NEGATIVE"];
const components=["WHOLE_BLOOD","PACKED_RED_BLOOD_CELLS","FRESH_FROZEN_PLASMA","PLATELETS","CRYOPRECIPITATE"];
async function setup(page:Page,{unavailable=false,duplicate=false}={}){
 const reads:string[]=[],writes:string[]=[];
 const first={snapshotId:"CENSUS_DOH_FIRST",institutionId:"INST_MEDIATRIX",scheduledFor:"2026-10-16T01:00:00Z",capturedAt:"2026-10-16T01:02:00Z",reportPolicyVersion:"SYNTHETIC_TEST",triggerType:"SCHEDULED",classification:"SIMULATION_ONLY"};
 const second={...first,snapshotId:"CENSUS_DOH_SECOND",institutionId:"INST_SYNTH_MEDIX",scheduledFor:"2026-10-16T08:00:00Z",capturedAt:"2026-10-16T08:01:00Z"};
 const repeated={...first,snapshotId:"CENSUS_DOH_DUP",capturedAt:"2026-10-16T01:03:00Z"};
 await page.route("**/api/**",route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;reads.push(path);if(!["GET","HEAD"].includes(request.method()))writes.push(path);
  let body:unknown;
  if(path==="/api/v1/auth/session")body={principal:{userId:"USR_DOH_SYNTH",accountId:"ACC_DOH_SYNTH",accountCategory:"DOH",institutionId:"INST_SYNTH_DOH",institutionDisplayName:"DOH-CHD CALABARZON",displayName:"Synthetic regulator",roleId:"ROLE-04",roleDisplayName:"Regulatory reviewer",permissions:["dashboard:regulatory","reports:read","profile:read","alerts:read","audit:read","consortium:read","transfers:read"],operators:[],classification:"SIMULATION_ONLY"}};
  else if(unavailable)return route.fulfill({status:503,json:{error:{message:"Synthetic read unavailable"}}});
  else if(path==="/api/v2/reports/doh-census")body={scope:"REGULATORY_AGGREGATE",displayPolicyVersion:"DOH_CENSUS_COLUMN_ORDER_V1",displayBloodTypeOrder:types,totalColumn:"CALCULATED",reportAvailability:"EXPORT_DISABLED_PENDING_FORMAT",exportAvailable:false,classification:"SIMULATION_ONLY",snapshots:url.searchParams.has("cursor")?[second,...(duplicate?[repeated]:[])]:[first],nextCursor:url.searchParams.has("cursor")?null:second.snapshotId};
  else if(path.startsWith("/api/v2/reports/doh-census/")){const selected=[first,second,repeated].find(row=>path.endsWith(row.snapshotId));if(!selected)return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});body={...selected,timezone:"Asia/Manila",groups:components.map(componentType=>({componentType,bloodTypes:types.map(bloodType=>({bloodType,availableCount:selected===second?1:3,reservedCount:1,reportableCount:selected===second?2:4}))}))};}
  else return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
  return route.fulfill({json:body});
 });return {reads,writes};
}
test("DOH shows all three hospitals, reads every report page and opens the chosen stock checkpoint",async({page})=>{
 const state=await setup(page);await page.goto("/");
 await expect(page.getByRole("navigation",{name:"Primary navigation",exact:true}).getByRole("link")).toHaveText(["Dashboard","Profile"]);
 await page.getByLabel("Reporting date",{exact:true}).fill("2026-10-16");
 await expect(page.locator(".consortium-summary")).toHaveCount(0);await expect(page.locator(".doh-hospital-report-table tbody tr")).toHaveCount(3);
 const hospital=(name:string)=>page.locator(".doh-hospital-report-table tbody tr").filter({hasText:name});
 await expect(hospital("Mary Mediatrix")).toContainText("Recorded");await expect(hospital("Lipa Medix")).toContainText("Recorded");await expect(hospital("N.L. Villa").getByText("No report recorded",{exact:true})).toHaveCount(2);
 await page.getByRole("button",{name:"View reports for Mary Mediatrix Medical Center",exact:true}).click();
 await expect(page.getByRole("button",{name:"Morning · 9 AM",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.locator(".doh-report-stock-table tbody tr")).toHaveCount(8);await expect(page.locator(".doh-report-stock-table tbody tr").first().locator("td").last()).toHaveText("20");
 await page.getByRole("button",{name:"Afternoon · 4 PM",exact:true}).click();await expect(page.getByRole("region",{name:"Hospital report viewer"})).toContainText("No report recorded");await expect(page.locator(".doh-report-stock-table")).toHaveCount(0);
 await page.getByRole("button",{name:"View reports for Lipa Medix Medical Center",exact:true}).click();await expect(page.getByRole("button",{name:"Afternoon · 4 PM",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.locator(".doh-report-stock-table tbody tr").first().locator("td").last()).toHaveText("10");
 await page.getByLabel("Reporting date",{exact:true}).fill("2026-10-15");await expect(page.locator(".doh-report-stock-table")).toHaveCount(0);await expect(page.locator(".doh-hospital-report-table").getByText("No report recorded",{exact:true})).toHaveCount(6);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(state.writes).toHaveLength(0);expect(state.reads).not.toContain("/api/v2/dashboard");
});
test("former DOH tabs show the hospital dashboard and failed reads never imply missing submissions",async({page})=>{
 const state=await setup(page,{unavailable:true});
 for(const path of ["/transfers","/alerts","/audit","/analytics","/consortium","/reporting"]){await page.goto(path);await expect(page.getByRole("heading",{name:"Dashboard",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Hospital Reports",exact:true})).toBeVisible();}
 await expect(page.getByText("Reports unavailable",{exact:true})).toBeVisible();await expect(page.locator(".doh-hospital-report-table").getByText("Unavailable",{exact:true})).toHaveCount(6);await expect(page.getByText("No report recorded",{exact:true})).toHaveCount(0);
 expect(state.reads.filter(path=>path!=="/api/v2/alerts").some(path=>/\/(alerts|audit|activity-history|transfers|analytics|consortium)(\/|$)/.test(path))).toBe(false);// TC-E04: only the city-aggregate expiry alert count is read.
 expect(state.writes).toHaveLength(0);
});
test("duplicate captures require an explicit recorded-version choice before displaying stock",async({page})=>{
 const state=await setup(page,{duplicate:true});await page.goto("/");await page.getByLabel("Reporting date",{exact:true}).fill("2026-10-16");await expect(page.getByText("Multiple records · Review",{exact:true})).toBeVisible();await page.getByRole("button",{name:"View reports for Mary Mediatrix Medical Center",exact:true}).click();
 await expect(page.getByText("Select a recorded version",{exact:true})).toBeVisible();await expect(page.locator(".doh-report-stock-table")).toHaveCount(0);expect(state.reads.some(path=>path.includes("/doh-census/"))).toBe(false);
 await page.getByLabel("Recorded version",{exact:true}).selectOption("CENSUS_DOH_DUP");await expect(page.locator(".doh-report-stock-table tbody tr")).toHaveCount(8);expect(state.reads).toContain("/api/v2/reports/doh-census/CENSUS_DOH_DUP");expect(state.writes).toHaveLength(0);
});
