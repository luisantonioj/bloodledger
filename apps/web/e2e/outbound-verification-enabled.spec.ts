import {test,expect} from "@playwright/test";
import {setupBankCompletion} from "./fixtures/blood-bank-completion";
import {fileURLToPath} from "node:url";
import path from "node:path";
test.use({launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]}});
test("synthetic outbound OCR binds PIN and frozen retry, then prefills server evidence without preparing",async({page,context})=>{
 test.setTimeout(120000);await setupBankCompletion(page);const bodies:unknown[]=[],keys:string[]=[];let verifiedOperator:string|undefined,verifications=0;
 await page.route("**/api/v2/auth/operator-verifications",async route=>{const body=route.request().postDataJSON();expect(body.action).toBe("POST /api/v2/reservations/RES_TEST/outbound-verifications");expect(body.operatorId).toBe("OP_TEST");expect(body.payload.policyVersion).toBe("OUTBOUND_LABEL_VERIFICATION_V2");expect(body.payload.scannedLabels).toEqual([{donationNumber:"MM26-01-0001",componentType:"WHOLE_BLOOD"}]);verifiedOperator=body.operatorId;verifications++;await route.fulfill({json:{verificationId:"VFY_"+"A".repeat(40)}});});
 await page.route("**/api/v2/reservations/RES_TEST/outbound-verifications",async route=>{
  expect(verifiedOperator).toBe("OP_TEST");expect(route.request().headers()["operator-verification"]).toBeTruthy();bodies.push(route.request().postDataJSON());keys.push(route.request().headers()["idempotency-key"]);
  if(bodies.length===1)return route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}});
  expect(bodies[1]).toEqual(bodies[0]);expect(keys[1]).toBe(keys[0]);await route.fulfill({json:{policyVersion:"OUTBOUND_LABEL_VERIFICATION_V2",classification:"SIMULATION_ONLY",reservationId:"RES_TEST",reservationVersion:1,evidenceId:"EVD_"+"A".repeat(40),evidenceDigest:"b".repeat(64),componentIds:["COMP_READY"],matchedUnits:1,verifiedAt:"2026-10-15T00:00:00.123Z",replayed:true,ledger:{status:"NOT_APPLICABLE"}}});
 });
 const assetRoot=fileURLToPath(new URL("../../capture-pwa/public/ocr-assets/",import.meta.url));await context.route("**/capture/ocr-assets/**",async route=>{const name=new URL(route.request().url()).pathname.split("/ocr-assets/")[1];if(!name||name.includes(".."))return route.abort();await route.fulfill({path:path.join(assetRoot,name)});});
 await page.goto("/transfers?record=reservation&recordId=RES_TEST");await page.getByRole("button",{name:"Prepare reservation",exact:true}).click();const panel=page.getByRole("region",{name:"Outbound label verification"});
 const take=await panel.getByRole("button",{name:"Take photo",exact:true}).boundingBox(),choose=await panel.getByRole("button",{name:"Choose image",exact:true}).boundingBox();expect(take).not.toBeNull();expect(choose).not.toBeNull();expect(take!.y).toBe(choose!.y);
 const dataUrl=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=600;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1600,600);ctx.fillStyle="black";ctx.font="bold 48px monospace";["DONATION NO: MM26-01-0001","BLOOD TYPE: A_POSITIVE","COMPONENT: WHOLE_BLOOD","COLLECTED AT: 2026-09-17T00:00:00.000Z","EXPIRES AT: 2026-10-17T00:00:00.000Z"].forEach((line,index)=>ctx.fillText(line,70,90+index*90));return canvas.toDataURL("image/png");});
 await panel.getByLabel("Reserved-unit label image").setInputFiles({name:"synthetic-reserved-label.png",mimeType:"image/png",buffer:Buffer.from(dataUrl.split(",")[1],"base64")});await expect(panel.getByRole("button",{name:"Run OCR",exact:true})).toHaveCount(0);await expect(panel.getByText("Five label fields passed OCR checks.",{exact:false})).toBeVisible({timeout:90000});await panel.getByLabel("I checked the recognized label against this reserved unit.").check();await panel.getByRole("button",{name:"Add scanned unit",exact:true}).click();await expect(panel).toContainText("1 of 1 reserved units scanned");
 await panel.getByRole("button",{name:"Verify scanned units",exact:true}).click();await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();await expect(panel.getByRole("button",{name:"Retry same verification",exact:true})).toBeEnabled();await expect(page.getByRole("button",{name:"Confirm reservation action",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Close record details",exact:true})).toBeDisabled();await expect(page.getByRole("tab",{name:"Transfers",exact:true})).toBeDisabled();
 await panel.getByRole("button",{name:"Retry same verification",exact:true}).click();await expect(page.getByLabel("Operator",{exact:true})).toBeDisabled();await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();await expect(panel).toContainText("All reserved units verified · Off-chain evidence returned");await expect(page.getByLabel("Preparation evidence ID",{exact:true})).toHaveValue("EVD_"+"A".repeat(40));await expect(page.getByLabel("Preparation evidence SHA-256",{exact:true})).toHaveValue("b".repeat(64));await expect(page.getByLabel("Prepared at (ISO 8601 with timezone)",{exact:true})).toHaveValue("2026-10-15T00:00:00.123Z");await expect(page.getByText("MM26-01-0001",{exact:true})).toHaveCount(0);expect(bodies).toHaveLength(2);expect(verifications).toBe(2);
});

test("outbound guard rejects a sibling component with the same Donation No. before sending evidence",async({page,context})=>{
 test.setTimeout(120000);const state=await setupBankCompletion(page);const assets=fileURLToPath(new URL("../../capture-pwa/public/ocr-assets/",import.meta.url));
 await context.route("**/capture/ocr-assets/**",route=>{const name=new URL(route.request().url()).pathname.split("/ocr-assets/")[1];return !name||name.includes("..")?route.abort():route.fulfill({path:path.join(assets,name)});});
 await page.goto("/transfers?record=reservation&recordId=RES_TEST");await page.getByRole("button",{name:"Prepare reservation",exact:true}).click();const panel=page.getByRole("region",{name:"Outbound label verification"});
 const data=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1800;canvas.height=600;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1800,600);ctx.fillStyle="black";ctx.font="bold 48px monospace";["DONATION NO: MM26-01-0001","BLOOD TYPE: A_POSITIVE","COMPONENT: FRESH_FROZEN_PLASMA","COLLECTED AT: 2026-09-17T00:00:00.000Z","EXPIRES AT: 2026-10-17T00:00:00.000Z"].forEach((line,i)=>ctx.fillText(line,70,90+i*90));return canvas.toDataURL("image/png");});
 await panel.getByLabel("Reserved-unit label image").setInputFiles({name:"synthetic-sibling-label.png",mimeType:"image/png",buffer:Buffer.from(data.split(",")[1],"base64")});await expect(panel.getByRole("button",{name:"Run OCR",exact:true})).toHaveCount(0);
 await expect(panel.getByRole("alert")).toContainText("OCR-read component does not match",{timeout:90000});await expect(panel.getByRole("button",{name:"Add scanned unit",exact:true})).toHaveCount(0);await expect(panel.getByRole("button",{name:"Verify scanned units",exact:true})).toBeDisabled();await expect(panel).toContainText("0 of 1 reserved units scanned");await expect(panel.getByText("MM26-01-0001",{exact:true})).toHaveCount(0);expect(state.posts).toEqual([]);
});

// FR-01 / FR-06: reuse the inbound camera lifecycle; no verification or custody write from opening it.
test("outbound preparation opens the device camera and releases it on cancel and panel close",async({page})=>{
 await setupBankCompletion(page);
 await page.addInitScript(()=>{
  const tracks:MediaStreamTrack[]=[],get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);(window as any).outboundCameraTracks=tracks;
  navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);tracks.push(...stream.getTracks());return stream;};
 });
 await page.goto("/transfers?record=reservation&recordId=RES_TEST");await page.getByRole("button",{name:"Prepare reservation",exact:true}).click();const panel=page.getByRole("region",{name:"Outbound label verification"});
 const stopped=()=>page.evaluate(()=>(window as any).outboundCameraTracks.length>0&&(window as any).outboundCameraTracks.every((track:MediaStreamTrack)=>track.readyState==="ended"));
 await panel.getByRole("button",{name:"Take photo",exact:true}).click();await expect(panel.getByRole("button",{name:"Capture photo",exact:true})).toBeEnabled();
 await panel.getByRole("button",{name:"Cancel camera",exact:true}).click();await expect.poll(stopped).toBe(true);
 await panel.getByRole("button",{name:"Take photo",exact:true}).click();await expect(panel.getByRole("button",{name:"Capture photo",exact:true})).toBeEnabled();
 await page.getByRole("button",{name:"Close record details",exact:true}).click();await expect.poll(stopped).toBe(true);
});
