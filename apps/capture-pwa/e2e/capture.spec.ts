import { expect, test, type Page } from "@playwright/test";
import labels from "../test/synthetic-labels.json" with { type: "json" };

type Label = (typeof labels)[number];

function escaped(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function labelImage(page: Page, label: Label, extraLine = "", style = ""): Promise<Buffer> {
  const lines = [
    `UNIT ID: ${label.unitId}`,
    `BLOOD TYPE: ${label.bloodType}`,
    `COMPONENT: ${label.component}`,
    `COLLECTED AT: ${label.collectedAt}`,
    `EXPIRES AT: ${label.expiresAt}`,
    extraLine,
  ].filter(Boolean);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.setContent(`
    <style>
      body { margin: 0; background: white; }
      #label { width: 1320px; padding: 70px; background: white; color: black;
        font: 700 46px/1.55 Arial, sans-serif; letter-spacing: 1px; ${style} }
      .line { white-space: nowrap; }
    </style>
    <div id="label">${lines.map((line) => `<div class="line">${escaped(line)}</div>`).join("")}</div>
  `);
  return await page.locator("#label").screenshot({ type: "png" });
}

async function recognize(page: Page, image: Buffer, name: string): Promise<void> {
  await page.getByLabel("Synthetic label image").setInputFiles({ name, mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Run OCR" }).click();
}

test("PA-S4-01 extracts all 16 clean synthetic labels exactly on device", async ({ browser }) => {
  const app = await browser.newPage();
  const generator = await browser.newPage();
  const externalRequests: string[] = [];
  app.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:4173") {
      externalRequests.push(request.url());
    }
  });
  await app.goto("/");
  await expect(app.getByText("Mobile OCR Scanner", { exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Blood Unit Capture" })).toBeVisible();
  await expect(app.getByText("ALIGN LABEL INSIDE FRAME", { exact: true })).toBeVisible();
  await expect(app.getByText("Images are never uploaded", { exact: true })).toBeVisible();
  for (const [index, label] of labels.entries()) {
    await recognize(app, await labelImage(generator, label), `clean-${index + 1}.png`);
    const review = app.getByRole("heading", { name: "2. Confirm extracted fields" });
    await expect(review).toBeVisible();
    const evidence = await app.locator("dl").innerText();
    for (const value of Object.values(label)) expect(evidence).toContain(value);
  }
  expect(externalRequests).toEqual([]);
  await app.close();
  await generator.close();
});

test("PA-S4-01 degraded and prohibited labels never expose an incorrect confirmable result", async ({ browser }) => {
  const app = await browser.newPage();
  const generator = await browser.newPage();
  const label = labels[0];
  const cases = [
    ["blur", "", "filter: blur(4px)"],
    ["rotation", "", "transform: rotate(16deg); transform-origin: center"],
    ["glare", "", "color: #aaa; background: linear-gradient(110deg,#fff 25%,#eee 45%,#fff 60%)"],
    ["crop", "", "height: 150px; overflow: hidden"],
    ["prohibited", "PATIENT: SYNTHETIC PERSON", ""],
  ] as const;
  await app.goto("/");
  for (const [name, extra, style] of cases) {
    await recognize(app, await labelImage(generator, label, extra, style), `${name}.png`);
    await expect(app.getByRole("button", { name: "Run OCR" })).toBeEnabled({ timeout: 60_000 });
    const review = app.getByRole("heading", { name: "2. Confirm extracted fields" });
    if (await review.isVisible()) {
      const evidence = await app.locator("dl").innerText();
      for (const value of Object.values(label)) expect(evidence).toContain(value);
    } else {
      await expect(app.getByRole("button", { name: "I confirm every field" })).toHaveCount(0);
    }
  }
  await app.close();
  await generator.close();
});

test("FR-13 retains only structured data offline and replays it after connectivity returns", async ({ page, context }) => {
  let intakeCalls = 0;
  let intakeAvailable = false;
  await page.route("**/api/v1/simulation/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ token: "synthetic-token" }),
  }));
  await page.route("**/api/v1/scan-events", (route) => {
    if (!intakeAvailable) return route.abort("internetdisconnected");
    intakeCalls += 1;
    return route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        eventId: "SCAN_0123456789ABCDEF0123456789ABCDEF",
        correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF",
        status: "QUEUED",
      }),
    });
  });
  await page.route("**/api/v1/scan-events/SCAN_*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      eventId: "SCAN_0123456789ABCDEF0123456789ABCDEF",
      correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF",
      status: "COMMITTED",
      safeErrorCode: null,
    }),
  }));
  await page.goto("/");
  await page.getByLabel("Development credential").fill("synthetic-test-credential");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Synthetic operator authenticated.")).toBeVisible();

  const generator = await context.newPage();
  const image = await labelImage(generator, labels[0]);
  await generator.close();
  await recognize(page, image, "offline.png");
  await expect(page.getByRole("heading", { name: "2. Confirm extracted fields" })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await expect(page.getByText("Offline capture is available", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "I confirm every field" }).click();
  await expect(page.getByText("Saved locally; synchronization will be retried.")).toBeVisible();
  expect(intakeCalls).toBe(0);

  const persisted = await page.evaluate(async () => {
    const request = indexedDB.open("bloodledger-synthetic-capture-v1", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const query = database.transaction("scan-events").objectStore("scan-events").getAll();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return values;
  });
  expect(JSON.stringify(persisted)).not.toMatch(/data:image|rawText|ocrText|imageData/);
  expect(JSON.stringify(persisted)).toContain(labels[0].unitId);

  await page.reload();
  await expect(page.getByText(labels[0].unitId)).toBeVisible();
  await expect(page.getByText("LOCAL_PENDING")).toBeVisible();

  intakeAvailable = true;
  await context.setOffline(false);
  await expect.poll(() => intakeCalls).toBe(1);
  await expect(page.getByText("COMMITTED")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByText(labels[0].unitId)).toBeVisible();
  expect(intakeCalls).toBe(1);
});
