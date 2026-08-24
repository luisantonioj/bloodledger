import { randomBytes } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";

type RoleId = "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04" | "ROLE-05" | "ROLE-06";

const permissions = {
  "ROLE-01": ["dashboard:operational", "inventory:read", "inventory:write", "transfers:read", "transfers:write", "alerts:read", "alerts:acknowledge", "profile:read"],
  "ROLE-02": ["dashboard:operational", "inventory:read", "transfers:read", "transfers:write", "alerts:read", "alerts:acknowledge", "audit:read", "profile:read"],
  "ROLE-03": ["dashboard:operational", "transfers:read", "transfers:write", "alerts:read", "profile:read"],
  "ROLE-04": ["dashboard:regulatory", "inventory:read", "transfers:read", "alerts:read", "consortium:read", "audit:read", "reports:read", "profile:read"],
  "ROLE-05": ["profile:read"],
  "ROLE-06": ["profile:read"],
} as const;

const navigation: Record<RoleId, string[]> = {
  "ROLE-01": ["Dashboard", "Inventory", "Transfers", "Alerts", "Profile"],
  "ROLE-02": ["Dashboard", "Inventory", "Transfers", "Alerts", "Audit", "Profile"],
  "ROLE-03": ["Dashboard", "Transfers", "Alerts", "Profile"],
  "ROLE-04": ["Dashboard", "Inventory", "Transfers", "Alerts", "Network view", "Audit", "Reports", "Profile"],
  "ROLE-05": ["Dashboard", "Profile"],
  "ROLE-06": ["Dashboard", "Profile"],
};

const timestamp = "2026-08-24T03:00:00.000Z";
const aggregate = { institutionId: "INST_SYNTH_BROWSER", institutionDisplayName: "Synthetic Browser Hospital", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", inventoryStatus: "AVAILABLE", confirmedCount: 3, lastProjectedAt: timestamp };
const responses: Record<string, unknown> = {
  "/api/v1/dashboard": { composition: "OPERATIONAL", scope: "INSTITUTION", inventory: [aggregate], pendingScans: [{ status: "QUEUED", count: 1 }], lastSuccessfulProjectionAt: timestamp, classification: "SIMULATION_ONLY" },
  "/api/v1/inventory": { scope: "INSTITUTION", aggregates: [], units: [{ unitId: "UNIT_SYNTH_BROWSER_01", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", expiresAt: timestamp, inventoryStatus: "AVAILABLE", projectedAt: timestamp }], classification: "SIMULATION_ONLY" },
  "/api/v1/transfers": { scope: "SOURCE_INSTITUTION", transfers: [], classification: "SIMULATION_ONLY" },
  "/api/v1/alerts": { scope: "INSTITUTION", alerts: [], aggregates: [], classification: "SIMULATION_ONLY" },
  "/api/v1/consortium": { scope: "CITY_AGGREGATE", inventory: [aggregate], alerts: [], transferSummary: [], lastSuccessfulProjectionAt: timestamp, classification: "SIMULATION_ONLY" },
  "/api/v1/audit": { scope: "INSTITUTION", events: [], classification: "SIMULATION_ONLY" },
  "/api/v1/reports/inventory": { reportType: "CITY_INVENTORY_SUMMARY", scope: "CITY_AGGREGATE", generatedAt: timestamp, inventory: [aggregate], alerts: [], transferSummary: [], disclaimer: "Prototype simulation evidence; not an official filing.", classification: "SIMULATION_ONLY" },
};

function principal(roleId: RoleId) {
  const regulatory = roleId === "ROLE-04";
  const system = roleId === "ROLE-05";
  return {
    userId: `USR_SYNTH_BROWSER_${roleId.slice(-2)}`,
    displayName: `Synthetic Browser ${roleId.slice(-2)}`,
    institutionId: regulatory ? "INST_SYNTH_REGULATOR" : system ? "INST_SYNTH_SYSTEM" : roleId === "ROLE-03" ? "INST_SYNTH_SECONDARY" : "INST_MEDIATRIX",
    institutionDisplayName: regulatory ? "Synthetic Regulatory Office" : system ? "Synthetic System Scope" : roleId === "ROLE-03" ? "Synthetic Secondary Hospital" : "Synthetic Mediatrix Browser",
    roleId,
    roleDisplayName: `Synthetic ${roleId}`,
    permissions: [...permissions[roleId]],
    classification: "SIMULATION_ONLY",
  };
}

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function authenticatedApi(page: Page, roleId: RoleId, override?: (route: Route, path: string) => boolean | Promise<boolean>) {
  const activePrincipal = principal(roleId);
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (override && await override(route, path)) return;
    if (path === "/api/v1/auth/session") return fulfillJson(route, { principal: activePrincipal });
    if (path === "/api/v1/reports/inventory.csv") return route.fulfill({ status: 200, contentType: "text/csv", body: "classification\nSIMULATION_ONLY\n" });
    const body = responses[path];
    if (body) return fulfillJson(route, path === "/api/v1/dashboard" && roleId === "ROLE-04" ? { ...body as object, composition: "REGULATORY", scope: "CITY_AGGREGATE" } : body);
    return fulfillJson(route, { error: { code: "TEST_ROUTE_MISSING", message: "Browser fixture route is unavailable." } }, 404);
  });
  return activePrincipal;
}

for (const roleId of Object.keys(navigation) as RoleId[]) {
  test(`${roleId} restores only its server-derived navigation`, async ({ page }) => {
    const activePrincipal = await authenticatedApi(page, roleId);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.locator("nav a")).toHaveText(navigation[roleId]);
    await expect(page.getByText(activePrincipal.institutionDisplayName, { exact: true })).toBeVisible();
    await expect(page.getByText("SIMULATION ONLY", { exact: true })).toBeVisible();
  });
}

test("login fails safely, then accepts only the server-returned principal and can revoke the session", async ({ page }) => {
  const activePrincipal = principal("ROLE-01");
  const password = randomBytes(24).toString("base64url");
  let attempts = 0;
  let revoked = false;
  await page.route("**/api/v1/**", route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/session" && request.method() === "GET") return fulfillJson(route, { error: { code: "AUTH_REQUIRED", message: "A valid session is required." } }, 401);
    if (path === "/api/v1/auth/session" && request.method() === "POST") {
      attempts += 1;
      if (attempts === 1) return fulfillJson(route, { error: { code: "AUTH_FAILED", message: "Credentials were not accepted." } }, 401);
      const submitted = request.postDataJSON() as { username: string; password: string };
      expect(submitted.username).toBe("synth_browser_user");
      expect(submitted.password).toBe(password);
      return fulfillJson(route, { principal: activePrincipal });
    }
    if (path === "/api/v1/auth/session" && request.method() === "DELETE") { revoked = true; return route.fulfill({ status: 204 }); }
    if (path === "/api/v1/dashboard") return fulfillJson(route, responses[path]);
    return fulfillJson(route, {}, 404);
  });
  await page.goto("/");
  await page.getByLabel("Username").fill("synth_browser_user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Credentials were not accepted.");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  expect(revoked).toBe(true);
});

test("regulatory navigation renders every selected read-only page and CSV boundary", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await authenticatedApi(page, "ROLE-04");
  await page.goto("/");
  for (const [label, heading, path] of [["Inventory", "Inventory", "/inventory"], ["Transfers", "Transfers", "/transfers"], ["Alerts", "Alerts", "/alerts"], ["Network view", "Network view", "/consortium"], ["Audit", "Audit", "/audit"], ["Reports", "Reports", "/reporting"], ["Profile", "Profile", "/profile"]] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    expect(pageErrors).toEqual([]);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit|Approve|Acknowledge|Dispatch|Receipt/ })).toHaveCount(0);
    if (path === "/reporting") {
      await expect(page.getByRole("link", { name: "Download simulation CSV" })).toHaveAttribute("href", "/api/v1/reports/inventory.csv");
    }
  }
});

test("failed dashboard load exposes a non-destructive retry and recovers", async ({ page }) => {
  let dashboardCalls = 0;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v1/dashboard") return false;
    dashboardCalls += 1;
    if (dashboardCalls === 1) await fulfillJson(route, { error: { code: "PROJECTION_UNAVAILABLE", message: "Projection is temporarily unavailable." } }, 503);
    else await fulfillJson(route, responses[path]);
    return true;
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Projection is temporarily unavailable.");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Ledger-confirmed", { exact: true })).toBeVisible();
  expect(dashboardCalls).toBe(2);
});

test("inventory exposes loading and empty states without inventing committed data", async ({ page }) => {
  let releaseInventory: (() => void) | undefined;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v1/inventory") return false;
    await new Promise<void>(resolve => { releaseInventory = resolve; });
    await fulfillJson(route, { scope: "INSTITUTION", aggregates: [], units: [], classification: "SIMULATION_ONLY" });
    return true;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByText("Loading authorized data", { exact: true })).toBeVisible();
  expect(releaseInventory).toBeDefined();
  releaseInventory?.();
  await expect(page.getByText("No committed inventory", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("0 records");
});

test("refresh failure preserves confirmed data and backs off until manual retry", async ({ page }) => {
  let dashboardCalls = 0;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v1/dashboard") return false;
    dashboardCalls += 1;
    if (dashboardCalls === 2) await fulfillJson(route, { error: { code: "PROJECTION_UNAVAILABLE", message: "Projection is temporarily unavailable." } }, 503);
    else await fulfillJson(route, responses[path]);
    return true;
  });
  await page.goto("/");
  await expect(page.getByText("Ledger-confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Showing the last confirmed view. Refresh failed: Projection is temporarily unavailable.");
  expect(dashboardCalls).toBe(2);
  await page.waitForTimeout(2_200);
  expect(dashboardCalls).toBe(2);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(dashboardCalls).toBe(3);
});

test("route changes clean up the previous poller and refresh only the active page", async ({ page }) => {
  let dashboardCalls = 0;
  let inventoryCalls = 0;
  await authenticatedApi(page, "ROLE-01", (_route, path) => {
    if (path === "/api/v1/dashboard") dashboardCalls += 1;
    if (path === "/api/v1/inventory") inventoryCalls += 1;
    return false;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
  await page.waitForTimeout(2_200);
  expect(dashboardCalls).toBe(1);
  expect(inventoryCalls).toBeGreaterThanOrEqual(2);
});

test("keyboard navigation reaches an authorized page without changing institution scope", async ({ page }) => {
  const activePrincipal = await authenticatedApi(page, "ROLE-06");
  await page.goto("/");
  await page.getByRole("link", { name: "Profile", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByText(activePrincipal.institutionId, { exact: true })).toBeVisible();
  await expect(page.getByText("Role and institution cannot be changed from this browser session.")).toBeVisible();
});
