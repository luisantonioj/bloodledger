// FR-15 / FR-12: editable synthetic drafts, all-step Fill Up, and no live submission.
import {test,expect,type Page} from "@playwright/test";
async function setup(page:Page,posts:string[]){
 await page.route("**/api/**",route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==="POST")posts.push(path);
  return route.fulfill({status:path==="/api/v1/auth/session"?401:404,contentType:"application/json",body:JSON.stringify({error:{message:"Synthetic unavailable fixture"}})});
 });
 await page.goto("/");await page.getByRole("tab",{name:"Apply for access",exact:true}).click();
}
async function selectCategory(page:Page,bank:boolean){await page.getByRole("button",{name:bank?/Apply as a Blood Bank/:/Apply as a Requestor/}).click();}
async function checkCapabilities(page:Page){for(const checkbox of await page.locator('.qualification-checklist input[type="checkbox"]').all())await checkbox.check();}
for(const bank of [true,false])test(`${bank?"BLOOD_BANK":"REQUESTOR"} one Fill Up fills every step while editable declarations stay deliberate`,async({page})=>{
 const posts:string[]=[];await setup(page,posts);await selectCategory(page,bank);
 await expect(page.getByLabel("Private invitation secret",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Facility information",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 const name=await page.getByLabel("Facility name",{exact:true}).inputValue();
 expect(name).toContain("Synthetic");expect(name).toContain(bank?"Blood Bank":"Requestor Facility");
 for(const input of await page.locator('.application-fields input,.application-fields select').all()){
  await expect(input).toBeEnabled();expect(await input.inputValue()).not.toBe("");
 }
 await page.getByLabel("Registered legal name",{exact:true}).fill("Synthetic Edited Legal Name");
 const fill=await page.getByRole("button",{name:"Fill Up",exact:true}).boundingBox(),next=await page.getByRole("button",{name:"Continue",exact:true}).boundingBox();
 expect(fill!.x+fill!.width).toBeLessThanOrEqual(next!.x);
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("heading",{name:bank?"Blood Service Facility qualification":"Requestor receiving capability",exact:true})).toBeVisible();
 for(const input of await page.locator('.application-fields input,.application-fields select').all()){
  await expect(input).toBeEnabled();expect(await input.inputValue()).not.toBe("");
 }
 for(const checkbox of await page.locator('.qualification-checklist input').all())await expect(checkbox).not.toBeChecked();
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("heading",{name:bank?"Blood Service Facility qualification":"Requestor receiving capability",exact:true})).toBeVisible();
 await checkCapabilities(page);await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByLabel("Full name",{exact:true})).toBeEnabled();
 const password=await page.locator('.application-form').getByLabel("Applicant password",{exact:true}).inputValue();
 expect(password.length).toBeGreaterThanOrEqual(12);await expect(page.getByLabel("Confirm password",{exact:true})).toHaveValue(password);
 await page.getByLabel("Confirm password",{exact:true}).fill("synthetic-mismatch");
 await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Passwords do not match");
 await page.getByLabel("Confirm password",{exact:true}).fill(password);await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Supporting documents & declaration",exact:true})).toBeVisible();
 await expect(page.locator('.application-document-name')).toHaveCount(3);
 await expect(page.getByRole("checkbox",{name:/I confirm these application details/})).not.toBeChecked();
 const firstRemove=page.getByRole("button",{name:/Remove sample:/}).first();await firstRemove.click();
 await expect(page.locator('.application-document-name')).toHaveCount(2);
 await page.getByRole("button",{name:/Attach sample:/}).click();await expect(page.locator('.application-document-name')).toHaveCount(3);
 await page.getByRole("checkbox",{name:/I confirm these application details/}).check();
 await expect(page.getByRole("button",{name:"Submit for PRC review",exact:true})).toBeDisabled();
 await page.locator('.application-form').evaluate(form=>(form as HTMLFormElement).requestSubmit());
 await expect(page.getByRole("alert")).toContainText("Public application submission is not connected yet");
 // A fill on a later step replaces the entire draft without navigating away.
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Supporting documents & declaration",exact:true})).toBeVisible();
 await expect(page.getByRole("checkbox",{name:/I confirm these application details/})).not.toBeChecked();
 for(let i=0;i<3;i++)await page.getByRole("button",{name:"Previous",exact:true}).click();
 expect(await page.getByLabel("Facility name",{exact:true}).inputValue()).not.toBe(name);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(posts).toEqual([]);
});
for(const bank of [true,false])test(`${bank?"BLOOD_BANK":"REQUESTOR"} preview cycle uses five different facilities and never consumes an account`,async({page})=>{
 const posts:string[]=[];await setup(page,posts);await selectCategory(page,bank);
 const names:string[]=[];
 for(let i=0;i<5;i++){
  await page.getByRole("button",{name:"Fill Up",exact:true}).click();
  const name=await page.getByLabel("Facility name",{exact:true}).inputValue();expect(names).not.toContain(name);names.push(name);
 }
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 const next=await page.getByLabel("Facility name",{exact:true}).inputValue();expect(names).toContain(next);expect(next).not.toBe(names[4]);
 expect(posts).toEqual([]);
});
test("changing category clears draft documents and values",async({page})=>{
 await setup(page,[]);await selectCategory(page,true);
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 await page.getByRole("button",{name:"← Change application",exact:true}).click();await selectCategory(page,false);
 await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue("");
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue(/Requestor Facility/);
 await page.getByRole("button",{name:"Continue",exact:true}).click();await checkCapabilities(page);
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByText("DOH Blood Service Facility LTO",{exact:true})).toHaveCount(0);
 await expect(page.getByText("Blood Station ATO or transfusion-service authorization",{exact:true})).toBeVisible();
});
