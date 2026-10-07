// TP-03 / BL-TST-01: synthetic mocked browser evidence, not Fabric or UAT.
import { expect, test, type Page, type Route } from "@playwright/test";

const instant = "2026-10-07T04:00:00.000Z";
const component = { componentId: "COMP_LAT_INITIAL", donationId: "DON_LAT_INITIAL", issuerInstitutionId: "INST_MEDIATRIX", institutionId: "INST_MEDIATRIX", bloodType: "A_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", collectedAt: instant, expiresAt: "2026-11-07T04:00:00.000Z", inventoryStatus: "AVAILABLE", inventoryVersion: 1, reservationId: null, reservationVersion: null, policyVersion: "INTERVIEW_DERIVED_CORE_V2", classification: "SIMULATION_ONLY" };
const aggregate = { institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Lat Inventory", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", inventoryStatus: "AVAILABLE", confirmedCount: 3, lastProjectedAt: instant };
const alert = { alertId: "ALERT_LAT_001", unitId: "UNIT_LAT_ALERT", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", institutionId: "INST_MEDIATRIX", alertType: "NEAR_EXPIRY", severity: "WARNING", status: "OPEN", thresholdVersion: "SYNTHETIC_EXPIRY_V1", evaluatedAt: instant, expiresAt: "2026-10-08T04:00:00.000Z", acknowledged: false };
const report = { reportType: "CITY_INVENTORY_SUMMARY", scope: "CITY_AGGREGATE", generatedAt: instant, inventory: [aggregate], alerts: [], transferSummary: [], disclaimer: "Synthetic prototype report; not an official filing.", classification: "SIMULATION_ONLY" };
function json(route: Route, body: unknown, status = 200) { return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }
async function mock(page: Page, role: "ROLE-01" | "ROLE-03" | "ROLE-04", override: (route: Route, path: string) => Promise<boolean> = async () => false) {
  const institutionId = role === "ROLE-03" ? "INST_LAT_RECIPIENT" : role === "ROLE-04" ? "INST_LAT_REGULATOR" : "INST_MEDIATRIX";
  const permissions = role === "ROLE-04" ? ["dashboard:regulatory", "reports:read", "alerts:read", "profile:read"] : ["dashboard:operational", "transfers:read", "transfers:write", "alerts:read", "profile:read", ...(role === "ROLE-01" ? ["inventory:read"] : [])];
  await page.route("**/api/**", async route => {
    const actualPath = new URL(route.request().url()).pathname;
    // Delivered persistent integration uses V2 reads; reuse these test-only bodies.
    const path = ({ "/api/v2/dashboard": "/api/v1/dashboard", "/api/v2/alerts": "/api/v1/alerts", "/api/v2/audit": "/api/v1/audit" } as Record<string, string>)[actualPath] ?? actualPath;
    if (await override(route, path)) return;
    if (path === "/api/v1/auth/session") return json(route, { principal: { userId: "USR_LAT_" + role.slice(-2), displayName: "Synthetic Lat User", institutionId, institutionDisplayName: "Synthetic Lat Scope", roleId: role, roleDisplayName: role, permissions, classification: "SIMULATION_ONLY" } });
    if (path === "/api/v2/transfers") return json(route, { requests: [], reservations: [], timeline: [], classification: "SIMULATION_ONLY" });
    if (path === "/api/v2/components") return json(route, { scope: "INSTITUTION", components: [component], classification: "SIMULATION_ONLY" });
    if (path === "/api/v2/reports/inbound-intake") return json(route, { scope: "INSTITUTION", statuses: { QUEUED: 1 }, includedInventoryStatuses: ["COMMITTED"], excludedFromInventory: ["QUEUED", "FAILED", "CONFLICT"], classification: "SIMULATION_ONLY" });
    if (path === "/api/v1/alerts") return json(route, { scope: "INSTITUTION", alerts: [alert], aggregates: [], classification: "SIMULATION_ONLY" });
    if (path === "/api/v1/reports/inventory") return json(route, report);
    if (path === "/api/v1/transfers") return json(route, { scope: "DESTINATION_INSTITUTION", transfers: [], classification: "SIMULATION_ONLY" });
    return json(route, { error: { message: "Synthetic unconfigured endpoint" } }, 404);
  });
}

test("TP-LAT-001 inventory clears changed contract evidence and rejects late responses at narrow width", async ({ page }) => {
  let release: (() => void) | undefined;
  let started = false;
  let calls = 0;
  await mock(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v2/components") return false;
    const version = route.request().headers()["x-bloodledger-contract-version"];
    calls++;
    if (version === "V2.1") { started = true; await new Promise<void>(resolve => { release = resolve; }); }
    await json(route, { scope: "INSTITUTION", classification: "SIMULATION_ONLY", components: [{ ...component, componentId: version === "V2.1" ? "COMP_LAT_OLD_V21" : calls === 1 ? "COMP_LAT_INITIAL" : "COMP_LAT_LATEST" }] });
    return true;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");
  await expect(page.getByText("COMP_LAT_INITIAL", { exact: true })).toBeVisible();
  await page.getByLabel("Contract view").selectOption("V2.1");
  await expect.poll(() => started).toBe(true);
  await expect(page.locator(".inventory-table tbody tr")).toHaveCount(0);
  await page.getByLabel("Contract view").selectOption("V2");
  await expect(page.getByText("COMP_LAT_LATEST", { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse(response => response.url().endsWith("/api/v2/components") && response.request().headers()["x-bloodledger-contract-version"] === "V2.1");
  release?.(); await oldResponse;
  await expect(page.getByText("COMP_LAT_OLD_V21", { exact: true })).toHaveCount(0);
  await expect(page.getByText("COMP_LAT_LATEST", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("TP-LAT-002 foreign inventory rows fail closed after a successful load", async ({ page }) => {
  let foreign = false;
  await mock(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v2/components" || !foreign) return false;
    await json(route, { scope: "INSTITUTION", components: [{ ...component, componentId: "COMP_LAT_FOREIGN", institutionId: "INST_LAT_FOREIGN" }], classification: "SIMULATION_ONLY" }); return true;
  });
  await page.goto("/inventory");
  await expect(page.getByText("COMP_LAT_INITIAL", { exact: true })).toBeVisible();
  foreign = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("V2 component inventory unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".inventory-table tbody tr")).toHaveCount(0);
  await expect(page.getByText("COMP_LAT_FOREIGN", { exact: true })).toHaveCount(0);
});

for (const status of [401, 403]) for (const feature of ["inventory", "alerts", "reporting"] as const) {
  test(`TP-LAT-003 ${feature} clears restricted evidence on refresh ${status}`, async ({ page }) => {
    let denied = false;
    const endpoint = feature === "inventory" ? "/api/v2/components" : feature === "alerts" ? "/api/v1/alerts" : "/api/v1/reports/inventory";
    await mock(page, feature === "reporting" ? "ROLE-04" : "ROLE-01", async (route, path) => {
      if (path !== endpoint || !denied) return false;
      await json(route, { error: { message: "Synthetic access denied" } }, status); return true;
    });
    await page.goto("/" + feature);
    const marker = feature === "inventory" ? "COMP_LAT_INITIAL" : feature === "alerts" ? "UNIT_LAT_ALERT" : "Synthetic Lat Inventory";
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    denied = true;
    if (feature === "inventory") await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
    await expect(page.getByText(feature === "inventory" ? "V2 component inventory unavailable" : "Unable to load data", { exact: true })).toBeVisible();
  });
}

for (const feature of ["alerts", "reporting"] as const) {
  test(`TP-LAT-004 ${feature} labels preserved data after transient failure and retries`, async ({ page }) => {
    let fail = false;
    const endpoint = feature === "alerts" ? "/api/v1/alerts" : "/api/v1/reports/inventory";
    await mock(page, feature === "reporting" ? "ROLE-04" : "ROLE-01", async (route, path) => {
      if (path !== endpoint || !fail) return false;
      await json(route, { error: { message: "Synthetic temporary outage" } }, 503); return true;
    });
    await page.goto("/" + feature);
    const marker = feature === "alerts" ? "UNIT_LAT_ALERT" : "Synthetic Lat Inventory";
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    fail = true;
    await expect(page.getByText("Update unavailable", { exact: true })).toBeVisible();
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    await expect(page.getByText("Showing the last successfully loaded data.", { exact: true })).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Retry update", exact: true }).click();
    await expect(page.getByText("Update unavailable", { exact: true })).toHaveCount(0);
  });
}

function command(payload: Record<string, unknown>, status: "QUEUED" | "FAILED" | "CONFLICT" = "QUEUED") {
  return { commandId: "CMD_LAT_REQUEST", resourceType: "TRANSFER", resourceId: payload.transferId, status, statusUrl: "/api/v2/commands/CMD_LAT_REQUEST", acceptedAt: instant, correlationId: payload.correlationId, safeErrorCode: status === "QUEUED" ? null : "V2_STATE_CONFLICT", classification: "SIMULATION_ONLY", replayed: false };
}
for (const terminal of ["FAILED", "CONFLICT"] as const) {
  test(`TP-LAT-005 canonical V2 request retry retains scope and renders ${terminal} without resubmission`, async ({ page }) => {
    const attempts: { key: string; body: Record<string, unknown>; version: string }[] = [];
    await mock(page, "ROLE-03", async (route, path) => {
      if (path === "/api/v2/transfers" && route.request().method() === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        attempts.push({ key: route.request().headers()["idempotency-key"]!, body, version: route.request().headers()["x-bloodledger-contract-version"]! });
        if (attempts.length === 1) await route.abort(); else await json(route, command(body), 202);
        return true;
      }
      if (path === "/api/v2/commands/CMD_LAT_REQUEST") { await json(route, command(attempts[1]!.body, terminal)); return true; }
      return false;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/transfers");
    await page.getByLabel("Quantity", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Submit V2 request", exact: true }).click();
    expect(attempts).toHaveLength(0);
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.getByRole("combobox", { name: "Component", exact: true }).selectOption("CRYOPRECIPITATE");
    await page.getByRole("button", { name: "Submit V2 request", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Retry same request", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry same request", exact: true }).click();
    await expect(page.getByRole("heading", { name: terminal === "FAILED" ? "Failed" : "Conflict", exact: true })).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0]!.body).toMatchObject({ sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_LAT_RECIPIENT", quantity: 2, componentType: "CRYOPRECIPITATE" });
    expect(attempts[0]!.version).toBe("V2.1");
    expect(Object.keys(attempts[0]!.body).sort()).toEqual(["bloodType", "componentType", "correlationId", "destinationInstitutionId", "eventTime", "quantity", "requestTime", "sourceInstitutionId", "transferId", "urgency"]);
    await expect(page.getByRole("heading", { name: "Committed", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss status", exact: true }).click();
    await expect(page.locator(".v2-command-card")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("TP-LAT-006 command poll rejects another resource identity", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await mock(page, "ROLE-03", async (route, path) => {
    if (path === "/api/v2/transfers" && route.request().method() === "POST") { payload = route.request().postDataJSON(); await json(route, command(payload), 202); return true; }
    if (path === "/api/v2/commands/CMD_LAT_REQUEST") { await json(route, { ...command(payload), status: "COMMITTED", resourceId: "TRF_LAT_FOREIGN" }); return true; }
    return false;
  });
  await page.goto("/transfers");
  await page.getByRole("button", { name: "Submit V2 request", exact: true }).click();
  await expect(page.getByText(/Status check delayed:/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accepted and queued", exact: true })).toBeVisible();
  await expect(page.getByText("TRF_LAT_FOREIGN", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Committed", exact: true })).toHaveCount(0);
});

test("TP-LAT-007 reporting describes available discovery and keeps exports gated", async ({ page }) => {
  await mock(page, "ROLE-04");
  await page.goto("/reporting");
  await expect(page.getByText("V2 census presentation is not connected", { exact: true })).toBeVisible();
  await expect(page.getByText(/permission-scoped snapshot discovery exists/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Export fixed-layout PDF", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Download simulation CSV", exact: true })).toHaveAttribute("href", "/api/v1/reports/inventory.csv");
});
