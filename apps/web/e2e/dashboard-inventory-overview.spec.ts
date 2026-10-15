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
      body = { composition: "OPERATIONAL", scope: "INSTITUTION", inventory: [row, { ...row, inventoryStatus: "RESERVED", confirmedCount: 2 }, { ...row, component: "FRESH_FROZEN_PLASMA", confirmedCount: 4 }, { ...row, bloodType: "B_POSITIVE", component: "CRYOPRECIPITATE", confirmedCount: 7 }], pendingScans: [], lastSuccessfulProjectionAt: instant, classification: "SIMULATION_ONLY" };
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
  await expect(chart.getByText("Stock classification unavailable: no approved stock-level policy (RQ-16)", { exact: true })).toBeVisible();
  await expect(chart.locator(".stock-critical, .stock-low, .stock-adequate, .stock-surplus")).toHaveCount(0);
  const filter = chart.getByRole("combobox", { name: "Inventory overview blood component" });
  await expect(filter).toHaveValue("ALL");
  await expect(chart.locator(".inventory-overview-group")).toHaveCount(8);
  await expect(chart.locator(".inventory-overview-bar")).toHaveCount(40);
  await expect(chart.getByRole("listitem", { name: "A+ PRBC: 11 confirmed units, 9 available; stock classification unavailable (RQ-16)", exact: true })).toBeAttached();
  await expect(chart.getByRole("listitem", { name: "A+ FFP: 4 confirmed units, 4 available; stock classification unavailable (RQ-16)", exact: true })).toBeAttached();
  const unknown = chart.locator(".stock-unknown .inventory-overview-fill").first();
  expect(await unknown.evaluate(element => {
    const probe = document.createElement("i");
    probe.style.color = getComputedStyle(element).getPropertyValue("--ink-muted").trim();
    element.append(probe);
    const neutral = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(element).backgroundColor === neutral;
  })).toBe(true);
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
