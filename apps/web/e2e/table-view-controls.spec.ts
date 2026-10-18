// BL-WEB-05/06 refinement: header sort and column visibility leave default order, cells and PDF columns intact.
import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {labelFixture,activityFixture,readPage} from "./fixtures/transaction-reads";
const principal={accountId:"USR_VIEW",accountCategory:"BLOOD_BANK",userId:"USR_VIEW",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic bank",displayName:"Synthetic viewer",roleId:"ROLE-02",roleDisplayName:"Synthetic role",operators:[],permissions:["inventory:read","transfers:read","audit:read"],classification:"SIMULATION_ONLY"};
const component=(id:string,label:string,bloodType:string,expiresAt:string)=>({componentId:id,donationId:"DON_VIEW",issuerInstitutionId:"INST_MEDIATRIX",institutionId:"INST_MEDIATRIX",componentType:"PACKED_RED_BLOOD_CELLS",bloodType,collectedAt:"2026-10-01T00:00:00Z",expiresAt,inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"SYNTHETIC_TABLE",classification:"SIMULATION_ONLY",labelIdentity:{...labelFixture,value:label}});
// Default order is expiry ascending: MIKE, ZULU, ALPHA.
const components=[component("COMP_ZULU","SYNTH-ZULU-0003","O_POSITIVE","2026-11-05T00:00:00Z"),component("COMP_ALPHA","SYNTH-ALPHA-0001","A_POSITIVE","2026-11-09T00:00:00Z"),component("COMP_MIKE","SYNTH-MIKE-0002","B_POSITIVE","2026-11-01T00:00:00Z")];
const activity=[{...activityFixture,eventId:"CMD_EARLY",eventTime:"2026-10-14T00:00:00Z"},{...activityFixture,eventId:"CMD_LATE",eventTime:"2026-10-16T00:00:00Z"}];
async function setup(page:Page){
 const posts:string[]=[];
 await page.clock.install({time:Date.parse("2026-10-18T00:00:00Z")});
 await page.route("**/api/**",route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()==="POST")posts.push(path);const send=(body:unknown)=>route.fulfill({contentType:"application/json",body:JSON.stringify(body)});
  if(path==="/api/v1/auth/session")return send({principal});
  if(path==="/api/v2/components")return send({scope:"INSTITUTION",components,classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/reports/inbound-intake")return send({scope:"INSTITUTION",statuses:{},includedInventoryStatuses:["COMMITTED"],excludedFromInventory:["QUEUED"],classification:"SIMULATION_ONLY"});
  if(path==="/api/v2/activity-history")return send(readPage("ACTIVITY_HISTORY_READ_V2",activity));
  return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:{code:"UNAVAILABLE"}})});
 });
 return posts;
}
const unitOrder=(page:Page)=>page.locator(".inventory-table tbody tr td:first-child button").allTextContents();

test("inventory header sort cycles, column choice persists and the PDF keeps every column",async({page})=>{
 const posts=await setup(page);await page.goto("/inventory");
 const table=page.locator(".inventory-table"),unitHeader=table.getByRole("columnheader",{name:"Unit ID",exact:true});
 await expect(table.locator("tbody tr")).toHaveCount(3);
 await expect(table.getByRole("columnheader")).toHaveText(["Unit ID","Blood type","Component","Expiration date","Time remaining","Status"]);
 expect(await unitOrder(page)).toEqual(["SYNTH-MIKE-0002","SYNTH-ZULU-0003","SYNTH-ALPHA-0001"]);
 await expect(table.locator("th[aria-sort]")).toHaveCount(0);
 await unitHeader.getByRole("button").click();
 await expect(unitHeader).toHaveAttribute("aria-sort","ascending");
 expect(await unitOrder(page)).toEqual(["SYNTH-ALPHA-0001","SYNTH-MIKE-0002","SYNTH-ZULU-0003"]);
 await unitHeader.getByRole("button").click();
 await expect(unitHeader).toHaveAttribute("aria-sort","descending");
 expect(await unitOrder(page)).toEqual(["SYNTH-ZULU-0003","SYNTH-MIKE-0002","SYNTH-ALPHA-0001"]);
 const pending=page.waitForEvent("download");await page.getByRole("button",{name:"Export PDF",exact:true}).click();
 const pdf=(await readFile((await (await pending).path())!)).toString("latin1");
 for(const header of ["Unit ID","Blood type","Component","Expiration date","Time remaining","Status"])expect(pdf).toContain(header);
 expect(pdf).toContain("Sort: Unit ID descending");
 expect(pdf.indexOf("SYNTH-ZULU-0003")).toBeLessThan(pdf.indexOf("SYNTH-MIKE-0002"));expect(pdf.indexOf("SYNTH-MIKE-0002")).toBeLessThan(pdf.indexOf("SYNTH-ALPHA-0001"));
 await page.getByRole("group",{name:"Visible columns"}).waitFor({state:"detached"});
 await page.getByLabel("Choose visible columns (customized)",{exact:true}).click();
 const menu=page.getByRole("group",{name:"Visible columns"});
 await menu.getByLabel("Blood type",{exact:true}).uncheck();
 await expect(table.getByRole("columnheader")).toHaveText(["Unit ID","Component","Expiration date","Time remaining","Status"]);
 await expect(table.locator("tbody tr").first().locator("td")).toHaveCount(5);
 await page.keyboard.press("Escape");await expect(menu).toHaveCount(0);
 await page.reload();
 await expect(table.getByRole("columnheader")).toHaveText(["Unit ID","Component","Expiration date","Time remaining","Status"]);
 await expect(unitHeader).toHaveAttribute("aria-sort","descending");
 expect(await unitOrder(page)).toEqual(["SYNTH-ZULU-0003","SYNTH-MIKE-0002","SYNTH-ALPHA-0001"]);
 await page.getByLabel("Choose visible columns (customized)",{exact:true}).click();
 await menu.getByRole("button",{name:"Reset view",exact:true}).click();
 await expect(table.getByRole("columnheader")).toHaveCount(6);await expect(table.locator("th[aria-sort]")).toHaveCount(0);
 expect(await unitOrder(page)).toEqual(["SYNTH-MIKE-0002","SYNTH-ZULU-0003","SYNTH-ALPHA-0001"]);
 await page.mouse.click(5,5);await expect(menu).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(posts).toEqual([]);
});

test("activity history sorts loaded records by event time and keeps the last data column visible",async({page})=>{
 await setup(page);await page.goto("/audit");
 const table=page.locator(".audit-table"),timeHeader=table.getByRole("columnheader",{name:"Date & Time",exact:true});
 await expect(table.locator("tbody tr")).toHaveCount(2);
 const titles=()=>table.locator("tbody tr td.activity-description").evaluateAll(cells=>cells.map(cell=>(cell.getAttribute("title")??"").split(" · ")[0]));
 await timeHeader.getByRole("button").click();
 expect(await titles()).toEqual(["Event: CMD_EARLY","Event: CMD_LATE"]);
 await timeHeader.getByRole("button").click();
 expect(await titles()).toEqual(["Event: CMD_LATE","Event: CMD_EARLY"]);
 await page.getByLabel(/^Choose visible columns/).click();
 const menu=page.getByRole("group",{name:"Visible columns"});
 for(const label of ["Activity","User / Source","Scan ID","Request ID","Transfer ID","Blockchain ID","Status"])await menu.getByLabel(label,{exact:true}).uncheck();
 await expect(table.getByRole("columnheader")).toHaveText(["Date & Time"]);
 await expect(menu.getByLabel("Date & Time",{exact:true})).toBeDisabled();
});
