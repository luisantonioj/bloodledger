import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {readPage} from "./fixtures/transaction-reads";
import {fileURLToPath} from "node:url";
import path from "node:path";
async function setup(page:Page,context:BrowserContext){
 const writes:string[]=[];
 await page.route(/\/api\/v[12]\//,route=>{
  const request=route.request(),pathname=new URL(request.url()).pathname;if(request.method()!=="GET"){writes.push(pathname);return route.abort();}
  if(pathname==="/api/v1/auth/session")return route.fulfill({json:{principal:{accountId:"ACC_EXTRACT",accountCategory:"BLOOD_BANK",verificationRequired:true,userId:"USR_EXTRACT",displayName:"Synthetic account",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic Mediatrix",roleId:"ROLE-02",roleDisplayName:"Coordinator",permissions:["inventory:read","transfers:read","profile:read"],operators:[{operatorId:"OP_EXTRACT",roleId:"ROLE-02",capabilityProfile:"ROLE",actionCapabilities:["inventory:capture"]}],classification:"SIMULATION_ONLY"}}});
  if(pathname==="/api/v2/unit-history")return route.fulfill({json:readPage("UNIT_HISTORY_READ_V1",[])});
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 const assets=fileURLToPath(new URL("../../capture-pwa/public/ocr-assets/",import.meta.url));await context.route("**/capture/ocr-assets/**",route=>{const name=new URL(route.request().url()).pathname.split("/ocr-assets/")[1];return !name||name.includes("..")?route.abort():route.fulfill({path:path.join(assets,name)});});
 await page.goto("/transactions");await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:"Inbound",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Mobile blood unit scanner",exact:true});
 const data=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=700;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1600,700);ctx.fillStyle="black";ctx.font="bold 42px monospace";[["MARY MEDIATRIX",70],["Donation No.",140],["MM26-10-7001",200],["Blood Type",270],["B positive",330],["Collection Date",400],["10/12/26",460],["Expiry Date",530],["2026-11-01",590]].forEach(([text,y])=>ctx.fillText(String(text),70,Number(y)));return canvas.toDataURL("image/png");});
 await dialog.getByLabel("Blood-unit label image",{exact:true}).setInputFiles({name:"synthetic-profile.png",mimeType:"image/png",buffer:Buffer.from(data.split(",")[1],"base64")});
 return {dialog,writes};
}
test("profile extraction keeps partial values, date precision and edited fields through a guided recapture",async({page,context})=>{
 const {dialog,writes}=await setup(page,context);
 await dialog.getByText("Adjust image and field selection",{exact:true}).click();await dialog.getByLabel("Label layout",{exact:true}).selectOption("MEDIATRIX_BAG_PREVIEW");
 await dialog.getByRole("button",{name:"Run OCR",exact:true}).click();
 await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toHaveValue("MM26-10-7001",{timeout:90000});
 await expect(dialog.getByLabel("Review blood type",{exact:true})).toHaveValue("B_POSITIVE");await expect(dialog.getByLabel("Review component",{exact:true})).toHaveValue("");
 await expect(dialog.getByLabel("Collection time (UTC)",{exact:true})).toHaveValue("");await expect(dialog.getByLabel("Expiration time (UTC)",{exact:true})).toHaveValue("2026-11-01");
 await expect(dialog.getByText("Suggestions are not verified capture evidence.",{exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();
 await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-10-7002");
 await dialog.getByLabel("Read region as",{exact:true}).selectOption("bloodType");await dialog.getByLabel("Crop height",{exact:true}).fill("8");await dialog.getByLabel("Crop y",{exact:true}).fill("42");await dialog.getByLabel("Crop width",{exact:true}).fill("70");await dialog.getByLabel("Crop x",{exact:true}).fill("4");
 await dialog.getByRole("button",{name:"Run OCR",exact:true}).click();await expect(dialog.getByRole("button",{name:"Run OCR",exact:true})).toBeEnabled({timeout:90000});
 await expect(dialog.getByLabel("Review blood type",{exact:true})).toHaveValue("B_POSITIVE");await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toHaveValue("MM26-10-7002");await expect(dialog.getByText(/Edited · Engine score/)).toBeVisible();
 await expect(dialog.getByText("Inspect field crop",{exact:true}).first()).toBeVisible();expect(writes).toEqual([]);
 await dialog.getByRole("button",{name:"Close mobile scanner",exact:true}).click();await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:"Inbound",exact:true}).click();await expect(dialog.getByAltText("Selected blood-unit label preview",{exact:true})).toHaveCount(0);await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toHaveCount(0);
});
test("crop controls validate bounds, rotate locally and stay inside the mobile viewport",async({page,context})=>{
 const {dialog,writes}=await setup(page,context);await page.setViewportSize({width:390,height:844});await dialog.getByText("Adjust image and field selection",{exact:true}).click();await dialog.getByRole("button",{name:"Rotate right",exact:true}).click();await expect(dialog.getByAltText("Prepared label crop",{exact:true})).toBeVisible();await dialog.getByLabel("Crop x",{exact:true}).fill("95");await expect(dialog.getByText(/Choose a crop inside the image/)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(writes).toEqual([]);
});
test("authentication context loss clears the volatile label and scanner state",async({page,context})=>{
 const {dialog,writes}=await setup(page,context);await expect(dialog.getByAltText("Selected blood-unit label preview",{exact:true})).toBeVisible();
 await page.route(/\/api\/v1\/auth\/session$/,route=>route.fulfill({status:401,json:{error:{code:"UNAUTHENTICATED"}}}));await page.reload();await expect(page.getByRole("dialog",{name:"Mobile blood unit scanner",exact:true})).toHaveCount(0);await expect(page.getByAltText("Selected blood-unit label preview",{exact:true})).toHaveCount(0);expect(writes).toEqual([]);
});
