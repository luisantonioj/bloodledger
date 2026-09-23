import { expect, test, type Page } from "@playwright/test";
import labels from "../test/inbound-labels-v2.json" with { type: "json" };

type Label = (typeof labels)[number];

const principal = {
  userId: "USR_SYNTH_CAPTURE_V2",
  displayName: "Synthetic Capture Operator",
  institutionId: "INST_MEDIATRIX",
  institutionDisplayName: "Synthetic Mediatrix Review",
  roleId: "ROLE-01",
  roleDisplayName: "Blood Bank Staff",
  classification: "SIMULATION_ONLY",
};

function escaped(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function labelImage(page: Page, label: Label, extraLine = ""): Promise<Buffer> {
  const lines = [
    `DONATION NO: ${label.donationNumber}`,
    `BLOOD TYPE: ${label.bloodType}`,
    `COMPONENT: ${label.componentType}`,
    `COLLECTED AT: ${label.collectedAt}`,
    `EXPIRES AT: ${label.expiresAt}`,
    extraLine,
  ].filter(Boolean);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.setContent(`
    <style>body{margin:0;background:white}#label{width:1320px;padding:70px;background:white;color:black;font:700 46px/1.55 Arial,sans-serif;letter-spacing:1px}.line{white-space:nowrap}</style>
    <div id="label">${lines.map((line) => `<div class="line">${escaped(line)}</div>`).join("")}</div>
  `);
  return await page.locator("#label").screenshot({ type: "png" });
}

async function restoreCaptureSession(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ principal }),
  }));
  await page.route("**/api/v2/commands", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scope: "ACTOR_INSTITUTION", commands: [], nextCursor: null, classification: "SIMULATION_ONLY" }) }));
}

async function recognize(page: Page, image: Buffer, name: string): Promise<void> {
  await page.getByLabel("Synthetic inbound label image").setInputFiles({ name, mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Run OCR" }).click();
  await expect(page.getByRole("heading", { name: "2. Confirm extracted fields" })).toBeVisible({ timeout: 90_000 });
}

test("PA-S6-02 extracts a synthetic inbound label on device without external requests", async ({ browser }) => {
  const app = await browser.newPage();
  const generator = await browser.newPage();
  const externalRequests: string[] = [];
  await restoreCaptureSession(app);
  app.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:4173") externalRequests.push(request.url());
  });
  await app.goto("/capture/");
  await expect(app.getByText("Inbound OCR Capture", { exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Blood Component Intake" })).toBeVisible();
  await recognize(app, await labelImage(generator, labels[0]), "inbound-v2.png");
  const evidence = await app.locator("dl").innerText();
  for (const value of Object.values(labels[0])) expect(evidence).toContain(value);
  expect(externalRequests).toEqual([]);
  await app.getByRole("button", { name: "Cancel capture" }).click();
  await expect(app.getByText(labels[0].donationNumber)).toHaveCount(0);
  await expect(app.getByLabel("Synthetic inbound label image")).toHaveValue("");
  await app.close();
  await generator.close();
});

test("NFR-05 keeps exact Donation No. volatile and blocks offline V2 submission", async ({ page, context }) => {
  await restoreCaptureSession(page);
  let submissions = 0;
  await page.route("**/api/v2/inbound-captures", (route) => {
    submissions += 1;
    return route.abort();
  });
  await page.goto("/capture/");
  const generator = await context.newPage();
  await recognize(page, await labelImage(generator, labels[1]), "offline-v2.png");
  await generator.close();
  await context.setOffline(true);
  await expect(page.getByText("Offline V2 submission is disabled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I confirm every field" })).toBeDisabled();
  expect(submissions).toBe(0);
  const persisted = await page.evaluate(async () => {
    const names = await indexedDB.databases();
    const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const query = database.transaction("command-receipts").objectStore("command-receipts").getAll();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return { names: names.map((item) => item.name), values };
  });
  expect(persisted.names).not.toContain("bloodledger-synthetic-capture-v1");
  expect(JSON.stringify(persisted)).not.toContain(labels[1].donationNumber);
});

test("FR-01 tracks one accepted V2 command to commitment without resubmission or sensitive storage", async ({ page, context }) => {
  await restoreCaptureSession(page);
  let submissions = 0;
  let polls = 0;
  await page.route("**/api/v2/inbound-captures", async (route) => {
    submissions += 1;
    const request = route.request();
    expect(request.headers()["x-bloodledger-contract-version"]).toBe("V2.1");
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.captureMethod).toBe("OCR");
    expect(body.capturePolicyVersion).toBe("INBOUND_OCR_V1");
    expect(body).not.toHaveProperty("custodyInstitutionId");
    expect(body).not.toHaveProperty("rawText");
    expect(body).not.toHaveProperty("image");
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({
      commandId: "CMD_SYNTH_BROWSER_001",
      resourceType: "INBOUND_CAPTURE",
      resourceId: "INCAP_SYNTH_BROWSER_001",
      status: "QUEUED",
      statusUrl: "/api/v2/commands/CMD_SYNTH_BROWSER_001",
      acceptedAt: "2026-09-18T00:00:00.000Z",
      correlationId: body.correlationId,
      safeErrorCode: null,
      classification: "SIMULATION_ONLY",
      replayed: false,
    }) });
  });
  await page.route("**/api/v2/commands/CMD_SYNTH_BROWSER_001", (route) => {
    polls += 1;
    const status = polls === 1 ? "LEDGER_COMMITTED_PROJECTION_PENDING" : "COMMITTED";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      commandId: "CMD_SYNTH_BROWSER_001",
      resourceType: "INBOUND_CAPTURE",
      resourceId: "INCAP_SYNTH_BROWSER_001",
      status,
      statusUrl: "/api/v2/commands/CMD_SYNTH_BROWSER_001",
      acceptedAt: "2026-09-18T00:00:00.000Z",
      correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF",
      safeErrorCode: null,
      classification: "SIMULATION_ONLY",
      replayed: false,
    }) });
  });
  await page.goto("/capture/");
  const generator = await context.newPage();
  const cryoprecipitate = labels.find((label) => label.componentType === "CRYOPRECIPITATE")!;
  await recognize(page, await labelImage(generator, cryoprecipitate), "v21.png");
  await generator.close();
  await page.getByRole("button", { name: "I confirm every field" }).click();
  await expect(page.getByText("COMMITTED", { exact: true })).toBeVisible({ timeout: 15_000 });
  expect(submissions).toBe(1);
  const persisted = await page.evaluate(async () => {
    const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const query = database.transaction("command-receipts").objectStore("command-receipts").getAll();
    const values = await new Promise<unknown[]>((resolve, reject) => {
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return values;
  });
  expect(JSON.stringify(persisted)).not.toContain(cryoprecipitate.donationNumber);
  expect(JSON.stringify(persisted)).toContain("CMD_SYNTH_BROWSER_001");
});

test("reload recovers an accepted inbound command without resubmission and logout clears receipts", async ({ page }) => {
  await restoreCaptureSession(page);
  let submissions = 0;
  await page.route("**/api/v2/inbound-captures", (route) => { submissions += 1; return route.abort(); });
  const recovered = { commandId: "CMD_SYNTH_RECOVER_001", resourceType: "INBOUND_CAPTURE", resourceId: "INCAP_SYNTH_RECOVER_001", status: "COMMITTED", statusUrl: "/api/v2/commands/CMD_SYNTH_RECOVER_001", acceptedAt: new Date().toISOString(), correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", safeErrorCode: null, classification: "SIMULATION_ONLY", replayed: false };
  await page.route("**/api/v2/commands", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scope: "ACTOR_INSTITUTION", commands: [recovered], nextCursor: null, classification: "SIMULATION_ONLY" }) }));
  await page.goto("/capture/");
  await expect(page.getByText("INCAP_SYNTH_RECOVER_001", { exact: true })).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByRole("button", { name: /Sign out Synthetic Capture Operator/ }).click();
  const receipts = await page.evaluate(async () => {
    const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = db.transaction("command-receipts").objectStore("command-receipts").getAll();
    const values = await new Promise<unknown[]>((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    db.close(); return values;
  });
  expect(receipts).toEqual([]);
});

test("old accepted command starts retention when terminal status is first observed", async ({ page }) => {
  await restoreCaptureSession(page);
  const recovered = { commandId: "CMD_SYNTH_OLD_TERMINAL", resourceType: "INBOUND_CAPTURE", resourceId: "INCAP_SYNTH_OLD_TERMINAL", status: "COMMITTED", statusUrl: "/api/v2/commands/CMD_SYNTH_OLD_TERMINAL", acceptedAt: "2025-01-01T00:00:00.000Z", correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", safeErrorCode: null, classification: "SIMULATION_ONLY", replayed: false };
  await page.route("**/api/v2/commands", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scope: "ACTOR_INSTITUTION", commands: [recovered], nextCursor: null, classification: "SIMULATION_ONLY" }) }));
  await page.goto("/capture/");
  await expect(page.getByText("INCAP_SYNTH_OLD_TERMINAL", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = db.transaction("command-receipts", "readwrite");
    const store = transaction.objectStore("command-receipts");
    const receipt = await new Promise<Record<string, unknown>>((resolve, reject) => { const request = store.get("CMD_SYNTH_OLD_TERMINAL"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    store.put({ ...receipt, terminalObservedAt: "2025-01-02T00:00:00.000Z" });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  });
  await page.reload();
  await expect(page.getByText("INCAP_SYNTH_OLD_TERMINAL", { exact: true })).toHaveCount(0);
  const tombstone = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const key = "USR_SYNTH_CAPTURE_V2:CMD_SYNTH_OLD_TERMINAL";
    const result = await new Promise<unknown>((resolve, reject) => { const request = db.transaction("expired-command-ids").objectStore("expired-command-ids").get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return result;
  });
  expect(tombstone).toBeTruthy();
});

test("late intake response after logout cannot restore a receipt", async ({ page, context }) => {
  await restoreCaptureSession(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v2/inbound-captures", async (route) => {
    await held;
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ commandId: "CMD_SYNTH_LATE", resourceType: "INBOUND_CAPTURE", resourceId: "INCAP_SYNTH_LATE", status: "QUEUED", statusUrl: "/api/v2/commands/CMD_SYNTH_LATE", acceptedAt: new Date().toISOString(), correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", safeErrorCode: null, classification: "SIMULATION_ONLY", replayed: false }) });
  });
  await page.goto("/capture/");
  const generator = await context.newPage();
  await recognize(page, await labelImage(generator, labels[0]), "late-v2.png");
  await generator.close();
  const requested = page.waitForRequest("**/api/v2/inbound-captures");
  await page.getByRole("button", { name: "I confirm every field" }).click();
  await requested;
  await page.getByRole("button", { name: /Sign out Synthetic Capture Operator/ }).click();
  release?.();
  await expect(page.getByText("INCAP_SYNTH_LATE", { exact: true })).toHaveCount(0);
  await expect(page.getByText(labels[0].donationNumber)).toHaveCount(0);
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("bloodledger-inbound-command-status-v2", 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const result = await new Promise<unknown[]>((resolve, reject) => { const request = db.transaction("command-receipts").objectStore("command-receipts").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return result;
  });
  expect(persisted).toEqual([]);
});
