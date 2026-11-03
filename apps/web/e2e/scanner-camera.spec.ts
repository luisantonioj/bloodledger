// FR-01 / NFR-11: device-local capture only; no live domain commands.
import {test,expect,type Page} from "@playwright/test";
import {readPage} from "./fixtures/transaction-reads";
import {PHONE,openBankScanner} from "./fixtures/phone-scanner";

test.use({...PHONE,launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]}});
async function setup(page:Page){
 const writes:string[]=[];
 await page.route("**/capture/ocr-assets/**",route=>route.abort());
 await page.route("**/api/**",route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()!=="GET")writes.push(path);
  if(path==="/api/v1/auth/session")return route.fulfill({json:{principal:{accountId:"ACC_CAMERA",accountCategory:"BLOOD_BANK",userId:"USR_CAMERA",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic bank",displayName:"Synthetic viewer",roleId:"ROLE-02",roleDisplayName:"Coordinator",permissions:["inventory:read","transfers:read"],operators:[{operatorId:"OP_CAMERA",roleId:"ROLE-02",capabilityProfile:"ROLE",actionCapabilities:["inventory:capture"]}],classification:"SIMULATION_ONLY"}}});
  if(path==="/api/v2/unit-history")return route.fulfill({json:readPage("UNIT_HISTORY_READ_V1",[])});
  if(path==="/api/v2/transfers")return route.fulfill({json:{scope:"INSTITUTION",requests:[],reservations:[],timeline:[],classification:"SIMULATION_ONLY"}});
  return route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
 });
 await page.addInitScript(()=>{
  const device=navigator.mediaDevices,get=device.getUserMedia.bind(device);
  (window as any).cameraStreams=[];
  device.getUserMedia=async constraints=>{const stream=await get(constraints);(window as any).cameraStreams.push(stream);return stream;};
 });
 return writes;
}
async function open(page:Page,direction:"Inbound"|"Outbound"){
 return openBankScanner(page,direction);
}
const stopped=(page:Page)=>page.evaluate(()=>(window as any).cameraStreams.length>0&&(window as any).cameraStreams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==="ended")));
for(const direction of ["Inbound","Outbound"] as const)test(`${direction} has separate camera and gallery actions, captures a local photo and releases the camera`,async({page})=>{
 const writes=await setup(page),dialog=await open(page,direction);
 await expect(dialog.getByRole("button",{name:"Take photo",exact:true})).toBeVisible();
 const take=await dialog.getByRole("button",{name:"Take photo",exact:true}).boundingBox(),choose=await dialog.getByRole("button",{name:"Choose image",exact:true}).boundingBox();expect(take).not.toBeNull();expect(choose).not.toBeNull();expect(take!.y).toBe(choose!.y);
 const pick=page.waitForEvent("filechooser");await dialog.getByRole("button",{name:"Choose image",exact:true}).click();
 const chooser=await pick;expect(await chooser.element().getAttribute("capture")).toBeNull();
 await dialog.getByRole("button",{name:"Take photo",exact:true}).click();
 await expect(dialog.getByRole("button",{name:"Capture photo",exact:true})).toBeEnabled();
 await expect(dialog.getByRole("button",{name:"Run OCR",exact:true})).toHaveCount(0);
 await page.screenshot({path:`/tmp/lat-camera-${direction.toLowerCase()}.png`});
 await dialog.getByRole("button",{name:"Capture photo",exact:true}).click();
 await expect(dialog.getByRole("img",{name:direction==="Inbound"?"Selected blood-unit label preview":"Selected outbound label preview"})).toBeVisible();
 await expect(dialog.getByRole("alert")).toContainText("OCR could not read this label");await expect.poll(()=>stopped(page)).toBe(true);
 await dialog.getByRole("button",{name:"Take photo",exact:true}).click();await expect(dialog.getByRole("button",{name:"Capture photo",exact:true})).toBeEnabled();
 await dialog.getByRole("button",{name:"Cancel camera",exact:true}).click();await expect.poll(()=>stopped(page)).toBe(true);
 await dialog.getByRole("button",{name:"Take photo",exact:true}).click();await expect(dialog.getByRole("button",{name:"Capture photo",exact:true})).toBeEnabled();
 await dialog.getByRole("button",{name:"Change direction",exact:true}).click();await expect.poll(()=>stopped(page)).toBe(true);
 expect(writes).toEqual([]);
});
test("camera denial offers gallery recovery without granting OCR confirmation",async({page})=>{
 const writes=await setup(page);await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException("Denied","NotAllowedError");};});
 const dialog=await open(page,"Inbound");await dialog.getByRole("button",{name:"Take photo",exact:true}).click();
 await expect(dialog.getByRole("alert")).toContainText("Camera access was blocked");
 await expect(dialog.getByRole("button",{name:"Capture photo",exact:true})).toBeDisabled();
 await dialog.getByRole("button",{name:"Cancel camera",exact:true}).click();await expect(dialog.getByRole("button",{name:"Choose image",exact:true})).toBeEnabled();
 await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();expect(writes).toEqual([]);
});
test("leaving capture while camera permission is pending stops the eventual stream",async({page})=>{
 const writes=await setup(page);await page.addInitScript(()=>{
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{await new Promise<void>(resolve=>{(window as any).releaseCamera=resolve;});return get(constraints);};
 });
 const dialog=await open(page,"Outbound");await dialog.getByRole("button",{name:"Take photo",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).releaseCamera)).toBe("function");
 await dialog.getByRole("button",{name:"Change direction",exact:true}).click();await page.evaluate(()=>(window as any).releaseCamera());
 await expect.poll(()=>stopped(page)).toBe(true);expect(writes).toEqual([]);
});
