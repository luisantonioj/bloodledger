import {test,expect} from "@playwright/test";
import {setupBankCompletion} from "./fixtures/blood-bank-completion";

test("inventory availability matches current available and reserved stock",async({page})=>{
 const state=await setupBankCompletion(page);
 const component={
  donationId:"DON_SYNTH_AVAILABILITY",issuerInstitutionId:"INST_SYNTH_BANK",institutionId:"INST_SYNTH_BANK",
  bloodType:"A_POSITIVE",componentType:"PACKED_RED_BLOOD_CELLS",collectedAt:"2026-10-15T00:00:00Z",expiresAt:"2099-10-15T00:00:00Z",
  inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,reservationVersion:null,inventoryVersion:1,
  policyVersion:"INTERVIEW_DERIVED_CORE_V2",classification:"SIMULATION_ONLY",
 };
 const reserved={...component,inventoryStatus:"RESERVED",reservationId:"RES_TEST",reservationVersion:1};
 const elapsed={expiresAt:"2026-10-16T00:00:00Z",expiryState:"LABEL_EXPIRED_PENDING_EVALUATION"};
 await page.route("**/api/v2/components",route=>route.fulfill({json:{scope:"INSTITUTION",classification:"SIMULATION_ONLY",components:[
  {...component,componentId:"COMP_AVAILABLE"},
  {...reserved,componentId:"COMP_RESERVED"},
  {...component,...elapsed,componentId:"COMP_ELAPSED_AVAILABLE"},
  {...reserved,...elapsed,componentId:"COMP_ELAPSED_RESERVED"},
  {...component,...elapsed,componentId:"COMP_EXPIRED",inventoryStatus:"EXPIRED",expiryState:"EXPIRED"},
  {...component,componentId:"COMP_OTHER_PRODUCT",componentType:"WHOLE_BLOOD"},
 ]}}));
 await page.goto("/inventory");
 const availability=page.getByLabel("Availability",{exact:true});
 const count=page.locator(".inventory-match-count");
 const units=page.locator(".inventory-table").getByRole("button",{name:/^Open component /});
 await expect(availability).toHaveValue("ALL");
 await page.getByLabel("Blood type filter",{exact:true}).selectOption("A_POSITIVE");
 await page.getByLabel("Component filter",{exact:true}).selectOption("PACKED_RED_BLOOD_CELLS");
 await expect(count).toHaveText("5 units");
 await expect(units).toHaveCount(5);
 await availability.selectOption("AVAILABLE");
 await expect(count).toHaveText("1 available unit");
 await expect(units).toHaveCount(1);
 await expect(units.first()).toHaveAccessibleName("Open component COMP_AVAILABLE");
 await availability.selectOption("RESERVED");
 await expect(count).toHaveText("1 reserved unit");
 await expect(units).toHaveCount(1);
 await expect(units.first()).toHaveAccessibleName("Open component COMP_RESERVED");
 await page.getByLabel("Component filter",{exact:true}).selectOption("WHOLE_BLOOD");
 await expect(count).toHaveText("0 reserved units");
 await expect(units).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(state.posts).toEqual([]);
 expect(state.missing).toEqual([]);
});

test("bank summary shows labels and counts only and preserves the inventory expiry filter",async({page})=>{const state=await setupBankCompletion(page);await page.goto("/");const cards=page.locator(".dashboard-stats article");await expect(cards.nth(0).locator("strong")).toHaveText("9");await expect(cards.nth(1)).toContainText("Expired (not usable)");await expect(cards.nth(1).locator("strong")).toHaveText("6");await expect(cards.nth(2)).toContainText("Expiring Soon (demo)");await expect(cards.nth(2).locator("strong")).toHaveText("0");await expect(cards.locator("small")).toHaveCount(0);await expect(cards.nth(3).locator("strong")).toHaveText("40");await expect(cards.nth(4).locator("strong")).toHaveText("1");await expect(page.getByRole("link",{name:/Label expired, awaiting evaluation/})).toHaveCount(0);await page.goto("/inventory?expiryState=LABEL_EXPIRED_PENDING_EVALUATION");await expect(page.getByRole("button",{name:"Open component COMP_EXPIRED_LABEL",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Open component COMP_READY",exact:true})).toHaveCount(0);expect(state.posts).toEqual([]);expect(state.missing).toEqual([]);});
test("network widget excludes the signed-in bank from available stock",async({page})=>{
 const state=await setupBankCompletion(page);
 await page.goto("/");
 const network=page.getByRole("region",{name:"Network Blood Availability"});
 const quantity=network.locator(".requester-availability-quantity strong");
 await expect(quantity).toHaveText("23");
 await network.getByLabel("Blood Type",{exact:true}).selectOption("A_POSITIVE");
 await network.getByLabel("Component",{exact:true}).selectOption("WHOLE_BLOOD");
 await expect(quantity).toHaveText("11");
 await expect(network.getByText("units available at other facilities")).toBeVisible();
 await network.getByLabel("Blood Type",{exact:true}).selectOption("B_NEGATIVE");
 await expect(quantity).toHaveText("0");
 await network.getByLabel("Component",{exact:true}).selectOption("PACKED_RED_BLOOD_CELLS");
 await expect(quantity).toHaveText("0");
 await expect(network.getByText("Institution projection times")).toHaveCount(0);
 expect(state.posts).toEqual([]);
 expect(state.missing).toEqual([]);
});
test("ordinary awaiting request opens existing FEFO approval without hiding reserved requests",async({page})=>{const state=await setupBankCompletion(page);await page.goto("/transfers");await expect(page.locator(".bank-blood-requests-table tbody tr")).toHaveCount(2);await expect(page.locator(".bank-request-status small")).toHaveCount(0);const layout=await page.locator(".bank-request-layout").boundingBox(),card=await page.locator(".bank-request-layout>.bank-record-card").boundingBox();expect(layout).not.toBeNull();expect(card).not.toBeNull();expect(Math.abs(layout!.width-card!.width)).toBeLessThanOrEqual(2);await expect(page.locator(".bank-request-status").filter({hasText:/^ACTIVE$/})).toHaveCount(0);await page.screenshot({path:"/tmp/lat-blood-request-layout.png"});await expect(page.locator(".bank-blood-requests-table")).toContainText("RESERVATION RECORDED");await page.getByRole("button",{name:"Open request TRF_WAITING",exact:true}).click();await expect(page.getByRole("heading",{name:"Selected units 1 unit",exact:true})).toBeVisible();await page.getByLabel("I’ve reviewed the request and selected units.",{exact:true}).check();await expect(page.getByRole("button",{name:"Approve Transfer",exact:true})).toBeEnabled();await page.getByRole("button",{name:"Close record details",exact:true}).click();await page.getByRole("button",{name:"Open request TRF_RESERVED",exact:true}).click();await expect(page.getByRole("button",{name:"Approve Transfer",exact:true})).toHaveCount(0);expect(state.reads.some(path=>path.startsWith("/api/v2/coordination/redistribution"))).toBe(false);expect(state.posts).toEqual([]);expect(state.missing).toEqual([]);});
test("observed demand uses complete requested aggregates and chunks ranges at 366 days",async({page})=>{const state=await setupBankCompletion(page);await page.goto("/analytics");await page.locator(".analytics-history-details > summary").click();const history=page.locator(".observed-demand-workspace");await expect(history.locator(".consortium-summary").nth(0)).toContainText("120");await expect(history.locator(".consortium-summary").nth(1)).toContainText("240");await history.getByLabel("Date from",{exact:true}).fill("2024-01-01");await history.getByLabel("Date to",{exact:true}).fill("2025-01-02");await expect(history.locator(".consortium-summary").nth(0)).toContainText("240");expect(state.reads).toContain("/api/v2/analytics/request-history?from=2024-01-01&to=2024-12-31");expect(state.reads).toContain("/api/v2/analytics/request-history?from=2025-01-01&to=2025-01-02");expect(state.reads).not.toContain("/api/v2/transfers");expect(state.posts).toEqual([]);expect(state.missing).toEqual([]);});
test("laptop prepare sends outbound unit scanning to the phone without posting",async({page})=>{
 const state=await setupBankCompletion(page);
 await page.goto("/transfers?record=reservation&recordId=RES_TEST");
 const actions=page.getByRole("region",{name:"Reservation actions"});
 await actions.getByRole("button",{name:"Prepare reservation",exact:true}).click();
 const notice=actions.getByRole("note").filter({hasText:"Preparing requires scanning every reserved unit."});
 await expect(notice).toBeVisible();
 const actionsRow=actions.locator(".bank-detail-action-buttons");
 const [noticeBox,rowBox]=await Promise.all([notice.boundingBox(),actionsRow.boundingBox()]);
 expect(noticeBox!.x).toBeCloseTo(rowBox!.x,0);
 expect(noticeBox!.width).toBeCloseTo(rowBox!.width,0);
 await expect(page.getByRole("region",{name:"Outbound label verification"})).toHaveCount(0);
 expect(state.posts).toEqual([]);expect(state.missing).toEqual([]);
});
