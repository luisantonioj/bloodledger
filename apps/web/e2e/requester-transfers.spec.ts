// Synthetic browser fixtures: requester scope, independent reservation state, and refresh safety.
import {expect, test, type Page} from "@playwright/test";
const instant="2026-10-09T04:00:00.000Z";
const own={transfer_id:"TRF_REQUESTER_01",source_institution_id:"INST_MEDIATRIX",destination_institution_id:"INST_REQUESTER",blood_type:"O_POSITIVE",component_type:"PACKED_RED_BLOOD_CELLS",quantity:3,urgency:"URGENT",request_time:instant,status:"REQUESTED",ledger_transaction_id:null};
const reservation={reservation_id:"RES_REQUESTER_01",transfer_id:own.transfer_id,purpose:"TRANSFER",status:"IN_TRANSIT",version:2,institution_id:"INST_MEDIATRIX",destination_institution_id:"INST_REQUESTER"};
async function setup(page:Page, mode:()=>number=()=>200, primary=false){await page.route("**/api/**",async route=>{
 const path=new URL(route.request().url()).pathname;
 let status=200,body:unknown;
 if(path==="/api/v1/auth/session")body={principal:{userId:"USR_REQUESTER",displayName:"Synthetic Requester",institutionId:"INST_REQUESTER",institutionDisplayName:"Synthetic Requester Hospital",roleId:"ROLE-03",roleDisplayName:"Requester",...(primary?{accountId:"ACC_REQUESTER",accountCategory:"REQUESTOR",operators:[{operatorId:"OP_REQUESTER",roleId:"ROLE-03",capabilityProfile:"ROLE",version:1,actionCapabilities:["transfer:request"]}]}:{}),permissions:["dashboard:operational","transfers:read","transfers:write","profile:read"],classification:"SIMULATION_ONLY"}};
 else if(path==="/api/v2/transfers"){status=mode();body=status===200?{requests:[own,{...own,transfer_id:"TRF_FOREIGN",destination_institution_id:"INST_FOREIGN"}],reservations:[reservation,{...reservation,reservation_id:"RES_LOCAL_RELEASE",purpose:"LOCAL_RELEASE"}],timeline:[],classification:"SIMULATION_ONLY"}:{error:{message:"Synthetic read failure"}};}
 else if(path==="/api/v2/reservations/RES_REQUESTER_01")body={reservationId:reservation.reservation_id,purpose:"TRANSFER",status:"IN_TRANSIT",version:2,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_REQUESTER",transferId:own.transfer_id,localReleaseId:null,preparedAt:instant,preparedEvidencePresent:true,updatedAt:instant,components:[],classification:"SIMULATION_ONLY"};
 else {status=404;body={error:{message:"Synthetic endpoint unavailable"}};}
 await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
 });}

test("requester list keeps own request and reservation status independent and opens inline verified details",async({page})=>{
 await setup(page);await page.goto("/transfers");
 const grid=page.locator(".requester-records-grid");await expect(grid.getByText("TRF_REQUESTER_01",{exact:true})).toBeVisible();await expect(page.getByText("TRF_FOREIGN",{exact:true})).toHaveCount(0);
 await expect(grid.getByText("Requested",{exact:true})).toBeVisible();await expect(grid.getByText("Awaiting ledger confirmation",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true}).click();await expect(page.getByRole("heading",{name:"Transfer request details",exact:true})).toBeVisible();await expect(page.locator(".requester-record-detail").getByText("O POSITIVE / PACKED RED BLOOD CELLS",{exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);await page.keyboard.press("Escape");await expect(page.getByRole("heading",{name:"Request Details",exact:true})).toBeVisible();
 await page.getByRole("tab",{name:/Blood Requests/}).focus();await page.keyboard.press("ArrowRight");await expect(page.getByRole("tab",{name:/Transfers/})).toBeFocused();await expect(grid.getByText("In transit",{exact:true})).toBeVisible();await expect(page.getByText("RES_LOCAL_RELEASE",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Open reservation RES_REQUESTER_01",exact:true}).click();await expect(page.getByRole("heading",{name:"Reservation details",exact:true})).toBeVisible();await expect(page.locator(".requester-record-detail").getByText("IN TRANSIT",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:/Record receipt|Record dispatch|Approve/})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("requester refresh retains confirmed records for service failure and clears them for access denial",async({page})=>{
 let mode=200;await setup(page,()=>mode);await page.goto("/transfers");await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toBeVisible();
 mode=503;await page.getByRole("button",{name:"Refresh",exact:true}).click();await expect(page.getByText("Update unavailable",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toBeVisible();
 mode=403;await page.getByRole("button",{name:"Retry records",exact:true}).click();await expect(page.getByText("Records unavailable",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Open request TRF_REQUESTER_01",exact:true})).toHaveCount(0);
});

test("requester new-request navigation opens and cancels a backend-compatible form",async({page})=>{
 await setup(page);await page.goto("/transfers?newRequest=1");await expect(page.getByRole("heading",{name:"Create Blood Request",exact:true})).toBeVisible();
 expect(await page.locator("#requester-new-request-form").evaluate(el => Boolean(document.querySelector(".requester-records-grid")!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await expect.poll(async()=>page.locator("#requester-new-request-form").evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(200);
await expect(page.getByLabel("Blood type",{exact:true})).toBeVisible();await expect(page.getByLabel("Quantity",{exact:true})).toHaveValue("1");await expect(page.getByRole("button",{name:"Export PDF",exact:true})).toHaveCount(0);
 for (const label of ["Requesting Person", "Employee / Staff ID", "Attending Physician", "Patient / Case Reference", "Required Date & Time", "Pickup Representative", "ID / Authorization Reference", "Request notes"]) await expect(page.getByLabel(label,{exact:true})).toBeDisabled();
 await expect(page.getByRole("button",{name:"Attach request form",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Attach pickup document",exact:true})).toBeDisabled();await expect(page.locator('input[type="file"]')).toHaveCount(0);
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


test("primary requester automatic-routing placeholder cannot submit a silently assigned bank",async({page})=>{
 let posts=0;page.on("request",request=>{if(new URL(request.url()).pathname==="/api/v2/transfers"&&request.method()==="POST")posts++;});
 await setup(page,()=>200,true);await page.goto("/transfers?newRequest=1&bloodType=B_NEGATIVE&componentType=PLATELETS");
 await expect(page.getByLabel("Supplier Routing",{exact:true})).toHaveValue("Assign automatically");await expect(page.getByLabel("Supplier Routing",{exact:true})).toHaveAttribute("readonly","");await expect(page.getByLabel("Source blood bank",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Submit request",exact:true})).toBeDisabled();await page.getByLabel("Quantity",{exact:true}).press("Enter");expect(posts).toBe(0);
 await page.getByRole("button",{name:"Supplier Routing information",exact:true}).focus();await expect(page.getByRole("tooltip")).toContainText("Submission is unavailable until routing is connected.");
 await expect(page.getByLabel("Blood type",{exact:true})).toHaveValue("B_NEGATIVE");await expect(page.getByRole("combobox",{name:"Component",exact:true})).toHaveValue("PLATELETS");
});
