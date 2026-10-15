// FR-03/04 / TP-08: synthetic HTTP-fixture checks, not clinical or Fabric evidence.
import { expect, test, type Page } from "@playwright/test";
const instant = "2026-10-15T00:00:00Z";
const row = { institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic inventory bank", bloodType: "A_POSITIVE", component: "PACKED_RED_BLOOD_CELLS", inventoryStatus: "AVAILABLE", confirmedCount: 9, lastProjectedAt: instant };
async function setup(page: Page) {
  let denied = false;
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/v1/auth/session") body = { principal: { accountId: "ACC_SYNTH_OVERVIEW", accountCategory: "BLOOD_BANK", userId: "USR_SYNTH_OVERVIEW", institutionId: row.institutionId, institutionDisplayName: row.institutionDisplayName, displayName: "Synthetic operator", roleId: "ROLE-02", roleDisplayName: "Blood Bank", permissions: ["dashboard:operational", "inventory:read", "transfers:read", "profile:read"], operators: [], classification: "SIMULATION_ONLY" } };
    if (path === "/api/v2/dashboard") {
      if (denied) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { message: "Access denied" } }) });
      body = { composition: "OPERATIONAL", scope: "INSTITUTION", inventory: [row, { ...row, inventoryStatus: "RESERVED", confirmedCount: 2 }, { ...row, component: "WHOLE_BLOOD", confirmedCount: 36 }, { ...row, component: "FRESH_FROZEN_PLASMA", confirmedCount: 25 }, { ...row, bloodType: "B_POSITIVE", component: "CRYOPRECIPITATE", confirmedCount: 7 }], pendingScans: [], lastSuccessfulProjectionAt: instant, classification: "SIMULATION_ONLY" };
    }
    if (path === "/api/v2/components") {
      if(denied)return route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({error:{code:"AUTH_DENIED"}})});
      const date=new Date(Date.now()+86400000).toISOString();
      const stocks=[{bloodType:"A_POSITIVE",componentType:"PACKED_RED_BLOOD_CELLS",count:9},{bloodType:"A_POSITIVE",componentType:"FRESH_FROZEN_PLASMA",count:25},{bloodType:"A_POSITIVE",componentType:"WHOLE_BLOOD",count:36},{bloodType:"B_POSITIVE",componentType:"CRYOPRECIPITATE",count:7}];
      body={scope:"INSTITUTION",classification:"SIMULATION_ONLY",components:stocks.flatMap((r,index)=>Array.from({length:r.count},(_,i)=>({componentId:`COMP_${index}_${i}`,donationId:`DON_${index}_${i}`,issuerInstitutionId:row.institutionId,institutionId:row.institutionId,componentType:r.componentType,bloodType:r.bloodType,collectedAt:instant,expiresAt:date,inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"SYNTHETIC_TEST",classification:"SIMULATION_ONLY"})))};
    }
    if (path === "/api/v2/transfers") body = { requests: [], reservations: [], timeline: [], classification: "SIMULATION_ONLY" };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  return () => { denied = true; };
}

test("component selector separates products, restores All and clears protected counts on denial", async ({ page }) => {
  const deny = await setup(page);
  await page.goto("/");
  const chart = page.locator(".inventory-overview-card");
  await expect(chart.locator(".stock-surplus")).not.toHaveCount(0);
  await expect(chart.locator(".stock-low")).not.toHaveCount(0);
  await expect(chart.locator(".stock-adequate")).not.toHaveCount(0);
  await expect(chart.locator(".stock-critical")).not.toHaveCount(0);
  expect(await chart.locator(".inventory-overview-bar").evaluateAll(bars=>bars.every(bar=>bar.querySelector(".inventory-overview-product-label")!.getBoundingClientRect().top>=bar.querySelector(".inventory-overview-track")!.getBoundingClientRect().bottom))).toBe(true);
  await expect(chart.locator(".stock-band-label")).toHaveCount(0);
  const filter = chart.getByRole("combobox", { name: "Inventory overview blood component" });
  await expect(filter).toHaveValue("ALL");
  await expect(chart.locator(".inventory-overview-group")).toHaveCount(8);
  await expect(chart.locator(".inventory-overview-bar")).toHaveCount(40);
  await expect(chart.getByRole("listitem", { name: "A+ PRBC: 11 confirmed units, 9 available; 9 eligible units; critical", exact: true })).toBeAttached();
  await expect(chart.getByRole("listitem", { name: "A+ FFP: 25 confirmed units, 25 available; 25 eligible units; adequate", exact: true })).toBeAttached();
  await filter.selectOption("FRESH_FROZEN_PLASMA");
  await expect(chart.locator(".inventory-overview-bar")).toHaveCount(8);
  await expect(chart.locator(".inventory-overview-product-label")).toHaveText(Array(8).fill("FFP"));
  await filter.selectOption("PLATELETS");
  await expect(chart.locator(".inventory-overview-track strong")).toHaveText(Array(8).fill("0"));
  await filter.selectOption("ALL");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(filter).toHaveValue("ALL");
  await expect(chart.locator(".inventory-overview-bar")).toHaveCount(40);
  deny();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(chart.locator(".inventory-overview-bar")).toHaveCount(0);
});

test("All stays inside the chart at narrow widths and can be scrolled with the keyboard", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const scroller = page.getByRole("region", { name: "Scrollable inventory chart" });
  await expect(page.locator(".inventory-overview-bar")).toHaveCount(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await scroller.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
});

test("component read failure removes classification while retaining confirmed chart counts",async({page})=>{
 await setup(page);let fail=false;
 await page.route("**/api/v2/components",async route=>{if(!fail)return route.fallback();return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{message:"diagnostic hidden"}})});});
 await page.goto("/");await expect(page.locator(".inventory-overview-bar.stock-surplus")).not.toHaveCount(0);fail=true;
 await page.getByRole("button",{name:"Refresh",exact:true}).click();
 await expect(page.locator(".inventory-overview-bar.stock-surplus,.inventory-overview-bar.stock-critical,.inventory-overview-bar.stock-low,.inventory-overview-bar.stock-adequate")).toHaveCount(0);
 await expect(page.locator(".inventory-overview-bar.stock-unknown")).toHaveCount(40);
 await expect(page.getByText("Stock classification unavailable: current component evidence could not be verified.",{exact:true})).toBeVisible();
});

test("A+ FFP is segmented at 10/24/48 with hover and keyboard range help",async({page})=>{
 await setup(page);
 await page.route("**/api/v2/dashboard",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({composition:"OPERATIONAL",scope:"INSTITUTION",inventory:[{...row,component:"FRESH_FROZEN_PLASMA",confirmedCount:60}],pendingScans:[],lastSuccessfulProjectionAt:instant,classification:"SIMULATION_ONLY"})}));
 await page.route("**/api/v2/components",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({scope:"INSTITUTION",classification:"SIMULATION_ONLY",components:Array.from({length:60},(_,i)=>({componentId:`COMP_FFP_${i}`,donationId:`DON_FFP_${i}`,issuerInstitutionId:row.institutionId,institutionId:row.institutionId,componentType:"FRESH_FROZEN_PLASMA",bloodType:"A_POSITIVE",collectedAt:instant,expiresAt:new Date(Date.now()+86400000).toISOString(),inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,policyVersion:"TEST",classification:"SIMULATION_ONLY"}))})}));
 await page.goto("/");await page.getByRole("combobox",{name:"Inventory overview blood component"}).selectOption("FRESH_FROZEN_PLASMA");
 const bar=page.locator('.inventory-overview-bar[aria-label^="A+ FFP:"]');
 await expect(bar.locator(".stock-threshold-segment")).toHaveCount(4);
 const adequate=bar.getByRole("button",{name:/A\+ FFP — Adequate: 25–48 units/});await adequate.hover();
 await expect(page.getByRole("tooltip")).toContainText("25–48 units");await expect(page.getByRole("tooltip")).toContainText("adequate stock range");
 expect(await bar.locator(".segment-adequate").getAttribute("data-start")).toBe("24");
 expect(await bar.locator(".segment-adequate").getAttribute("data-end")).toBe("48");
 await adequate.focus();await expect(page.getByRole("tooltip")).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("tooltip")).toHaveCount(0);
 const surplus=bar.getByRole("button",{name:/Surplus: 49\+ units/});await surplus.click();
 await expect(page.getByRole("tooltip")).toHaveText("Surplus: 12 units");
});
