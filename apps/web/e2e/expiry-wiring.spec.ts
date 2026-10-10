import { expect, test, type Page, type Route } from "@playwright/test";

// J4 / FR-08–09/12, TP-JOP-D01/D02. HTTP fixtures verify browser behavior;
// they do not claim retained-host Fabric, T0, or human UAT evidence.
const now = "2026-10-09T12:00:00.000Z";
const baseComponent = {
  componentId: "COMP_J4_SYNTH", donationId: "DON_J4_SYNTH", issuerInstitutionId: "INST_MEDIATRIX",
  componentType: "CRYOPRECIPITATE", bloodType: "O_NEGATIVE", collectedAt: "2026-10-01T00:00:00Z",
  expiresAt: "2026-10-08T00:00:00Z", institutionId: "INST_MEDIATRIX", inventoryStatus: "AVAILABLE",
  expiryState: "LABEL_EXPIRED_PENDING_EVALUATION", reservationId: null, reservationVersion: null,
  inventoryVersion: 3, policyVersion: "INTERVIEW_DERIVED_CORE_V2", classification: "SIMULATION_ONLY",
};
const principal = {
  accountId: "ACC_J4_SYNTH", accountCategory: "BLOOD_BANK", verificationRequired: true,
  userId: "USR_J4_SYNTH", displayName: "Synthetic J4 account", institutionId: "INST_MEDIATRIX",
  institutionDisplayName: "Synthetic Mediatrix", roleId: "ROLE-02", roleDisplayName: "Synthetic coordinator",
  permissions: ["dashboard:operational", "inventory:read", "transfers:read", "alerts:read", "profile:read"],
  operators: [{operatorId:"OP_J4_SYNTH", roleId:"ROLE-02", capabilityProfile:"ROLE", version:1,
    actionCapabilities:["inventory:expiry", "inventory:local-release", "alert:acknowledge"]}],
  classification: "SIMULATION_ONLY",
};
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}
function command(body: Record<string, unknown>, status = "QUEUED", resourceType = "COMPONENT", safeErrorCode: string | null = null) {
  return { commandId:"CMD_J4_SYNTH", resourceType, resourceId: resourceType === "COMPONENT" ? baseComponent.componentId : body.releaseId ?? body.transferId,
    status, statusUrl:"/api/v2/commands/CMD_J4_SYNTH", acceptedAt:now, correlationId:body.correlationId,
    safeErrorCode, classification:"SIMULATION_ONLY", replayed:false };
}
async function setup(page: Page, override?: (route: Route, path: string) => Promise<boolean>, options: { component?: object; capabilities?: string[]; roleId?: string } = {}) {
  let active = true;
  const user = { ...principal, roleId: options.roleId ?? principal.roleId,
    operators: [{ ...principal.operators[0], roleId: options.roleId ?? "ROLE-02", actionCapabilities: options.capabilities ?? principal.operators[0].actionCapabilities }] };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (override && await override(route, path)) return;
    if (path === "/api/v1/auth/session") {
      if (route.request().method() === "DELETE") {active = false; return route.fulfill({status:204});}
      return active ? json(route, {principal:user}) : json(route, {error:{code:"AUTH_REQUIRED",message:"Sign in"}}, 401);
    }
    if (path === "/api/v2/auth/operator-verifications") return json(route, {verificationId:"VFY_J4_SYNTH"});
    if (path === "/api/v2/components") return json(route, {scope:"INSTITUTION",components:[{...baseComponent,...options.component}],classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/components/COMP_J4_SYNTH") return json(route, {...baseComponent,...options.component});
    if (path === "/api/v2/reports/inbound-intake") return json(route, {scope:"INSTITUTION",statuses:{},includedInventoryStatuses:["COMMITTED"],excludedFromInventory:["QUEUED","FAILED","CONFLICT"],classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/transfers") return json(route, {requests:[],reservations:[],timeline:[],classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/dashboard") return json(route, {composition:"OPERATIONAL",scope:"INSTITUTION",inventory:[],pendingScans:[],lastSuccessfulProjectionAt:null,classification:"SIMULATION_ONLY"});
    if (path === "/api/v2/alerts") return json(route, {scope:"INSTITUTION",alerts:[],aggregates:[],classification:"SIMULATION_ONLY"});
    return json(route, {error:{code:"TEST_ROUTE_MISSING",message:"Synthetic route missing"}},404);
  });
}
async function verify(page: Page) {
  const dialog = page.getByRole("dialog", {name:"Verify operator"});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Operator PIN").fill("00000000"); // fixture PIN only
  await dialog.getByRole("button", {name:"Verify and submit",exact:true}).click();
}
async function openComponent(page: Page) {
  await page.goto("/inventory");
  await page.getByRole("button", {name:"Open component COMP_J4_SYNTH",exact:true}).click();
  await expect(page.getByRole("dialog", {name:"Component details"})).toBeVisible();
}

test("expiry is operator-bound, queued truthfully, refreshed on commitment and acknowledged in alerts", async ({page}) => {
  let body: Record<string, unknown> = {}, submissions = 0, polls = 0, committed = false, acknowledged = false;
  let verificationBody: Record<string, unknown> = {};
  await setup(page, async (route,path) => {
    if (path === "/api/v2/auth/operator-verifications") {
      verificationBody = route.request().postDataJSON();
      await json(route, {verificationId:"VFY_J4_SYNTH"}); return true;
    }
    if (path.endsWith("/COMP_J4_SYNTH/expiry")) {
      submissions++; body = route.request().postDataJSON();
      expect(body).toEqual({correlationId:expect.stringMatching(/^CORR_[0-9A-F]{32}$/),expectedVersion:3});
      expect(route.request().headers()["operator-verification"]).toBe("VFY_J4_SYNTH");
      expect(route.request().headers()["x-bloodledger-contract-version"]).toBe("V2.1");
      expect(verificationBody).toMatchObject({action:"POST /api/v2/components/COMP_J4_SYNTH/expiry",payload:body,idempotencyKey:route.request().headers()["idempotency-key"]});
      await json(route, command(body), 202); return true;
    }
    if (path === "/api/v2/commands/CMD_J4_SYNTH") {
      polls++; committed = polls >= 2;
      await json(route, command(body,committed ? "COMMITTED" : "LEDGER_COMMITTED_PROJECTION_PENDING")); return true;
    }
    if (committed && ["/api/v2/components","/api/v2/components/COMP_J4_SYNTH"].includes(path)) {
      const component = {...baseComponent,inventoryStatus:"EXPIRED",expiryState:"EXPIRED",inventoryVersion:4};
      await json(route,path.endsWith("/COMP_J4_SYNTH") ? component : {scope:"INSTITUTION",components:[component],classification:"SIMULATION_ONLY"}); return true;
    }
    if (path === "/api/v2/alerts") {
      await json(route, {scope:"INSTITUTION",classification:"SIMULATION_ONLY",aggregates:[],alerts:committed ? [{alertId:"V2EXP_J4_SYNTH",unitId:baseComponent.componentId,bloodType:baseComponent.bloodType,component:baseComponent.componentType,alertType:"EXPIRED",severity:"CRITICAL",status:"OPEN",expiresAt:baseComponent.expiresAt,evaluatedAt:now,acknowledged}] : []}); return true;
    }
    if (path === "/api/v2/alerts/V2EXP_J4_SYNTH/acknowledge") {
      acknowledged = true; await json(route,{alertId:"V2EXP_J4_SYNTH",acknowledgedAt:now,replayed:false,classification:"SIMULATION_ONLY"}); return true;
    }
    return false;
  });
  await openComponent(page);
  const dialog = page.getByRole("dialog",{name:"Component details"});
  await expect(dialog.getByText("Label expired — evaluation pending; not usable",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Evaluate expiry",exact:true}).click(); await verify(page);
  await expect(dialog.getByRole("heading",{name:"Accepted and queued",exact:true})).toBeVisible();
  await expect(dialog.getByRole("heading",{name:"Committed",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Evaluate expiry",exact:true})).toBeDisabled();
  await expect(dialog.getByRole("heading",{name:"Committed",exact:true})).toBeVisible();
  await expect(dialog.getByText("The expiry evaluation committed.",{exact:false})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Evaluate expiry",exact:true})).toHaveCount(0);
  expect(submissions).toBe(1); expect(polls).toBe(2);
  await dialog.getByRole("button",{name:"Close record details"}).click();
  await expect(page.locator("tbody tr").getByText("Expired",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Alerts",exact:true}).click();
  await page.getByRole("button",{name:"Acknowledge",exact:true}).click(); await verify(page);
  await expect(page.getByText("Acknowledged",{exact:true})).toBeVisible();
});

for (const [expiryState,inventoryStatus,label] of [
  ["CURRENT","AVAILABLE","Label current"],
  ["EXPIRED","EXPIRED","Expired"],
  ["LABEL_EXPIRED_NOT_IN_INVENTORY","IN_TRANSIT","Label expired — outside available/reserved inventory"],
  ["LABEL_EXPIRED_PENDING_EVALUATION","RESERVED","Label expired — evaluation pending; not usable"],
] as const) {
  test(`expiry visibility: ${expiryState}/${inventoryStatus}`, async ({page}) => {
    await setup(page,undefined,{component:{expiryState,inventoryStatus,reservationId:inventoryStatus === "RESERVED" ? "RES_J4_SYNTH" : null}});
    await openComponent(page);
    const dialog = page.getByRole("dialog",{name:"Component details"});
    await expect(dialog.getByText(label,{exact:true})).toBeVisible();
    await expect(dialog.getByRole("button",{name:"Evaluate expiry",exact:true})).toHaveCount(0);
    if (inventoryStatus === "RESERVED") {
      await expect(dialog.getByText("Cancel the active reservation",{exact:false})).toBeVisible();
      await expect(dialog.getByRole("button",{name:"Open linked reservation"})).toBeVisible();
    }
  });
}
test("expiry is hidden from an operator without inventory:expiry", async ({page}) => {
  await setup(page,undefined,{capabilities:[],roleId:"ROLE-06"}); await openComponent(page);
  await expect(page.getByRole("button",{name:"Evaluate expiry",exact:true})).toHaveCount(0);
});

for (const [code,message] of [
  ["COMPONENT_LABEL_NOT_EXPIRED","The label has not expired"],
  ["COMPONENT_EXPIRY_RESERVATION_ACTIVE","Cancel the active reservation"],
  ["COMPONENT_ALREADY_EXPIRED","already expired"],
  ["COMPONENT_EXPIRY_TRANSITION_INVALID","Expiry cannot be evaluated"],
  ["COMPONENT_VERSION_CONFLICT","The component changed"],
  ["V2_1_CONTRACT_REQUIRED","requires the V2.1 contract"],
  ["V2_IDEMPOTENCY_CONFLICT","conflicts with an earlier command"],
] as const) {
  test(`expiry conflict ${code} requires a current read`,async ({page}) => {
    let submits = 0;
    await setup(page,async (route,path) => {
      if (!path.endsWith("/COMP_J4_SYNTH/expiry")) return false;
      submits++; await json(route,{error:{code,message:"Conflict"}},409);return true;
    });
    await openComponent(page);await page.getByRole("button",{name:"Evaluate expiry",exact:true}).click();await verify(page);
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("button",{name:"Evaluate expiry",exact:true})).toBeDisabled();
    expect(submits).toBe(1);
    await page.getByRole("button",{name:"Refresh component",exact:true}).click();
    await expect(page.getByRole("button",{name:"Evaluate expiry",exact:true})).toBeEnabled();
  });
}

for (const workflow of ["release","transfer"] as const) {
  test(`${workflow}: stale-time rejection uses fresh intent, ambiguous failure reuses it`,async ({page}) => {
    const calls: {body:Record<string,unknown>;key:string}[] = [];
    const pathToSubmit = workflow === "release" ? "/api/v2/local-releases" : "/api/v2/transfers";
    await setup(page,async (route,path) => {
      if (path !== pathToSubmit || route.request().method() !== "POST") return false;
      calls.push({body:route.request().postDataJSON(),key:route.request().headers()["idempotency-key"]});
      const code = calls.length <= 2 ? "V2_COMMAND_TIME_OUT_OF_WINDOW" : "SERVICE_UNAVAILABLE";
      await json(route,{error:{code,message:"Service unavailable; retry same request"}},calls.length <= 2 ? 400 : 503); return true;
    },{capabilities:[workflow === "release" ? "inventory:local-release" : "transfer:request"]});
    await page.goto("/transfers");
    if(workflow==="transfer")await page.getByRole("button",{name:"+ New Blood Request",exact:true}).click();
    const submit = page.getByRole("button",{name:workflow === "release" ? "Queue local release" : "Submit V2 request",exact:true});
    await submit.click();await verify(page);
    await expect(page.getByRole("alert")).toContainText("fresh time");
    await submit.click();await verify(page);
    await expect(page.getByRole("alert")).toContainText("device clock");
    await submit.click();await verify(page);
    await expect(page.getByRole("alert")).toContainText("Service unavailable");
    await page.getByRole("button",{name:workflow === "release" ? "Retry same release" : "Retry same request",exact:true}).click();await verify(page);
    await expect.poll(()=>calls.length).toBe(4);
    expect(calls[1].key).not.toBe(calls[0].key); expect(calls[1].body.eventTime).not.toBe(calls[0].body.eventTime);
    expect(calls[2].key).not.toBe(calls[1].key); expect(calls[3]).toEqual(calls[2]);
    if (workflow === "transfer") expect(calls[1].body.requestTime).toBe(calls[1].body.eventTime);
  });
}

for (const [status,code,message] of [[400,"REQUEST_INVALID","request body is invalid"],[413,"REQUEST_BODY_TOO_LARGE","request is too large"],[415,"REQUEST_MEDIA_TYPE_UNSUPPORTED","format is unsupported"]] as const) {
  test(`${code} is a client correction, not a retry`,async ({page}) => {
    let calls = 0;
    await setup(page,async(route,path)=>{
      if(path!=="/api/v2/local-releases")return false;
      calls++;await json(route,{error:{code,message:"Rejected"}},status);return true;
    });
    await page.goto("/transfers");await page.getByRole("button",{name:"Queue local release",exact:true}).click();await verify(page);
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("button",{name:"Correct release before submitting",exact:true})).toBeDisabled();
    await page.waitForTimeout(100);expect(calls).toBe(1);
    await page.getByLabel("Quantity",{exact:true}).fill("2");
    await expect(page.getByRole("button",{name:"Queue local release",exact:true})).toBeEnabled();
  });
}

test("a genuine protected 401 during expiry clears the dialog and account data",async ({page})=>{
  await setup(page,async(route,path)=>{
    if(!path.endsWith("/COMP_J4_SYNTH/expiry"))return false;
    await json(route,{error:{code:"AUTH_SESSION_REVOKED",message:"Session ended"}},401);return true;
  });
  await openComponent(page);await page.getByRole("button",{name:"Evaluate expiry",exact:true}).click();await verify(page);
  await expect(page.getByRole("dialog",{name:"Component details"})).toHaveCount(0);
  await expect(page.getByText(baseComponent.componentId,{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Sign in",exact:true})).toBeVisible();
});
