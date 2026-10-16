// Enabled only in an isolated synthetic build; never enables the retained service.
import {test,expect,type Page,type Route} from "@playwright/test";
import {catalog,selection,result,type Category} from "./public-application-fixtures";
type Attempt={body:Record<string,any>;key:string};
async function setup(page:Page,category:Category,posts:Attempt[],respond?:(route:Route,index:number)=>Promise<void>){
 let index=0;
 await page.route("**/api/**",async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==="/api/v1/auth/session")return route.fulfill({status:401,json:{error:{message:"No session"}}});
  if(url.pathname==="/api/v2/onboarding/sample-facilities")return route.fulfill({json:catalog(category)});
  if(url.pathname.endsWith("/sample-facilities/selection"))return route.fulfill({json:selection(category,index++%5)});
  if(url.pathname==="/api/v2/onboarding/public-applications"&&request.method()==="POST"){
   posts.push({body:request.postDataJSON(),key:request.headers()["idempotency-key"]});
   return respond?respond(route,posts.length):route.fulfill({json:result(category,posts.at(-1)!.body.sample)});
  }
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 await page.goto("/");await page.getByRole("tab",{name:"Apply for access",exact:true}).click();await page.getByRole("button",{name:category==="BLOOD_BANK"?/Apply as a Blood Bank/:/Apply as a Requestor/}).click();
}
async function complete(page:Page){
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue(/Synthetic/);
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 for(const box of await page.locator('.qualification-checklist input').all()){await expect(box).not.toBeChecked();await box.check();}
 await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();
 await page.getByRole("checkbox",{name:/I confirm these application details/}).check();
}
for(const category of ["BLOOD_BANK","REQUESTOR"] as const)test(`${category} submits the exact nested public contract with no deprecated route`,async({page})=>{
 const posts:Attempt[]=[];await setup(page,category,posts);await complete(page);expect(posts).toHaveLength(0);
 await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect(page.getByText(/Application submitted for PRC review\. This is not an activated account/)).toBeVisible();
 expect(posts).toHaveLength(1);const body=posts[0].body;
 expect(Object.keys(body).sort()).toEqual(["schemaVersion","category","sample","facility","qualification","primaryAccount","documents","declaration","correlationId"].sort());
 expect(body.schemaVersion).toBe("PUBLIC_APPLICATION_V1");expect(body.category).toBe(category);expect(body.sample.instance).toBe(1);expect(body.primaryAccount.applicantReference).toMatch(/^SYNTH-PERSON-/);expect(body.primaryAccount).not.toHaveProperty("confirmation");expect(body).not.toHaveProperty("invitationSecret");
 expect(body.documents).toHaveLength(3);expect(body.declaration).toEqual({syntheticDataOnly:true,accuracyAttested:true});
});
test("ambiguous response freezes the exact attempt and only explicit retry replays it",async({page})=>{
 const posts:Attempt[]=[];await setup(page,"BLOOD_BANK",posts,async(route,index)=>index===1?route.abort("failed"):route.fulfill({json:result("BLOOD_BANK",posts[0].body.sample,true)}));await complete(page);
 await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Submission outcome is unknown");
 expect(posts).toHaveLength(1);await expect(page.getByRole("button",{name:"Fill Up",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Previous",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Retry submission",exact:true}).click();await expect(page.getByText(/Application submitted for PRC review/)).toBeVisible();expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);
});
for(const code of ["ONB_SAMPLE_UNAVAILABLE","ONB_SAMPLE_STALE","ONB_SAMPLE_IDENTITY_RESERVED","ONB_DUPLICATE_APPLICATION","ONB_IDEMPOTENCY_CONFLICT"]){
 test(`${code} keeps the draft and a deliberate next submit uses a new key`,async({page})=>{
  const posts:Attempt[]=[];await setup(page,"REQUESTOR",posts,route=>route.fulfill({status:409,json:{error:{code,message:"No values echoed"}}}));await complete(page);await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();
  await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByRole("button",{name:"Previous",exact:true})).toBeEnabled();expect(posts).toHaveLength(1);
  await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect.poll(()=>posts.length).toBe(2);expect(posts[1].key).not.toBe(posts[0].key);expect(posts[1].body.facility).toEqual(posts[0].body.facility);
 });
}
test("field errors navigate and focus the invalid field without echoing values",async({page})=>{
 const posts:Attempt[]=[];await setup(page,"BLOOD_BANK",posts,route=>route.fulfill({status:400,json:{error:{code:"ONB_APPLICATION_INVALID",details:[{field:"facility.officialPhone",rule:"PATTERN"}]}}}));await complete(page);await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();
 await expect(page.getByLabel("Official phone",{exact:true})).toBeFocused();await expect(page.getByLabel("Official phone",{exact:true})).toHaveAttribute("aria-invalid","true");
});
test("exhausted selection keeps manual values and never invents another facility",async({page})=>{
 await setup(page,"REQUESTOR",[]);await page.route("**/api/v2/onboarding/sample-facilities/selection?**",route=>route.fulfill({json:{catalogVersion:"SYNTHETIC_FACILITY_CATALOG_V1",category:"REQUESTOR",eligibleCount:0,status:"EXHAUSTED",sample:null,classification:"SIMULATION_ONLY"}}));
 await page.getByLabel("Facility name",{exact:true}).fill("Synthetic Manual Requestor");await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByText(/No sample facilities remain/)).toBeVisible();await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue("Synthetic Manual Requestor");await expect(page.getByLabel("Facility name",{exact:true})).toBeEnabled();
});
test("429 respects Retry-After before another explicit submission",async({page})=>{
 const posts:Attempt[]=[];await setup(page,"REQUESTOR",posts,route=>route.fulfill({status:429,headers:{"Retry-After":"2"},json:{error:{code:"ONB_PUBLIC_RATE_LIMITED"}}}));await complete(page);await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect(page.getByText(/Try again in \d+ seconds/)).toBeVisible();await expect(page.getByRole("button",{name:"Submit for PRC review",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Submit for PRC review",exact:true})).toBeEnabled({timeout:5000});expect(posts).toHaveLength(1);
});

for(const purged of [false,true])test(purged?"PRC purged application tells the facility to reapply and blocks retry":"PRC public activation prefills its exact requested login and retains PIN verification",async({page})=>{
 const chosen=selection("BLOOD_BANK"),applicationId="ONB_"+"B".repeat(40),posts:Attempt[]=[];
 const principal={userId:"USR_PRC_REVIEW",accountId:"ACC_PRC_REVIEW",accountCategory:"PRC",institutionId:"INST_SYNTH_PRC",institutionDisplayName:"Synthetic PRC",displayName:"Synthetic reviewer",roleId:"ROLE-04",roleDisplayName:"PRC reviewer",permissions:["profile:read"],verificationRequired:true,operators:[{operatorId:"OP_PRC",roleId:"ROLE-04",capabilityProfile:"PRC_REVIEWER",actionCapabilities:["onboarding:activate","institution:deregister"]}],classification:"SIMULATION_ONLY"};
 const application={application_id:applicationId,category:"BLOOD_BANK",schema_version:"PUBLIC_APPLICATION_V1",status:"APPROVED",version:3,institution_id:null,detail:{...chosen.fill,institutionDisplayName:chosen.fill.facility.displayName,schemaVersion:"PUBLIC_APPLICATION_V1",sample:chosen.sample}};
 await page.route("**/api/**",route=>{const req=route.request(),path=new URL(req.url()).pathname;
  if(path==="/api/v1/auth/session")return route.fulfill({json:{principal}});
  if(path==="/api/v2/onboarding/institutions")return route.fulfill({json:{institutions:[]}});
  if(path==="/api/v2/onboarding/institutions/INST_SYNTH_PRC")return route.fulfill({json:{institution:{institution_id:"INST_SYNTH_PRC",display_name:"Synthetic PRC",account_category:"PRC",status:"ACTIVE",version:1},operators:[]}});
  if(path==="/api/v2/onboarding/applications")return route.fulfill({json:{applications:[application],nextCursor:null}});
  if(path==="/api/v2/onboarding/applications/"+applicationId)return route.fulfill({json:{application}});
  if(path==="/api/v2/auth/operator-verifications")return route.fulfill({json:{verificationId:"VFY_SYNTHETIC_REVIEW"}});
  if(req.method()==="POST"){posts.push({body:req.postDataJSON(),key:req.headers()["idempotency-key"]});return purged?route.fulfill({status:409,json:{error:{code:"ONB_APPLICATION_DETAIL_PURGED",message:"Purged details"}}}):route.fulfill({json:{classification:"SIMULATION_ONLY"}});}
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 await page.goto("/accounts");await page.getByRole("button",{name:"View application",exact:true}).click();await page.getByRole("button",{name:"activate",exact:true}).click();
 await expect(page.getByLabel("Institution email",{exact:true})).toHaveValue(chosen.fill.primaryAccount.requestedLoginEmail);await expect(page.getByLabel("Institution email",{exact:true})).toHaveAttribute("readonly","");
 await page.getByLabel("New account password",{exact:true}).fill("synthetic-institution-password");await page.getByLabel("New administrator PIN",{exact:true}).fill("24681357");await page.getByRole("button",{name:"Verify and submit change",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Verify operator",exact:true})).toBeVisible();expect(posts).toHaveLength(0);await page.getByLabel("Operator PIN",{exact:true}).fill("24681357");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();if(purged){await expect(page.getByText(/The facility must reapply before activation/)).toBeVisible();await expect(page.getByRole("button",{name:"Verify and submit change",exact:true})).toBeDisabled();}else await expect(page.getByText("Change recorded. The server remains authoritative for access.",{exact:true})).toBeVisible();expect(posts).toHaveLength(1);expect(posts[0].body.loginEmail).toBe(chosen.fill.primaryAccount.requestedLoginEmail);expect(posts[0].body.expectedVersion).toBe(3);
});

test("PRC deregistration is available only for suspended onboarded institutions; terminal accounts cannot reactivate",async({page})=>{
 const appId="ONB_"+"C".repeat(40),institutions=[{institution_id:"INST_POLICY",display_name:"Synthetic Policy Bank",account_category:"BLOOD_BANK",status:"SUSPENDED",version:1},{institution_id:"INST_ONB_TEST",display_name:"Synthetic Onboarded Bank",account_category:"BLOOD_BANK",status:"SUSPENDED",version:4},{institution_id:"INST_ONB_ENDED",display_name:"Synthetic Ended Bank",account_category:"BLOOD_BANK",status:"DEREGISTERED",version:7}];
 await page.route("**/api/**",route=>{const path=new URL(route.request().url()).pathname;
  if(path==="/api/v1/auth/session")return route.fulfill({json:{principal:{userId:"USR_PRC",accountId:"ACC_PRC",accountCategory:"PRC",institutionId:"INST_SYNTH_PRC",institutionDisplayName:"Synthetic PRC",displayName:"Synthetic reviewer",roleId:"ROLE-04",roleDisplayName:"Reviewer",permissions:["profile:read"],verificationRequired:true,operators:[{operatorId:"OP_PRC",roleId:"ROLE-04",actionCapabilities:["institution:deregister"]}],classification:"SIMULATION_ONLY"}}});
  if(path==="/api/v2/onboarding/institutions")return route.fulfill({json:{institutions}});
  if(path==="/api/v2/onboarding/applications")return route.fulfill({json:{applications:[],nextCursor:null}});
  const inst=institutions.find(row=>path.endsWith("/"+row.institution_id));if(inst)return route.fulfill({json:{institution:inst,operators:[],application:inst.institution_id==="INST_POLICY"?null:{applicationId:appId}}});
  if(path.endsWith("/INST_SYNTH_PRC"))return route.fulfill({json:{institution:{institution_id:"INST_SYNTH_PRC",display_name:"Synthetic PRC",status:"ACTIVE",account_category:"PRC",version:1},operators:[]}});
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 await page.goto("/accounts");await page.getByRole("row").filter({hasText:"Synthetic Policy Bank"}).getByRole("button",{name:"View institution"}).click();await expect(page.getByText("Synthetic Policy Bank · SUSPENDED",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Deregister institution",exact:true})).toHaveCount(0);
 await page.getByRole("row").filter({hasText:"Synthetic Onboarded Bank"}).getByRole("button",{name:"View institution"}).click();await expect(page.getByRole("button",{name:"Deregister institution",exact:true})).toBeVisible();await page.getByRole("button",{name:"Deregister institution",exact:true}).click();await expect(page.getByLabel("Reason code",{exact:true})).toBeVisible();
 const terminal=page.getByRole("row").filter({hasText:"Synthetic Ended Bank"});await expect(terminal.getByRole("button",{name:"Reactivate institution",exact:true})).toHaveCount(0);await expect(terminal.getByRole("button",{name:"Edit profile",exact:true})).toHaveCount(0);
});

test("own profile displays retained facility and application linkage without applicant credentials",async({page})=>{
 const selected=selection("REQUESTOR"),inst={institution_id:"INST_ONB_PROFILE",display_name:selected.fill.facility.displayName,account_category:"REQUESTOR",status:"ACTIVE",version:1};
 await page.route("**/api/**",route=>{const path=new URL(route.request().url()).pathname;
  if(path==="/api/v1/auth/session")return route.fulfill({json:{principal:{userId:"USR_PROFILE",accountId:"ACC_PROFILE",accountCategory:"REQUESTOR",institutionId:inst.institution_id,institutionDisplayName:inst.display_name,displayName:"Synthetic requester",roleId:"ROLE-06",roleDisplayName:"Institution administrator",permissions:["profile:read"],operators:[],classification:"SIMULATION_ONLY"}}});
  if(path.endsWith("/"+inst.institution_id))return route.fulfill({json:{institution:inst,operators:[],facilityProfile:{facility:selected.fill.facility,qualification:selected.fill.qualification,documents:selected.fill.documents,loginEmail:selected.fill.primaryAccount.requestedLoginEmail,sample:selected.sample},application:{applicationId:"ONB_"+"D".repeat(40),schemaVersion:"PUBLIC_APPLICATION_V1",submittedAt:"2026-10-15T00:00:00Z",approvedAt:"2026-10-15T01:00:00Z",activatedAt:"2026-10-15T02:00:00Z",deregisteredAt:null}}});
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 await page.goto("/profile");await expect(page.getByText(selected.fill.facility.legalName,{exact:true})).toBeVisible();await expect(page.getByText(selected.fill.facility.officialEmail,{exact:true})).toBeVisible();await expect(page.getByText(selected.fill.primaryAccount.requestedLoginEmail,{exact:true})).toBeVisible();await expect(page.getByText("ONB_"+"D".repeat(40),{exact:true})).toBeVisible();await expect(page.getByText(selected.fill.primaryAccount.applicantReference,{exact:true})).toHaveCount(0);
});

test("Fill Up excludes the current server sample, fills all steps and clears prior attestations without a POST",async({page})=>{
 const posts:Attempt[]=[],reads:string[]=[];page.on("request",request=>{if(request.url().includes("sample-facilities/selection"))reads.push(request.url());});
 await setup(page,"BLOOD_BANK",posts);await complete(page);const current=selection("BLOOD_BANK").sample.sampleId;
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByRole("checkbox",{name:/I confirm these application details/})).not.toBeChecked();
 expect(new URL(reads[1]).searchParams.get("exclude")).toBe(current);expect(posts).toHaveLength(0);
 await page.getByRole("button",{name:"Previous",exact:true}).click();await page.getByRole("button",{name:"Previous",exact:true}).click();for(const checkbox of await page.locator('.qualification-checklist input').all())await expect(checkbox).not.toBeChecked();
});

test("missing required fixtures is a local validation issue, never an ambiguous write",async({page})=>{
 const posts:Attempt[]=[];await setup(page,"BLOOD_BANK",posts);await complete(page);await page.getByRole("button",{name:/Remove synthetic fixture:/}).first().click();await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Attach every required synthetic fixture");expect(posts).toHaveLength(0);await expect(page.getByRole("button",{name:"Previous",exact:true})).toBeEnabled();
});

test("editing bound identity deliberately submits a manual sample:null application",async({page})=>{
 const posts:Attempt[]=[];await setup(page,"REQUESTOR",posts);await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue(/Synthetic/);
 for(const [label,value] of [["Facility name","Synthetic Manual Requestor"],["Registered legal name","Synthetic Manual Requestor Association"],["Official facility email","office@manualqa.bloodledger"],["Hospital / Health Facility LTO number","SYNTH-HF-MANUAL"]])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByLabel("Blood Station ATO / authorization number",{exact:true}).fill("SYNTH-AUTH-MANUAL");for(const checkbox of await page.locator('.qualification-checklist input').all())await checkbox.check();await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByLabel("Facility Account email",{exact:true}).fill("facility@manualqa.bloodledger");await page.getByRole("button",{name:"Continue",exact:true}).click();await page.getByRole("checkbox",{name:/I confirm these application details/}).check();await page.getByRole("button",{name:"Submit for PRC review",exact:true}).click();await expect(page.getByText(/Application submitted for PRC review/)).toBeVisible();expect(posts[0].body.sample).toBeNull();expect(posts[0].body.facility.displayName).toBe("Synthetic Manual Requestor");
});
