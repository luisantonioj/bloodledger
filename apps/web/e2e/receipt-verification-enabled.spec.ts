import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {readPage} from "./fixtures/transaction-reads";

// ADR-049 receipt flow with the readiness flag on (isolated build). Synthetic labels and mocked API only.
const classification="SIMULATION_ONLY",reservationId="RES_INCOMING",evidenceId="RCV_"+"A".repeat(40),evidenceDigest="c".repeat(64),commandId="CMD_"+"B".repeat(40);
type Role={institutionId:string;category:"REQUESTOR"|"BLOOD_BANK";roleId:"ROLE-02"|"ROLE-03"};
const requester:Role={institutionId:"INST_REQUESTER",category:"REQUESTOR",roleId:"ROLE-03"},bank:Role={institutionId:"INST_MEDIATRIX",category:"BLOOD_BANK",roleId:"ROLE-02"};

async function ocrAssets(context:BrowserContext){
 const assets=fileURLToPath(new URL("../../capture-pwa/public/ocr-assets/",import.meta.url));
 await context.route("**/capture/ocr-assets/**",route=>{const name=new URL(route.request().url()).pathname.split("/ocr-assets/")[1];return !name||name.includes("..")?route.abort():route.fulfill({path:path.join(assets,name)});});
}
async function setup(page:Page,role:Role){
 const posts:{path:string;body:unknown;key?:string}[]=[],missing:string[]=[];
 // Record every POST; routes registered later (per test) fulfil the expected ones before this catch-all.
 page.on("request",request=>{if(request.method()==="POST")posts.push({path:new URL(request.url()).pathname,body:request.postDataJSON(),key:request.headers()["idempotency-key"]});});
 await page.route("**/api/**",async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname;let status=200,body:unknown;
  if(request.method()==="POST"){missing.push("POST "+p);return route.fulfill({status:500,json:{error:{code:"NO_LIVE_WRITES"}}});}
  if(p==="/api/v1/auth/session")body={principal:{accountId:"ACC_SYNTH_RECEIVER",accountCategory:role.category,verificationRequired:true,userId:"ACC_SYNTH_RECEIVER",displayName:"Synthetic receiver",institutionId:role.institutionId,institutionDisplayName:"Synthetic receiving hospital",roleId:role.roleId,roleDisplayName:"Receiver",permissions:["dashboard:operational","inventory:read","transfers:read","transfers:write","profile:read"],operators:[{operatorId:"OP_SYNTH_RECEIVER",roleId:role.roleId,capabilityProfile:"ROLE",actionCapabilities:role.roleId==="ROLE-03"?["transfer:request","transfer:receive","transfer:cancel","transfer:compromise"]:["inventory:capture","transfer:prepare","transfer:dispatch","transfer:transit","transfer:receive","transfer:cancel","transfer:compromise"]}],classification}};
  else if(p==="/api/v2/reservations")body={scope:role.roleId==="ROLE-03"?"DESTINATION_INSTITUTION":"SOURCE_INSTITUTION",classification,nextCursor:null,reservations:[{reservationId,status:"IN_TRANSIT",purpose:"TRANSFER",version:2,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:role.institutionId},{reservationId:"RES_RECEIVED",status:"RECEIVED",purpose:"TRANSFER",version:3,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:role.institutionId}]};
  else if(p==="/api/v2/reservations/"+reservationId)body={reservationId,purpose:"TRANSFER",status:"IN_TRANSIT",version:2,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:role.institutionId,transferId:"TRF_INCOMING",localReleaseId:null,preparedAt:"2026-10-17T00:00:00.000Z",preparedEvidencePresent:true,updatedAt:"2026-10-17T00:00:00.000Z",components:[{componentId:"COMP_INCOMING",componentType:"WHOLE_BLOOD",inventoryStatus:"IN_TRANSIT",inventoryVersion:3}],classification};
  else if(p==="/api/v2/transfers")body={requests:[],reservations:[],timeline:[],classification};
  else if(p==="/api/v2/unit-history")body=readPage("UNIT_HISTORY_READ_V1",[]);
  else{missing.push(p);status=503;body={error:{code:"UNSTUBBED_FIXTURE"}};}
  await route.fulfill({status,json:body});
 });
 await page.route("**/api/v2/auth/operator-verifications",route=>route.fulfill({json:{verificationId:"VFY_"+"A".repeat(40)}}));
 return {posts,missing};
}
async function scanIncomingUnit(page:Page,panel:ReturnType<Page["getByRole"]>,componentLine="COMPONENT: WHOLE_BLOOD"){
 const data=await page.evaluate(line=>{const canvas=document.createElement("canvas");canvas.width=1800;canvas.height=600;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1800,600);ctx.fillStyle="black";ctx.font="bold 48px monospace";["DONATION NO: MM26-01-0001","BLOOD TYPE: A_POSITIVE",line,"COLLECTED AT: 2026-09-17T00:00:00.000Z","EXPIRES AT: 2026-10-17T00:00:00.000Z"].forEach((text,i)=>ctx.fillText(text,70,90+i*90));return canvas.toDataURL("image/png");},componentLine);
 await panel.getByLabel("Incoming-unit label image").setInputFiles({name:"synthetic-incoming-label.png",mimeType:"image/png",buffer:Buffer.from(data.split(",")[1],"base64")});
 await panel.getByRole("button",{name:"Run OCR",exact:true}).click();
 await expect(panel.getByText("Five label fields passed OCR checks.",{exact:false})).toBeVisible({timeout:90000});
 await panel.getByLabel("I checked the recognized label against this incoming unit.").check();await panel.getByRole("button",{name:"Add scanned unit",exact:true}).click();
}
async function pin(page:Page){await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();}

test("requester scans every unit, verifies through a frozen retry, then receives with the evidence",async({page,context})=>{
 test.setTimeout(150000);await ocrAssets(context);const {posts,missing}=await setup(page,requester);let verifications=0;
 await page.route("**/api/v2/reservations/"+reservationId+"/receipt-verifications",async route=>{verifications++;if(verifications===1)return route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}});
  await route.fulfill({json:{policyVersion:"INBOUND_RECEIPT_LABEL_VERIFICATION_V1",classification,reservationId,reservationVersion:2,evidenceId,evidenceDigest,componentIds:["COMP_INCOMING"],matchedUnits:1,verifiedAt:"2026-10-17T00:00:00.123Z",replayed:true,ledger:{status:"NOT_APPLICABLE"}}});});
 let receiveCorrelation="";
 // The status poll must return the accepted command's identity, including its correlation ID.
 await page.route("**/api/v2/commands/"+commandId,route=>route.fulfill({json:{commandId,resourceType:"TRANSFER",resourceId:reservationId,status:"COMMITTED",statusUrl:"/api/v2/commands/"+commandId,acceptedAt:"2026-10-17T00:00:01.000Z",correlationId:receiveCorrelation,safeErrorCode:null,classification,replayed:false}}));
 await page.route("**/api/v2/reservations/"+reservationId+"/receive",async route=>{const body=route.request().postDataJSON();receiveCorrelation=body.correlationId;await route.fulfill({status:202,json:{commandId,resourceType:"TRANSFER",resourceId:reservationId,status:"QUEUED",statusUrl:"/api/v2/commands/"+commandId,acceptedAt:"2026-10-17T00:00:01.000Z",correlationId:body.correlationId,safeErrorCode:null,classification,replayed:false}});});
 await page.goto("/receipts");await page.getByRole("button",{name:"Open Mobile Receipt Scanner"}).click();const scanner=page.getByRole("dialog",{name:"Mobile Receipt Scanner",exact:true});
 // The old single-label confirmation is replaced by the verified receipt flow.
 await expect(scanner.getByRole("button",{name:"Confirm inbound receipt",exact:true})).toHaveCount(0);
 await expect(scanner.getByLabel("In-transit incoming transfer").locator("option")).toHaveText(["Select a transfer",reservationId]);
 await scanner.getByLabel("In-transit incoming transfer").selectOption(reservationId);const panel=scanner.getByRole("region",{name:"Receipt label verification"});
 await scanIncomingUnit(page,panel);await expect(panel).toContainText("1 of 1 incoming units scanned");
 await panel.getByRole("button",{name:"Verify scanned units",exact:true}).click();await pin(page);
 await expect(panel.getByRole("button",{name:"Retry same verification",exact:true})).toBeEnabled();await expect(scanner.getByRole("button",{name:"Close receipt scanner",exact:true})).toBeDisabled();
 await panel.getByRole("button",{name:"Retry same verification",exact:true}).click();await pin(page);
 await expect(panel).toContainText("All incoming units verified · Off-chain evidence returned");
 await panel.getByRole("button",{name:"Receive transfer",exact:true}).click();await pin(page);
 await expect(scanner.getByText("Committed",{exact:true})).toBeVisible();await expect(scanner.getByRole("region",{name:"Receipt label verification"})).toHaveCount(0);
 const verified=posts.filter(post=>post.path.endsWith("/receipt-verifications"));expect(verified).toHaveLength(2);expect(verified[1].body).toEqual(verified[0].body);expect(verified[1].key).toBe(verified[0].key);
 expect(verified[0].body).toMatchObject({expectedVersion:2,scannedLabels:[{donationNumber:"MM26-01-0001",componentType:"WHOLE_BLOOD"}]});
 const received=posts.filter(post=>post.path.endsWith("/receive"));expect(received).toHaveLength(1);expect(received[0].body).toMatchObject({expectedVersion:2,receiptEvidenceId:evidenceId,receiptEvidenceDigest:evidenceDigest});
 expect(posts.some(post=>post.path==="/api/v2/inbound-captures")).toBe(false);await expect(scanner.getByText("MM26-01-0001",{exact:true})).toHaveCount(0);expect(missing).toEqual([]);
});

test("a blood-bank destination sees a counts-only mismatch and never receives without evidence",async({page,context})=>{
 test.setTimeout(150000);await ocrAssets(context);
 const {posts,missing}=await setup(page,bank);
 await page.route("**/api/v2/reservations/"+reservationId+"/receipt-verifications",route=>route.fulfill({status:409,json:{error:{code:"RECEIPT_LABELS_MISMATCH",message:"Scanned labels do not match the in-transit units: 0 of 1 matched, 1 unmatched, 1 missing."}}}));
 await page.goto("/transactions");await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:"Inbound",exact:true}).click();
 const card=page.getByRole("region",{name:"Receipt label verification"});
 await page.getByLabel("In-transit incoming transfer").selectOption(reservationId);
 await scanIncomingUnit(page,card,"COMPONENT: FRESH_FROZEN_PLASMA");await card.getByRole("button",{name:"Verify scanned units",exact:true}).click();await pin(page);
 await expect(card.getByRole("alert")).toHaveText("0 of 1 matched; 1 unmatched; 1 missing. Review all scanned units.");
 await expect(card.getByRole("button",{name:"Receive transfer",exact:true})).toHaveCount(0);await expect(card.getByRole("button",{name:"Verify scanned units",exact:true})).toBeVisible();
 expect(posts.filter(post=>post.path.endsWith("/receive"))).toEqual([]);await expect(card.getByText("MM26-01-0001",{exact:true})).toHaveCount(0);expect(missing).toEqual([]);
});
