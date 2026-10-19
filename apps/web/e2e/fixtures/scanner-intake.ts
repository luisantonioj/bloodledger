import {expect,type Page,type BrowserContext} from "@playwright/test";
import {unitFixture,readPage} from "./transaction-reads";
import {fileURLToPath} from "node:url";
import path from "node:path";
export async function fixture(page:Page,context:BrowserContext,recovery:"found"|"empty"|"wrongIdentity"|"oldReplay"|"cancelRetry"|"disabled"="found"){
 const writes:{path:string;body:any;key?:string}[]=[],apiReads:string[]=[];
 const reservation={reservationId:"RES_SCANNER",purpose:"TRANSFER",status:"ACTIVE",version:1,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_REQUESTER",transferId:"TRF_SCANNER",localReleaseId:null,preparedAt:null,preparedEvidencePresent:true,updatedAt:"2026-10-16T00:00:00.000Z",components:[{componentId:"COMP_SCANNER",componentType:"WHOLE_BLOOD",inventoryStatus:"RESERVED",inventoryVersion:1}],classification:"SIMULATION_ONLY"};
 const incoming={...reservation,reservationId:"RES_INCOMING",sourceInstitutionId:"INST_SYNTH_MEDIX",destinationInstitutionId:"INST_MEDIATRIX",status:"IN_TRANSIT"};
 await page.route("**/api/**",route=>{const request=route.request(),url=new URL(request.url()),p=url.pathname;apiReads.push(p);
 if(request.method()==="POST"){writes.push({path:p,body:request.postDataJSON(),key:request.headers()["idempotency-key"]});if(p==="/api/v2/auth/operator-verifications")return route.fulfill({json:{verificationId:"VFY_"+"A".repeat(40)}});if(p==="/api/v2/inbound-captures"){
  if(recovery==="disabled")return route.fulfill({status:403,json:{error:{code:"CORRECTED_INTAKE_DISABLED"}}});
  const attempt=writes.filter(row=>row.path===p);if(attempt.length===1)return route.abort("failed");
  if(recovery==="oldReplay")return route.fulfill({json:{resolution:"ALREADY_REGISTERED",componentId:"COMP_SCANNER",captureId:"INCAP_SCANNER",status:"AVAILABLE",classification:"SIMULATION_ONLY"}});
  return route.fulfill({status:202,json:{commandId:"CMD_SCANNER",resourceType:"INBOUND_CAPTURE",resourceId:"INCAP_SCANNER",status:"QUEUED",statusUrl:"/api/v2/commands/CMD_SCANNER",acceptedAt:"2026-10-16T00:00:00.000Z",correlationId:request.postDataJSON().correlationId,safeErrorCode:null,replayed:true,classification:"SIMULATION_ONLY"}});
 }return route.fulfill({status:400,json:{error:{code:"UNEXPECTED_WRITE"}}});}
 if(p==="/api/v1/auth/session")return route.fulfill({json:{principal:{accountId:"ACC_SCANNER",accountCategory:"BLOOD_BANK",verificationRequired:true,userId:"USR_SCANNER",displayName:"Synthetic account",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic Mediatrix",roleId:"ROLE-02",roleDisplayName:"Coordinator",permissions:["inventory:read","transfers:read","profile:read"],operators:[{operatorId:"OP_SCANNER",roleId:"ROLE-02",capabilityProfile:"ROLE",actionCapabilities:["inventory:capture","transfer:prepare","transfer:dispatch"]},{operatorId:"OP_OTHER",roleId:"ROLE-02",capabilityProfile:"ROLE",actionCapabilities:["inventory:capture"]}],classification:"SIMULATION_ONLY"}}});
 if(p==="/api/v2/unit-history")return route.fulfill({json:readPage("UNIT_HISTORY_READ_V1",[unitFixture])});
 if(p.startsWith("/api/v2/reservations"))expect(request.headers()["x-bloodledger-contract-version"]).toBe("V2.1");
 if(p==="/api/v2/reservations")return route.fulfill({json:{scope:"SOURCE_INSTITUTION",reservations:[incoming,reservation],nextCursor:null,classification:"SIMULATION_ONLY"}});
 if(p==="/api/v2/reservations/RES_SCANNER")return route.fulfill({json:reservation});
 if(p==="/api/v2/commands"){
  const saved=writes.find(row=>row.path==="/api/v2/inbound-captures")!;expect(request.method()).toBe("GET");expect(url.searchParams.get("idempotencyKey")).toBe(saved.key);
  return route.fulfill({json:{scope:"ACTOR_INSTITUTION",commands:recovery==="empty"?[]:[{commandId:"CMD_SCANNER",resourceType:"INBOUND_CAPTURE",resourceId:"INCAP_SCANNER",status:"COMMITTED",statusUrl:"/api/v2/commands/CMD_SCANNER",acceptedAt:"2026-10-16T00:00:00.000Z",correlationId:recovery==="wrongIdentity"?"CORR_WRONG":saved.body.correlationId,safeErrorCode:null,replayed:false,classification:"SIMULATION_ONLY"}],nextCursor:null,classification:"SIMULATION_ONLY"}});
 }
 if(p==="/api/v2/commands/CMD_SCANNER"){const saved=writes.find(row=>row.path==="/api/v2/inbound-captures")!;return route.fulfill({json:{commandId:"CMD_SCANNER",resourceType:"INBOUND_CAPTURE",resourceId:"INCAP_SCANNER",status:"COMMITTED",statusUrl:p,acceptedAt:"2026-10-16T00:00:00.000Z",correlationId:saved.body.correlationId,safeErrorCode:null,replayed:false,classification:"SIMULATION_ONLY"}});}
 return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 const root=fileURLToPath(new URL("../../../capture-pwa/public/ocr-assets/",import.meta.url));await context.route("**/capture/ocr-assets/**",route=>{const name=new URL(route.request().url()).pathname.split("/ocr-assets/")[1];return !name||name.includes("..")?route.abort():route.fulfill({path:path.join(root,name)});});
 return {writes,apiReads};
}
export const V1_LABEL=["DONATION NO: MM26-01-0001","BLOOD TYPE: A_POSITIVE","COMPONENT: WHOLE_BLOOD","COLLECTED AT: 2026-09-17T00:00:00.000Z","EXPIRES AT: 2026-10-17T00:00:00.000Z"];
export async function scan(page:Page,direction:"Inbound"|"Outbound",label=V1_LABEL,font="bold 48px monospace"){
 await page.goto("/transactions");await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:direction,exact:true}).click();const dialog=page.getByRole("dialog",{name:"Mobile blood unit scanner",exact:true});
 const data=await page.evaluate(([label,font])=>{const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=600;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1600,600);ctx.fillStyle="black";ctx.font=font;label.forEach((line,index)=>ctx.fillText(line,70,90+index*90));return canvas.toDataURL("image/png");},[label,font] as const);
 await dialog.getByLabel(direction==="Outbound"?"Outbound blood-unit label image":"Blood-unit label image",{exact:true}).setInputFiles({name:"synthetic-label.png",mimeType:"image/png",buffer:Buffer.from(data.split(",")[1],"base64")});await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toHaveValue("MM26-01-0001",{timeout:90000});return dialog;
}
