// FR-15: saved layout and server-owned read-only Fill Up while deployment is gated.
import {test,expect,type Page} from "@playwright/test";
import {catalog,selection,type Category} from "./public-application-fixtures";
async function setup(page:Page,posts:string[],category:Category){
 let index=0;
 await page.route("**/api/**",route=>{const request=route.request(),url=new URL(request.url());if(request.method()==="POST")posts.push(url.pathname);
 if(url.pathname==="/api/v2/onboarding/sample-facilities")return route.fulfill({json:catalog(category)});
 if(url.pathname.endsWith("/sample-facilities/selection"))return route.fulfill({json:selection(category,index++%5)});
 return route.fulfill({status:url.pathname==="/api/v1/auth/session"?401:404,json:{error:{message:"Synthetic unavailable fixture"}}});});
 await page.goto("/");await page.getByRole("tab",{name:"Apply for access",exact:true}).click();await page.getByRole("button",{name:category==="BLOOD_BANK"?/Apply as a Blood Bank/:/Apply as a Requestor/}).click();
}
async function capabilities(page:Page){for(const checkbox of await page.locator('.qualification-checklist input').all())await checkbox.check();}
for(const category of ["BLOOD_BANK","REQUESTOR"] as const)test(`${category} fills every step from server without enabling an unapproved deployment`,async({page})=>{
 const posts:string[]=[];await setup(page,posts,category);
 await expect(page.getByLabel("Private invitation secret",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue(/Synthetic/);
 await expect(page.getByLabel("Registered legal name",{exact:true})).toBeEnabled();
 await page.getByRole("button",{name:"Continue",exact:true}).click();
 for(const box of await page.locator('.qualification-checklist input').all())await expect(box).not.toBeChecked();
 await capabilities(page);await page.getByRole("button",{name:"Continue",exact:true}).click();
 await expect(page.getByLabel("Full name",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Employee ID",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Applicant reference (synthetic)",{exact:true})).toHaveValue(/^SYNTH-PERSON-/);
 const password=await page.locator('.application-form').getByLabel("Applicant password",{exact:true}).inputValue();expect(password.length).toBeGreaterThanOrEqual(16);await expect(page.getByLabel("Confirm password",{exact:true})).toHaveValue(password);
 await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page.locator('.application-document-name')).toHaveCount(3);
 await page.getByRole("button",{name:/Remove synthetic fixture:/}).first().click();await expect(page.locator('.application-document-name')).toHaveCount(2);
 await page.getByRole("button",{name:/Attach synthetic fixture:/}).click();await expect(page.locator('.application-document-name')).toHaveCount(3);
 await page.getByRole("checkbox",{name:/I confirm these application details/}).check();await expect(page.getByRole("button",{name:"Submit for PRC review",exact:true})).toBeDisabled();
 await page.locator('.application-form').evaluate(form=>(form as HTMLFormElement).requestSubmit());await expect(page.getByText("Public application submission is not connected yet.",{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(posts).toEqual([]);
});
test("identity edits switch to manual and later Fill Up restores a server sample",async({page})=>{
 await setup(page,[],"BLOOD_BANK");await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue(/Synthetic/);
 await page.getByLabel("Facility name",{exact:true}).fill("Synthetic Manual Bank");await expect(page.getByText(/Manual application\. Catalog identities/)).toBeVisible();
 await page.getByRole("button",{name:"Fill Up",exact:true}).click();await expect(page.getByLabel("Facility name",{exact:true})).not.toHaveValue("Synthetic Manual Bank");await expect(page.getByText(/Sample facility · Instance 1/)).toBeVisible();
});
test("old host keeps the manual draft and displays no false Fill Up success",async({page})=>{
 await setup(page,[],"REQUESTOR");await page.route("**/api/v2/onboarding/sample-facilities/selection?**",route=>route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}}));
 await page.getByLabel("Facility name",{exact:true}).fill("Synthetic Manual Draft");await page.getByRole("button",{name:"Fill Up",exact:true}).click();
 await expect(page.getByRole("alert")).toContainText("Public applications are not available on this server yet");await expect(page.getByLabel("Facility name",{exact:true})).toHaveValue("Synthetic Manual Draft");
});
