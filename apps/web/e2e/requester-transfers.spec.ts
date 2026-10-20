import { checkRequestFillUp } from "./fixtures/request-fill-up";
// Synthetic browser fixtures: requester scope, independent reservation state, and refresh safety.
import {expect, test, type Page} from "@playwright/test";
const instant="2026-10-09T04:00:00.000Z";
const own={transfer_id:"TRF_REQUESTER_01",source_institution_id:"INST_MEDIATRIX",destination_institution_id:"INST_REQUESTER",blood_type:"O_POSITIVE",component_type:"PACKED_RED_BLOOD_CELLS",quantity:3,urgency:"URGENT",request_time:instant,status:"REQUESTED",ledger_transaction_id:null};
const reservation={reservation_id:"RES_REQUESTER_01",transfer_id:own.transfer_id,purpose:"TRANSFER",status:"IN_TRANSIT",version:2,institution_id:"INST_MEDIATRIX",destination_institution_id:"INST_REQUESTER"};
async function setup(page:Page, mode:()=>number=()=>200, primary=false, pinLength:6|8=8){await page.route("**/api/**",async route=>{
 const path=new URL(route.request().url()).pathname;
 let status=200,body:unknown;
 if(path==="/api/v1/auth/session")body={principal:{userId:"USR_REQUESTER",displayName:"Synthetic Requester",institutionId:"INST_REQUESTER",institutionDisplayName:"Synthetic Requester Hospital",roleId:"ROLE-03",roleDisplayName:"Requester",...(primary?{accountId:"ACC_REQUESTER",accountCategory:"REQUESTOR",verificationRequired:true,operatorPinLength:pinLength,operators:[{operatorId:"OP_REQUESTER",roleId:"ROLE-03",capabilityProfile:"ROLE",version:1,actionCapabilities:["transfer:request"]}]}:{}),permissions:["dashboard:operational","transfers:read","transfers:write","profile:read"],classification:"SIMULATION_ONLY"}};
 else if(path==="/api/v2/transfers"){status=mode();body=status===200?{requests:[own,{...own,transfer_id:"TRF_FOREIGN",destination_institution_id:"INST_FOREIGN"}],reservations:[reservation,{...reservation,reservation_id:"RES_LOCAL_RELEASE",purpose:"LOCAL_RELEASE"}],timeline:[],classification:"SIMULATION_ONLY"}:{error:{message:"Synthetic read failure"}};}
 else if(path==="/api/v2/eligible-suppliers")body={suppliers:[{institutionId:"INST_SYNTH_NLVILLA",displayName:"N.L. Villa",availabilityBand:"10_OR_MORE",meetsRequestedQuantity:true},{institutionId:"INST_MEDIATRIX",displayName:"Mediatrix",availabilityBand:"1_TO_4",meetsRequestedQuantity:false}],readAt:instant,classification:"SIMULATION_ONLY"};
 else if(path==="/api/v2/transfers/TRF_REQUESTER_01/details")body={transferId:own.transfer_id,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_REQUESTER",requestingPerson:"Synthetic Requester A",staffId:"SYN-STAFF-0001",attendingPhysician:null,requiredAt:"2026-10-21T02:00:00.000Z",pickupRepresentative:"Synthetic Courier C",pickupAuthorizationReference:"SYN-AUTH-ABC123",notes:"Synthetic note.",version:1,updatedAt:instant,documents:[{documentId:"DOC_"+"A".repeat(40),kind:"REQUEST_FORM",displayName:"request-form.pdf",contentType:"application/pdf",sizeBytes:2048,uploadedAt:instant}],editable:true,viewerRole:"REQUESTER",pickupAuthorityVerified:false,unavailableFields:[{field:"patientCaseReference",dependency:"RQ-20"}]};
 else if(path==="/api/v2/reservations/RES_REQUESTER_01")body={reservationId:reservation.reservation_id,purpose:"TRANSFER",status:"IN_TRANSIT",version:2,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_REQUESTER",transferId:own.transfer_id,localReleaseId:null,preparedAt:instant,preparedEvidencePresent:true,updatedAt:instant,components:[],classification:"SIMULATION_ONLY"};
 else {status=404;body={error:{message:"Synthetic endpoint unavailable"}};}
 await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
 });}

test("requester list keeps own request and reservation status independent and opens inline verified details",async({page})=>{
 await setup(page);await page.goto("/transfers");
 const grid=page.locator(".requester-records-grid");await expect(grid.getByText("TRF_REQUESTER_01",{exact:true})).toBeVisible();await expect(page.getByText("TRF_FOREIGN",{exact:true})).toHaveCount(0);
 await expect(grid.getByText("Requested",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true}).click();await expect(page.getByRole("heading",{name:"Transfer request details",exact:true})).toBeVisible();await expect(page.locator(".requester-record-detail").getByText("O POSITIVE / PACKED RED BLOOD CELLS",{exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);
 const detail=page.locator(".request-detail-panel");await expect(detail.getByText("Synthetic Requester A",{exact:true})).toBeVisible();await expect(detail.getByText("Not collected (RQ-20)",{exact:true})).toBeVisible();await expect(detail.getByRole("link",{name:"request-form.pdf"})).toHaveAttribute("href","/api/v2/transfers/TRF_REQUESTER_01/documents/DOC_"+"A".repeat(40));await expect(detail.getByRole("button",{name:"Edit details",exact:true})).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("heading",{name:"Request Details",exact:true})).toBeVisible();
 await page.getByRole("tab",{name:/Blood Requests/}).focus();await page.keyboard.press("ArrowRight");await expect(page.getByRole("tab",{name:/Transfers/})).toBeFocused();await expect(grid.getByText("In transit",{exact:true})).toBeVisible();await expect(page.getByText("RES_LOCAL_RELEASE",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Open reservation RES_REQUESTER_01",exact:true})).toHaveText("RES_REQUESTER_01");await expect(grid.getByText("Request ID: TRF_REQUESTER_01",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Open reservation RES_REQUESTER_01",exact:true}).click();await expect(page.getByRole("heading",{name:"Reservation details",exact:true})).toBeVisible();await expect(page.locator(".requester-record-detail").getByText("IN TRANSIT",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:/Record receipt|Record dispatch|Approve/})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("requester refresh retains confirmed records for service failure and clears them for access denial",async({page})=>{
 let mode=200;await setup(page,()=>mode);await page.goto("/transfers");await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toBeVisible();
 mode=503;await page.getByRole("button",{name:"Refresh",exact:true}).click();await expect(page.getByText("Update unavailable",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toBeVisible();
 mode=403;await page.getByRole("button",{name:"Retry records",exact:true}).click();await expect(page.getByText("Records unavailable",{exact:true}).first()).toBeVisible();await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toHaveCount(0);
});

test("requester new-request navigation opens and cancels a backend-compatible form",async({page})=>{
 await setup(page);await page.goto("/transfers?newRequest=1");await expect(page.getByRole("heading",{name:"Create Blood Request",exact:true})).toBeVisible();
 expect(await page.locator("#requester-new-request-form").evaluate(el => Boolean(document.querySelector(".requester-records-grid")!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await expect.poll(async()=>page.locator("#requester-new-request-form").evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(200);
await expect(page.getByLabel("Blood type",{exact:true})).toBeVisible();await expect(page.getByLabel("Quantity",{exact:true})).toHaveValue("1");await expect(page.getByRole("button",{name:"Export PDF",exact:true})).toHaveCount(0);
 for (const label of ["Requesting Person", "Employee / Staff ID", "Attending Physician", "Required Date & Time", "Pickup Representative", "ID / Authorization Reference", "Request notes"]) await expect(page.getByLabel(label,{exact:true})).toBeEnabled();
 await expect(page.getByLabel("Patient / Case Reference",{exact:true})).toBeDisabled();await expect(page.getByText("Not collected until RQ-20 is decided.",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Attach request form",exact:true})).toBeEnabled();await expect(page.getByRole("button",{name:"Attach pickup document",exact:true})).toBeEnabled();await expect(page.locator('input[type="file"]')).toHaveCount(2);
 await expect(page.getByRole("heading",{name:"Operator authorization required",exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

 await page.getByRole("button",{name:"Cancel",exact:true}).click();await expect(page.getByRole("heading",{name:"Create Blood Request",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"+ New Blood Request",exact:true}).click();await expect(page.getByRole("button",{name:"Submit request",exact:true})).toBeVisible();
});


test("request form carries supported product selections and keeps them editable",async({page})=>{
 await setup(page);await page.goto("/transfers?newRequest=1&bloodType=B_NEGATIVE&componentType=PLATELETS");
 await expect(page.getByLabel("Blood type",{exact:true})).toHaveValue("B_NEGATIVE");await expect(page.getByRole("combobox",{name:"Component",exact:true})).toHaveValue("PLATELETS");
 await page.getByLabel("Blood type",{exact:true}).selectOption("O_NEGATIVE");await page.getByRole("combobox",{name:"Component",exact:true}).selectOption("WHOLE_BLOOD");
 await expect(page.getByLabel("Blood type",{exact:true})).toHaveValue("O_NEGATIVE");await expect(page.getByRole("combobox",{name:"Component",exact:true})).toHaveValue("WHOLE_BLOOD");
});

test("unsupported prefill values fall back to the existing request defaults",async({page})=>{
 await setup(page);await page.goto("/transfers?newRequest=1&bloodType=INVALID&componentType=INVALID");
 await expect(page.getByLabel("Blood type",{exact:true})).toHaveValue("A_POSITIVE");await expect(page.getByRole("combobox",{name:"Component",exact:true})).toHaveValue("PACKED_RED_BLOOD_CELLS");
});


test("primary requester chooses an available bank and submits details and a synthetic document in one bound command",async({page})=>{
 const posts:Array<Record<string,unknown>>=[];page.on("request",request=>{if(new URL(request.url()).pathname==="/api/v2/transfers"&&request.method()==="POST")posts.push(request.postDataJSON());});
 await setup(page,()=>200,true);let verification:{action:string;payload:unknown}|undefined;
 await page.route("**/api/v2/auth/operator-verifications",async route=>{verification=route.request().postDataJSON();await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({verificationId:"VFY_"+"B".repeat(40),expiresAt:instant,classification:"SIMULATION_ONLY"})});});
 await page.route("**/api/v2/transfers",async route=>{if(route.request().method()!=="POST")return route.fallback();const id="CMD_"+"C".repeat(40);await route.fulfill({status:202,contentType:"application/json",body:JSON.stringify({commandId:id,resourceType:"TRANSFER",resourceId:"TRF_WEB_X",status:"QUEUED",statusUrl:"/api/v2/commands/"+id,acceptedAt:instant,correlationId:"CORR_"+"D".repeat(32),safeErrorCode:null,classification:"SIMULATION_ONLY",replayed:false})});});
 await page.goto("/transfers?newRequest=1&bloodType=O_POSITIVE&componentType=PACKED_RED_BLOOD_CELLS");
 const supplier=page.getByLabel("Supplying blood bank",{exact:true});await expect(supplier).toHaveValue("INST_SYNTH_NLVILLA");await expect(page.getByLabel("Source blood bank",{exact:true})).toHaveCount(0);
 await expect(supplier.locator("option")).toHaveText(["N.L. Villa · 10+ available","Mediatrix · 1–4 available (less than requested)"]);
 await supplier.selectOption("INST_MEDIATRIX");await expect(supplier).toHaveValue("INST_MEDIATRIX");
 await page.getByRole("button",{name:"Supplying blood bank information",exact:true}).focus();await expect(page.getByRole("tooltip")).toContainText("Availability is not approval");
 await page.getByRole("button",{name:"Submit request",exact:true}).click();expect(await page.getByLabel("Requesting Person",{exact:true}).evaluate(el=>(el as HTMLInputElement).validity.valueMissing)).toBe(true);expect(posts).toHaveLength(0);
 await page.getByLabel("Requesting Person",{exact:true}).fill("Synthetic Requester A");await page.getByLabel("Employee / Staff ID",{exact:true}).fill("EMP-1");
 await page.getByLabel("Required Date & Time",{exact:true}).fill("2099-01-01T10:00");
 await page.getByRole("button",{name:"Submit request",exact:true}).click();expect(await page.getByLabel("Employee / Staff ID",{exact:true}).evaluate(el=>(el as HTMLInputElement).validity.patternMismatch)).toBe(true);expect(posts).toHaveLength(0);
 await page.getByLabel("Employee / Staff ID",{exact:true}).fill("SYN-STAFF-0001");await page.getByLabel("Request notes",{exact:true}).fill("Synthetic note.");
 await page.getByLabel("Standard Blood Request Form file",{exact:true}).setInputFiles({name:"request-form.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 synthetic")});
 await expect(page.getByText(/request-form\.pdf · \d+ KB/)).toBeVisible();
 await page.getByRole("button",{name:"Submit request",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Verify operator"})).toBeVisible();expect(posts).toHaveLength(0);
 await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();
 await expect.poll(()=>posts.length).toBe(1);const body=posts[0] as {sourceInstitutionId:string;details:Record<string,unknown>;documents:Array<Record<string,unknown>>};
 expect(body.sourceInstitutionId).toBe("INST_MEDIATRIX");expect(body.details).toEqual({requestingPerson:"Synthetic Requester A",staffId:"SYN-STAFF-0001",attendingPhysician:null,requiredAt:"2099-01-01T02:00:00.000Z",pickupRepresentative:null,pickupAuthorizationReference:null,notes:"Synthetic note."});
 expect(body.documents).toHaveLength(1);expect(body.documents[0]).toMatchObject({kind:"REQUEST_FORM",fileName:"request-form.pdf",contentType:"application/pdf"});expect(Buffer.from(String(body.documents[0]!.contentBase64),"base64").toString()).toBe("%PDF-1.4 synthetic");
 const bound=verification!.payload as {documents:Array<Record<string,unknown>>};expect(verification!.action).toBe("POST /api/v2/transfers");expect("contentBase64" in bound.documents[0]!).toBe(false);expect(bound.documents[0]!.contentSha256).toBe(body.documents[0]!.contentSha256);
 await expect(page.getByText(/queued, not yet approved/)).toBeVisible();
 await expect(page.getByRole("button",{name:"Fill Up",exact:true})).toBeDisabled();
});

// PA-REQ-01..04 / DESIGN.md: inline details must fit their narrow container, not just the viewport.
test("requester phone form and editable details fit without clipping or duplicate file controls",async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,()=>200,true);
 await page.goto("/transfers?newRequest=1");
 await expect(page.getByLabel("Supplying blood bank",{exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto("/transfers");await page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true}).click();
 const panel=page.locator(".request-detail-panel");
 await expect(panel.getByText("Synthetic Requester A",{exact:true})).toBeVisible();
 await expect.poll(()=>panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const input of await panel.locator('input[type="file"]').all()){
  await expect(input).toHaveCSS("position","absolute");await expect(input).toHaveCSS("width","1px");
 }
 await panel.getByRole("button",{name:"Edit details",exact:true}).click();
 await expect(panel.getByLabel("Requesting Person",{exact:true})).toBeEnabled();
 await expect.poll(()=>panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 const bounds=await panel.boundingBox();const save=await panel.getByRole("button",{name:"Save details",exact:true}).boundingBox();
 expect(save!.x+save!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width+1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("Fill Up randomizes synthetic details and attachments while preserving manual supply choices",async({page})=>{
 await setup(page,()=>200,true);await page.goto("/transfers?newRequest=1");await checkRequestFillUp(page);
});

// NFR-11: exact host policy, including leading zeros; no live domain commands.
test("six-digit institution policy accepts six digits and blocks short PINs",async({page})=>{
 await setup(page,()=>200,true,6);
 let verifiedPin:string|undefined;
 await page.route("**/api/v2/auth/operator-verifications",async route=>{
  verifiedPin=route.request().postDataJSON().pin;
  await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"SYNTHETIC_TEST_STOP",message:"Fixture stops before any command."}})});
 });
 await page.goto("/transfers?newRequest=1");
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 await page.getByRole("button",{name:"Submit request",exact:true}).click();
 const pin=page.getByLabel("Operator PIN",{exact:true});
 await expect(pin).toHaveAttribute("maxlength","6");await expect(pin).toHaveAttribute("pattern","[0-9]{6}");
 await pin.fill("1234");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();
 expect(verifiedPin).toBeUndefined();
 await pin.fill("012345");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();
 await expect.poll(()=>verifiedPin).toBe("012345");
});
