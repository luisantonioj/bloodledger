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
    const request = indexedDB.open("bloodledger-inbound-command-status-v2", 1);
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
  let correlationId = "";
  await page.route("**/api/v2/inbound-captures", async (route) => {
    submissions += 1;
    const request = route.request();
    expect(request.headers()["x-bloodledger-contract-version"]).toBe("V2.1");
    const body = request.postDataJSON() as Record<string, unknown>;
    correlationId = String(body.correlationId);
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
      correlationId,
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
    const request = indexedDB.open("bloodledger-inbound-command-status-v2", 1);
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

// Issue36 / NFR05: recovery is owned, terminal retention is observation-based.
test("recovery isolates owners, expires terminal details, and keeps a minimal tombstone", async ({page}) => {
  await restoreCaptureSession(page);
  let polls = 0;
  const acceptedAt = "2026-10-01T00:00:00Z";
  const base = {accountId:principal.userId,institutionId:principal.institutionId,operatorId:principal.userId,idempotencyKey:"IDEM_CAPTURE_SYNTH",commandId:"CMD_CAPTURE_OWN",resourceId:"INCAP_CAPTURE_OWN",statusUrl:"/api/v2/commands/CMD_CAPTURE_OWN",status:"QUEUED",correlationId:"CORR_CAPTURE_SYNTH",acceptedAt,safeErrorCode:null,bloodType:"O_NEGATIVE",componentType:"PLATELETS",issuerInstitutionId:principal.institutionId,classification:"SIMULATION_ONLY"};
  await page.route("**/api/v2/commands/**", async route => {
    expect(new URL(route.request().url()).pathname).toBe(base.statusUrl);polls++;
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({...base,resourceType:"INBOUND_CAPTURE",status:"COMMITTED",replayed:false})});
  });
  await page.goto("/capture/");
  await page.evaluate(async base => {
    const request=indexedDB.open("bloodledger-inbound-command-status-v2",1);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction("command-receipts","readwrite"), store=tx.objectStore("command-receipts");
    store.put(base);store.put({...base,commandId:"CMD_CAPTURE_FOREIGN",accountId:"USR_OTHER",resourceId:"INCAP_FOREIGN"});
    store.put({...base,commandId:"CMD_CAPTURE_EXPIRED",resourceId:"INCAP_EXPIRED",status:"COMMITTED",terminalObservedAt:new Date(Date.now()-25*60*60*1000).toISOString()});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },base);
  await page.reload();await expect(page.getByText("INCAP_CAPTURE_OWN",{exact:true})).toBeVisible();await expect(page.getByText("COMMITTED",{exact:true})).toBeVisible();await expect(page.getByText("INCAP_FOREIGN",{exact:true})).toHaveCount(0);await expect(page.getByText("INCAP_EXPIRED",{exact:true})).toHaveCount(0);expect(polls).toBe(1);
  const entries=await page.evaluate(async()=>{const r=indexedDB.open("bloodledger-inbound-command-status-v2",1);const db=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result);});const query=db.transaction("command-receipts").objectStore("command-receipts").getAll();const values=await new Promise<Record<string,unknown>[]>(resolve=>{query.onsuccess=()=>resolve(query.result);});db.close();return values;});
  expect(entries.find(row=>row.commandId==="CMD_CAPTURE_EXPIRED")).toEqual({commandId:"CMD_CAPTURE_EXPIRED",accountId:principal.userId,institutionId:principal.institutionId,expired:true});
  expect(Date.parse(String(entries.find(row=>row.commandId===base.commandId)?.terminalObservedAt))).toBeGreaterThan(Date.now()-30000);
});

test("logout clears capture and ignores a delayed recovery response", async ({page}) => {
  await restoreCaptureSession(page);
  let release: (()=>void)|undefined;
  await page.route("**/api/v2/commands/CMD_CAPTURE_LATE",async route=>{
    await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({status:401,contentType:"application/json",body:JSON.stringify({error:{code:"AUTH_REQUIRED",message:"Expired"}})});
  });
  await page.goto("/capture/");
  await page.evaluate(async principal=>{
    const r=indexedDB.open("bloodledger-inbound-command-status-v2",1);const db=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result);});const tx=db.transaction("command-receipts","readwrite");tx.objectStore("command-receipts").put({accountId:principal.userId,institutionId:principal.institutionId,commandId:"CMD_CAPTURE_LATE",resourceId:"INCAP_LATE",statusUrl:"/api/v2/commands/CMD_CAPTURE_LATE",status:"QUEUED",acceptedAt:"2026-10-10T00:00:00Z",correlationId:"CORR_LATE",classification:"SIMULATION_ONLY"});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();
  },principal);
  await page.reload();await expect.poll(()=>!!release).toBe(true);await page.getByRole("button",{name:/Sign out Synthetic Capture Operator/}).click();release?.();await expect(page.getByText("Signed out. Volatile OCR and verification values were cleared.",{exact:true})).toBeVisible();await expect(page.getByText("INCAP_LATE",{exact:true})).toHaveCount(0);await expect(page.getByRole("heading",{name:"2. Confirm extracted fields"})).toHaveCount(0);
});
