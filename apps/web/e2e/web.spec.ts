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

function dashboardFor(roleId: RoleId) {
  const body = responses["/api/v1/dashboard"] as object;
  if (roleId === "ROLE-04") return { ...body, composition: "REGULATORY", scope: "CITY_AGGREGATE" };
  if (roleId === "ROLE-03") return { ...body, composition: "OPERATIONAL", scope: "CITY_AGGREGATE" };
  if (["ROLE-05", "ROLE-06"].includes(roleId)) return { ...body, composition: "ADMINISTRATIVE", scope: "PRINCIPAL", inventory: [], pendingScans: [], lastSuccessfulProjectionAt: null };
  return body;
}

async function authenticatedApi(page: Page, roleId: RoleId, override?: (route: Route, path: string) => boolean | Promise<boolean>, principalOverride: Partial<ReturnType<typeof principal>> = {}) {
  const activePrincipal = { ...principal(roleId), ...principalOverride };
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (override && await override(route, path)) return;
    if (path === "/api/v1/auth/session") return fulfillJson(route, { principal: activePrincipal });
    if (path === "/api/v1/reports/inventory.csv") return route.fulfill({ status: 200, contentType: "text/csv", body: "classification\nSIMULATION_ONLY\n" });
    const body = responses[path];
    if (path === "/api/v1/dashboard") return fulfillJson(route, dashboardFor(roleId));
    if (body) return fulfillJson(route, body);
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
    await expect(page.locator(".side-brand")).toBeVisible();
    await expect(page.locator(".facility-context")).toBeVisible();
    await expect(page.locator(".page-head")).toBeVisible();
    await expect(page.getByText(activePrincipal.institutionDisplayName, { exact: true })).toBeVisible();
    await expect(page.getByText("SIMULATION ONLY", { exact: true })).toBeVisible();
  });
}

test("two synthetic secondary hospitals share structure while retaining distinct context", async ({ browser }) => {
  for (const [institutionId, institutionDisplayName, confirmedCount] of [
    ["INST_SYNTH_SECONDARY_A", "Synthetic Secondary Hospital A", 2],
    ["INST_SYNTH_SECONDARY_B", "Synthetic Secondary Hospital B", 7],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticatedApi(page, "ROLE-03", async (route, path) => {
      if (path !== "/api/v1/dashboard") return false;
      await fulfillJson(route, { ...dashboardFor("ROLE-03"), inventory: [{ ...aggregate, institutionId, institutionDisplayName, confirmedCount }] });
      return true;
    }, { institutionId, institutionDisplayName });
    await page.goto("/");
    await expect(page.getByText("Secondary-hospital coordination", { exact: true })).toBeVisible();
    await expect(page.getByText(`${institutionDisplayName} requests, transfers, receipts, and alerts with approved city-wide inventory aggregates.`, { exact: true })).toBeVisible();
    const confirmed = page.locator(".stats article").filter({ hasText: "Ledger-confirmed" }).locator("strong");
    await expect(confirmed).toHaveText(String(confirmedCount));
    await expect(page.getByRole("link", { name: "Inventory", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("PRC, DOH, and administrators receive truthful non-operational compositions", async ({ browser }) => {
  const cases = [
    ["ROLE-04", "INST_SYNTH_PRC", "Synthetic PRC Chapter", "Regulatory overview"],
    ["ROLE-04", "INST_SYNTH_DOH", "Synthetic DOH Office", "Regulatory overview"],
    ["ROLE-05", "INST_SYNTH_SYSTEM", "Synthetic System Scope", "Administration"],
    ["ROLE-06", "INST_SYNTH_ACCOUNT", "Synthetic Institution Account", "Administration"],
  ] as const;
  for (const [roleId, institutionId, institutionDisplayName, eyebrow] of cases) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticatedApi(page, roleId, undefined, { institutionId, institutionDisplayName });
    await page.goto("/");
    await expect(page.getByText(institutionDisplayName, { exact: true })).toBeVisible();
    await expect(page.getByText(eyebrow, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open capture workspace" })).toHaveCount(0);
    if (roleId === "ROLE-04") {
      await expect(page.getByText("Ledger-confirmed", { exact: true })).toBeVisible();
      await expect(page.getByText("Non-clinical workspace", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Non-clinical workspace", { exact: true })).toBeVisible();
      await expect(page.getByText("Ledger-confirmed", { exact: true })).toHaveCount(0);
    }
    await context.close();
  }
});

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
  await expect(page.locator(".auth-hero")).toBeVisible();
  await expect(page.locator(".auth-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One ledger. Clear custody. Every unit accounted for." })).toBeVisible();
  await expect(page.getByText("Server-assigned access", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply for access" })).toHaveCount(0);
  await page.getByLabel("Username").fill("synth_browser_user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Credentials were not accepted.");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to BloodLedger" })).toBeVisible();
  expect(revoked).toBe(true);
});

test("secondary request retry preserves idempotency and excludes caller-selected scope", async ({ page }) => {
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  await authenticatedApi(page, "ROLE-03", async (route, path) => {
    const request = route.request();
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "DESTINATION_INSTITUTION", transfers: [], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path !== "/api/v1/transfers" || request.method() !== "POST") return false;
    attempts += 1;
    submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
    if (attempts === 1) {
      await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry with the same idempotency key." } }, 503);
      return true;
    }
    await fulfillJson(route, { transferId: "TRF_SYNTH_BROWSER_CREATED", status: "PENDING", replayed: false, classification: "SIMULATION_ONLY" }, 201);
    return true;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByLabel("Blood type").selectOption("O_POSITIVE");
  await page.getByLabel("Component").selectOption("PLATELETS");
  await page.getByLabel("Quantity").fill("3");
  await page.getByLabel("Urgency").selectOption("URGENT");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText("retry with the same idempotency key");
  await page.getByRole("button", { name: "Retry same request" }).click();
  await expect(page.getByRole("status")).toContainText("Committed as TRF_SYNTH_BROWSER_CREATED");
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  const submitted = submissions[0];
  expect(submitted.idempotencyKey).toMatch(/^IDEM_WEB_[0-9A-F]{32}$/);
  expect(Object.keys(submitted.body).sort()).toEqual(["bloodType", "component", "correlationId", "eventTime", "quantity", "requestTime", "urgency"]);
  expect(submitted.body).toMatchObject({ bloodType: "O_POSITIVE", component: "PLATELETS", quantity: 3, urgency: "URGENT" });
  expect("institutionId" in submitted.body).toBe(false);
});

test("human FEFO approval retry preserves intent and never submits selected units", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_APPROVAL", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SYNTH_SECONDARY_A", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "URGENT", requestTime: timestamp, status: "PENDING", reasonCode: null, recommendationDigest: null, ledgerVersion: 1, projectedAt: timestamp, dispatchEvidenceRecorded: false, receiptEvidenceRecorded: false };
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  let approved = false;
  await authenticatedApi(page, "ROLE-02", async (route, path) => {
    const request = route.request();
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "SOURCE_INSTITUTION", transfers: [{ ...baseTransfer, status: approved ? "APPROVED" : "PENDING", ledgerVersion: approved ? 2 : 1 }], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      const transfer = { ...baseTransfer, status: approved ? "APPROVED" : "PENDING", ledgerVersion: approved ? 2 : 1 };
      await fulfillJson(route, { transfer, selectedUnitIds: approved ? ["UNIT_SYNTH_FEFO_BROWSER_01"] : [], timeline: [], explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/approval` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same approval." } }, 503);
        return true;
      }
      approved = true;
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "APPROVED", selectedUnitIds: ["UNIT_SYNTH_FEFO_BROWSER_01"], ledgerVersion: 2, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await expect(page.locator(".transfer-overview")).toBeVisible();
  await expect(page.locator(".transfer-route")).toContainText("INST_MEDIATRIX");
  await expect(page.getByRole("button", { name: "View" })).toBeInViewport({ ratio: 1 });
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByText("Human FEFO authorization", { exact: true })).toBeVisible();
  await expect(page.getByText("Disabled; human authorization required", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve FEFO selection" }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same approval");
  await page.getByRole("button", { name: "Retry same approval" }).click();
  await expect(page.getByText("FEFO-selected units", { exact: true })).toBeVisible();
  await expect(page.getByText("UNIT_SYNTH_FEFO_BROWSER_01", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  const submitted = submissions[0];
  expect(Object.keys(submitted.body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion"]);
  expect(submitted.body).toMatchObject({ expectedVersion: 1 });
  expect("selectedUnitIds" in submitted.body).toBe(false);
  expect("institutionId" in submitted.body).toBe(false);
});

test("human rejection retry preserves controlled reason and source authority", async ({ page }) => {
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_REJECTION", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "ROUTINE", requestTime: timestamp, status: "PENDING", reasonCode: null, recommendationDigest: null, ledgerVersion: 1, projectedAt: timestamp, dispatchEvidenceRecorded: false, receiptEvidenceRecorded: false };
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  let rejected = false;
  await authenticatedApi(page, "ROLE-02", async (route, path) => {
    const request = route.request();
    const transfer = { ...baseTransfer, status: rejected ? "REJECTED" : "PENDING", reasonCode: rejected ? "INSUFFICIENT_STOCK" : null, ledgerVersion: rejected ? 2 : 1 };
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "SOURCE_INSTITUTION", transfers: [transfer], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      await fulfillJson(route, { transfer, selectedUnitIds: [], timeline: [], explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/rejection` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same rejection." } }, 503);
        return true;
      }
      rejected = true;
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "REJECTED", reasonCode: "INSUFFICIENT_STOCK", ledgerVersion: 2, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Reject request", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same rejection");
  await page.getByRole("button", { name: "Retry same rejection", exact: true }).click();
  await expect(page.getByText("REJECTED at version 2", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  expect(Object.keys(submissions[0].body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion", "reasonCode"]);
  expect(submissions[0].body).toMatchObject({ expectedVersion: 1, reasonCode: "INSUFFICIENT_STOCK" });
  expect("institutionId" in submissions[0].body).toBe(false);
  expect("actorUserId" in submissions[0].body).toBe(false);
});

test("approved cancellation retry preserves reason through projection reconciliation", async ({ page }) => {
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_CANCELLATION", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "URGENT", requestTime: timestamp, status: "APPROVED", reasonCode: null, recommendationDigest: null, ledgerVersion: 2, projectedAt: timestamp, dispatchEvidenceRecorded: false, receiptEvidenceRecorded: false };
  const selectedUnitId = "UNIT_SYNTH_CANCEL_BROWSER_01";
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  let cancelled = false;
  await authenticatedApi(page, "ROLE-02", async (route, path) => {
    const request = route.request();
    const transfer = { ...baseTransfer, status: cancelled ? "CANCELLED" : "APPROVED", reasonCode: cancelled ? "REQUEST_WITHDRAWN" : null, ledgerVersion: cancelled ? 3 : 2 };
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "SOURCE_INSTITUTION", transfers: [transfer], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      await fulfillJson(route, { transfer, selectedUnitIds: [selectedUnitId], timeline: [], explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/cancellation` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "PROJECTION_RECONCILIATION_FAILED", message: "Cancellation requires reconciliation; retry the same cancellation." } }, 503);
        return true;
      }
      cancelled = true;
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "CANCELLED", reasonCode: "REQUEST_WITHDRAWN", releasedUnitIds: [selectedUnitId], ledgerVersion: 3, replayed: true, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Cancel transfer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same cancellation");
  await page.getByRole("button", { name: "Retry same cancellation", exact: true }).click();
  await expect(page.getByText("CANCELLED at version 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record dispatch", exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  expect(Object.keys(submissions[0].body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion", "reasonCode"]);
  expect(submissions[0].body).toMatchObject({ expectedVersion: 2, reasonCode: "REQUEST_WITHDRAWN" });
  expect("releasedUnitIds" in submissions[0].body).toBe(false);
  expect("institutionId" in submissions[0].body).toBe(false);
});

test("dispatch retry preserves approved synthetic source evidence and mutation identity", async ({ page }) => {
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_DISPATCH", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "URGENT", requestTime: timestamp, status: "APPROVED", reasonCode: null, recommendationDigest: null, ledgerVersion: 2, projectedAt: timestamp, dispatchEvidenceRecorded: false, receiptEvidenceRecorded: false };
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  let dispatched = false;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    const request = route.request();
    const transfer = { ...baseTransfer, status: dispatched ? "DISPATCHED" : "APPROVED", ledgerVersion: dispatched ? 3 : 2, dispatchEvidenceRecorded: dispatched };
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "SOURCE_INSTITUTION", transfers: [transfer], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      await fulfillJson(route, { transfer, selectedUnitIds: ["UNIT_SYNTH_DISPATCH_BROWSER_01"], timeline: [], explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/dispatch` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same dispatch." } }, 503);
        return true;
      }
      dispatched = true;
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "DISPATCHED", ledgerVersion: 3, locationEvidence: { source: "FACILITY_FALLBACK", fallbackReason: "PERMISSION_DENIED", policyVersion: "SYNTHETIC_LOCATION_V1", evidenceDigest: "a".repeat(64), exactLocationRetainedUntil: "2026-09-23T03:00:00.000Z" }, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByLabel("Fallback reason").selectOption("PERMISSION_DENIED");
  await page.getByRole("button", { name: "Record dispatch" }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same dispatch");
  await page.getByRole("button", { name: "Retry same dispatch" }).click();
  await expect(page.getByText("DISPATCHED at version 3", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  const submitted = submissions[0];
  expect(Object.keys(submitted.body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion", "location"]);
  expect(submitted.body).toMatchObject({ expectedVersion: 2 });
  expect(submitted.body.location).toEqual({ latitude: 0, longitude: 0, accuracyMetres: 50, source: "FACILITY_FALLBACK", fallbackReason: "PERMISSION_DENIED", capturedAt: submitted.body.eventTime });
  expect("institutionId" in submitted.body).toBe(false);
  expect("selectedUnitIds" in submitted.body).toBe(false);
});

test("transit delay and resume retries preserve custody and versioned intent", async ({ page }) => {
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_TRANSIT", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "URGENT", requestTime: timestamp, status: "DISPATCHED", reasonCode: null, recommendationDigest: null, ledgerVersion: 3, projectedAt: timestamp, dispatchEvidenceRecorded: true, receiptEvidenceRecorded: false };
  const selectedUnitId = "UNIT_SYNTH_TRANSIT_BROWSER_01";
  const submissions = {
    transit: [] as { idempotencyKey: string; body: Record<string, unknown> }[],
    delay: [] as { idempotencyKey: string; body: Record<string, unknown> }[],
    resume: [] as { idempotencyKey: string; body: Record<string, unknown> }[],
  };
  const attempts = { transit: 0, delay: 0, resume: 0 };
  let state: { status: string; ledgerVersion: number; reasonCode: string | null } = { status: "DISPATCHED", ledgerVersion: 3, reasonCode: null };
  await authenticatedApi(page, "ROLE-02", async (route, path) => {
    const request = route.request();
    const transfer = { ...baseTransfer, ...state };
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "SOURCE_INSTITUTION", transfers: [transfer], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      const timeline = state.ledgerVersion >= 5 ? [{ eventId: "TEVT_" + "D".repeat(40), fromStatus: "IN_TRANSIT", toStatus: "DELAYED", eventTime: timestamp, reasonCode: "ROUTE_DELAY", ledgerTransactionId: "TX_SYNTH_TRANSIT_DELAY_BROWSER", ledgerVersion: 5, correlationId: "CORR_" + "D".repeat(32) }] : [];
      await fulfillJson(route, { transfer, selectedUnitIds: [selectedUnitId], timeline, explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/transit-start` && request.method() === "POST") {
      attempts.transit += 1;
      submissions.transit.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts.transit === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same transit transition." } }, 503);
        return true;
      }
      state = { status: "IN_TRANSIT", ledgerVersion: 4, reasonCode: null };
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "IN_TRANSIT", inTransitUnitIds: [selectedUnitId], ledgerVersion: 4, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/delay` && request.method() === "POST") {
      attempts.delay += 1;
      submissions.delay.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts.delay === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same delay." } }, 503);
        return true;
      }
      state = { status: "DELAYED", ledgerVersion: 5, reasonCode: "ROUTE_DELAY" };
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "DELAYED", reasonCode: "ROUTE_DELAY", ledgerVersion: 5, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/resume` && request.method() === "POST") {
      attempts.resume += 1;
      submissions.resume.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts.resume === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same resume transition." } }, 503);
        return true;
      }
      state = { status: "IN_TRANSIT", ledgerVersion: 6, reasonCode: "ROUTE_DELAY" };
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "IN_TRANSIT", inTransitUnitIds: [selectedUnitId], ledgerVersion: 6, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Start transit", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same transit transition");
  await page.getByRole("button", { name: "Retry same transition", exact: true }).click();
  await expect(page.getByText("IN TRANSIT at version 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Report route delay", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same delay");
  await page.getByRole("button", { name: "Retry same delay", exact: true }).click();
  await expect(page.getByText("DELAYED at version 5", { exact: true })).toBeVisible();
  await expect(page.getByText(selectedUnitId, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume transit", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same resume transition");
  await page.getByRole("button", { name: "Retry same transition", exact: true }).click();
  await expect(page.getByText("IN TRANSIT at version 6", { exact: true })).toBeVisible();
  await expect(page.getByText("ROUTE DELAY", { exact: true })).toBeVisible();
  await expect(page.getByText(selectedUnitId, { exact: true })).toBeVisible();
  for (const records of [submissions.transit, submissions.delay, submissions.resume]) {
    expect(records).toHaveLength(2);
    expect(records[0].idempotencyKey).toBe(records[1].idempotencyKey);
    expect(records[0].body).toEqual(records[1].body);
    expect("institutionId" in records[0].body).toBe(false);
    expect("selectedUnitIds" in records[0].body).toBe(false);
  }
  expect(submissions.transit[0].body).toMatchObject({ expectedVersion: 3 });
  expect(Object.keys(submissions.transit[0].body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion"]);
  expect(submissions.delay[0].body).toMatchObject({ expectedVersion: 4, reasonCode: "ROUTE_DELAY" });
  expect(Object.keys(submissions.delay[0].body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion", "reasonCode"]);
  expect(submissions.resume[0].body).toMatchObject({ expectedVersion: 5 });
  expect(Object.keys(submissions.resume[0].body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion"]);
  expect(new Set([submissions.transit[0].idempotencyKey, submissions.delay[0].idempotencyKey, submissions.resume[0].idempotencyKey]).size).toBe(3);
});

test("receipt retry preserves approved synthetic destination evidence and scoped authority", async ({ page }) => {
  const baseTransfer = { transferId: "TRF_SYNTH_BROWSER_RECEIPT", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_METRO_LIPA", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", quantity: 1, urgency: "URGENT", requestTime: timestamp, status: "IN_TRANSIT", reasonCode: null, recommendationDigest: null, ledgerVersion: 4, projectedAt: timestamp, dispatchEvidenceRecorded: true, receiptEvidenceRecorded: false };
  const submissions: { idempotencyKey: string; body: Record<string, unknown> }[] = [];
  let attempts = 0;
  let received = false;
  await authenticatedApi(page, "ROLE-03", async (route, path) => {
    const request = route.request();
    const transfer = { ...baseTransfer, status: received ? "RECEIVED" : "IN_TRANSIT", ledgerVersion: received ? 5 : 4, receiptEvidenceRecorded: received };
    if (path === "/api/v1/transfers" && request.method() === "GET") {
      await fulfillJson(route, { scope: "DESTINATION_INSTITUTION", transfers: [transfer], classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}` && request.method() === "GET") {
      await fulfillJson(route, { transfer, selectedUnitIds: ["UNIT_SYNTH_RECEIPT_BROWSER_01"], timeline: [], explanations: [], selectionPolicy: "FEFO", recommendationEligibility: "DISABLED_UNAPPROVED_POLICY", automaticApproval: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    if (path === `/api/v1/transfers/${baseTransfer.transferId}/receipt` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "FABRIC_GATEWAY_UNAVAILABLE", message: "The ledger is unavailable; retry the same receipt." } }, 503);
        return true;
      }
      received = true;
      await fulfillJson(route, { transferId: baseTransfer.transferId, status: "RECEIVED", ledgerVersion: 5, locationEvidence: { source: "FACILITY_FALLBACK", fallbackReason: "SIGNAL_UNAVAILABLE", policyVersion: "SYNTHETIC_LOCATION_V1", evidenceDigest: "b".repeat(64), exactLocationRetainedUntil: "2026-09-23T03:00:00.000Z" }, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  }, { institutionId: "INST_METRO_LIPA", institutionDisplayName: "Synthetic Metro Lipa Hospital" });
  await page.goto("/");
  await page.getByRole("link", { name: "Transfers", exact: true }).click();
  await page.getByRole("button", { name: "View" }).click();
  await page.getByLabel("Fallback reason").selectOption("SIGNAL_UNAVAILABLE");
  await page.getByRole("button", { name: "Record receipt" }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same receipt");
  await page.getByRole("button", { name: "Retry same receipt" }).click();
  await expect(page.getByText("RECEIVED at version 5", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  const submitted = submissions[0];
  expect(Object.keys(submitted.body).sort()).toEqual(["correlationId", "eventTime", "expectedVersion", "location"]);
  expect(submitted.body).toMatchObject({ expectedVersion: 4 });
  expect(submitted.body.location).toEqual({ latitude: 0, longitude: 0.018, accuracyMetres: 50, source: "FACILITY_FALLBACK", fallbackReason: "SIGNAL_UNAVAILABLE", capturedAt: submitted.body.eventTime });
  expect("institutionId" in submitted.body).toBe(false);
  expect("destinationInstitutionId" in submitted.body).toBe(false);
});

test("alert acknowledgement retry preserves scoped intent and confirmed state", async ({ page }) => {
  const alertId = "ALRT_" + "A".repeat(40);
  const submissions: { idempotencyKey: string; body: Record<string, unknown>; path: string }[] = [];
  let attempts = 0;
  let acknowledged = false;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    const request = route.request();
    if (path === "/api/v1/alerts" && request.method() === "GET") {
      await fulfillJson(route, {
        scope: "INSTITUTION",
        alerts: [{ alertId, alertType: "EXPIRY_WARNING", severity: "WARNING", unitId: "UNIT_SYNTH_ALERT_BROWSER_01", bloodType: "A_POSITIVE", component: "RED_BLOOD_CELLS", expiresAt: timestamp, evaluatedAt: timestamp, status: "OPEN", acknowledged }],
        aggregates: [],
        classification: "SIMULATION_ONLY",
      });
      return true;
    }
    if (path === `/api/v1/alerts/${alertId}/acknowledgements` && request.method() === "POST") {
      attempts += 1;
      submissions.push({ path, idempotencyKey: request.headers()["idempotency-key"], body: request.postDataJSON() as Record<string, unknown> });
      if (attempts === 1) {
        await fulfillJson(route, { error: { code: "DATABASE_UNAVAILABLE", message: "Acknowledgement is unavailable; retry the same acknowledgement." } }, 503);
        return true;
      }
      acknowledged = true;
      await fulfillJson(route, { alertId, acknowledgedAt: timestamp, replayed: false, classification: "SIMULATION_ONLY" });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Alerts", exact: true }).click();
  await expect(page.getByText("UNIT_SYNTH_ALERT_BROWSER_01", { exact: true })).toBeVisible();
  await expect(page.locator(".alert-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Acknowledge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("retry the same acknowledgement");
  await page.getByRole("button", { name: "Retry acknowledgement", exact: true }).click();
  await expect(page.getByText("Acknowledged", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(submissions[0].path).toBe(`/api/v1/alerts/${alertId}/acknowledgements`);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
  expect(submissions[0].body).toEqual(submissions[1].body);
  expect(submissions[0].idempotencyKey).toMatch(/^IDEM_WEB_[0-9A-F]{32}$/);
  expect(Object.keys(submissions[0].body)).toEqual(["correlationId"]);
  expect(submissions[0].body.correlationId).toMatch(/^CORR_[0-9A-F]{32}$/);
  expect("alertId" in submissions[0].body).toBe(false);
  expect("institutionId" in submissions[0].body).toBe(false);
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
    if (path === "/consortium") await expect(page.locator(".regulatory-stats")).toBeVisible();
    if (path === "/audit") await expect(page.locator(".audit-summary")).toBeVisible();
    if (path === "/reporting") await expect(page.locator(".report-summary")).toBeVisible();
    if (path === "/profile") await expect(page.locator(".profile-identity")).toBeVisible();
    if (path === "/reporting") {
      await expect(page.getByRole("link", { name: "Download simulation CSV" })).toHaveAttribute("href", "/api/v1/reports/inventory.csv");
    }
  }
});

test("committed projection becomes visible within the frontend NFR-06 budget", async ({ page }, testInfo) => {
  let committed = false;
  let commitTime = "";
  let commitStartedAt = 0;
  let firstCommittedProjectionResponseAt = 0;
  let dashboardCalls = 0;
  await authenticatedApi(page, "ROLE-01", async (route, path) => {
    if (path !== "/api/v1/dashboard") return false;
    dashboardCalls += 1;
    if (committed && firstCommittedProjectionResponseAt === 0) firstCommittedProjectionResponseAt = Date.now();
    await fulfillJson(route, {
      composition: "OPERATIONAL",
      scope: "INSTITUTION",
      inventory: [{ ...aggregate, confirmedCount: committed ? 2 : 1, lastProjectedAt: committed ? commitTime : timestamp }],
      pendingScans: committed ? [] : [{ status: "PROCESSING", count: 1 }],
      lastSuccessfulProjectionAt: committed ? commitTime : timestamp,
      classification: "SIMULATION_ONLY",
    });
    return true;
  });
  await page.goto("/");
  const confirmedCount = page.locator(".stats article").filter({ hasText: "Ledger-confirmed" }).locator("strong");
  const pendingCount = page.locator(".stats article").filter({ hasText: "Uncommitted scan states" }).locator("strong");
  await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
  await expect(confirmedCount).toHaveText("1");
  await expect(pendingCount).toHaveText("1");
  commitTime = new Date().toISOString();
  commitStartedAt = Date.now();
  committed = true;
  await expect(confirmedCount).toHaveText("2", { timeout: 5_000 });
  await expect(pendingCount).toHaveText("0");
  const visibleAt = Date.now();
  expect(firstCommittedProjectionResponseAt).toBeGreaterThanOrEqual(commitStartedAt);
  expect(visibleAt - commitStartedAt).toBeLessThanOrEqual(5_000);
  await testInfo.attach("nfr-06-frontend-timing", {
    body: JSON.stringify({ commitTime, commitStartedAt, firstCommittedProjectionResponseAt, visibleAt, elapsedMilliseconds: visibleAt - commitStartedAt }, null, 2),
    contentType: "application/json",
  });
  expect(dashboardCalls).toBeGreaterThanOrEqual(2);
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
  await expect(page.locator(".blood-type")).toHaveText("A+");
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
