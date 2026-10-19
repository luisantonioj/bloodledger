import {test,expect} from "@playwright/test";
import {fixture,scan} from "./fixtures/scanner-intake";
async function pin(page:import("@playwright/test").Page){await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();}

test("corrected Donation No. retains OCR evidence, requires double entry and freezes an exact retry",async({page,context})=>{
 test.setTimeout(150000);const state=await fixture(page,context),dialog=await scan(page,"Inbound");
 await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-01-0002");
 const check=dialog.getByLabel("I checked all five fields against the label.");await expect(check).toBeDisabled();
 await expect(dialog.getByText(/Original OCR: MM26-01-0001/)).toBeVisible();
 await dialog.getByLabel("Confirm corrected Donation No.",{exact:true}).fill("MM26-01-9999");await expect(check).toBeDisabled();
 await dialog.getByLabel("Confirm corrected Donation No.",{exact:true}).fill("MM26-01-0002");await check.check();
 // Any edit clears confirmation and the repeated identifier before a submit is permitted.
 await dialog.getByLabel("Review blood type",{exact:true}).selectOption("B_POSITIVE");await expect(check).not.toBeChecked();await expect(check).toBeDisabled();
 await dialog.getByLabel("Confirm corrected Donation No.",{exact:true}).fill("MM26-01-0002");await check.check();
 await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await pin(page);
 await expect(dialog.getByRole("button",{name:"Retry same intake",exact:true})).toBeEnabled();
 await expect(dialog.getByLabel("Confirm corrected Donation No.",{exact:true})).toBeDisabled();
 await dialog.getByRole("button",{name:"Retry same intake",exact:true}).click();await pin(page);
 await expect(dialog.locator(".v2-command-card")).toContainText("COMMITTED",{ignoreCase:true,timeout:10000});
 const attempts=state.writes.filter(row=>row.path==="/api/v2/inbound-captures");expect(attempts).toHaveLength(2);expect(attempts[0]).toEqual(attempts[1]);const body=attempts[0].body;
 expect(body.capturePolicyVersion).toBe("INBOUND_OCR_CORRECTED_V1");expect(body.donationNumber).toBe("MM26-01-0002");expect(body.donationNumberConfirmation).toBe(body.donationNumber);
 expect(body.fields.donationNumber).toMatchObject({ocrValue:"MM26-01-0001",corrected:true,reason:"OCR_MISREAD"});expect(body.fields.donationNumber.ocrConfidence).toBeGreaterThanOrEqual(90);
 expect(body.fields.bloodType).toMatchObject({ocrValue:"A_POSITIVE",corrected:true,reason:"OCR_MISREAD"});expect(body.fields.componentType.corrected).toBe(false);
 expect(body.ocrEvidence).toEqual({engine:"TESSERACT_JS",engineVersion:"7.0.0"});expect(body.bloodTypeEvidence).toBeUndefined();expect(state.writes.filter(row=>row.path.includes("operator-verifications"))).toHaveLength(2);
});

test("a disabled host gives a clear error after PIN and never silently switches a correction to V1",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context,"disabled"),dialog=await scan(page,"Inbound");
 await dialog.getByLabel("Review blood type",{exact:true}).selectOption("B_POSITIVE");await expect(dialog.getByLabel("Confirm corrected Donation No.",{exact:true})).toHaveCount(0);
 await dialog.getByLabel("I checked all five fields against the label.").check();await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await pin(page);
 await expect(dialog.getByRole("alert")).toHaveText("Corrected OCR intake is not enabled on this host. No intake was accepted.");
 const attempts=state.writes.filter(row=>row.path==="/api/v2/inbound-captures");expect(attempts).toHaveLength(1);expect(attempts[0].body.capturePolicyVersion).toBe("INBOUND_OCR_CORRECTED_V1");expect(attempts[0].body.donationNumberConfirmation).toBeUndefined();await expect(dialog.getByLabel("I checked all five fields against the label.")).not.toBeChecked();
});

test("enabled correction UI still submits unchanged OCR through V1",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context),dialog=await scan(page,"Inbound");
 await dialog.getByLabel("I checked all five fields against the label.").check();await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await pin(page);
 await expect(dialog.getByRole("button",{name:"Retry same intake",exact:true})).toBeEnabled();
 const body=state.writes.find(row=>row.path==="/api/v2/inbound-captures")!.body;expect(body.capturePolicyVersion).toBe("INBOUND_OCR_V1");expect(body.fields).toBeUndefined();expect(body.donationNumberConfirmation).toBeUndefined();expect(body.bloodTypeEvidence.source).toBe("OCR_LABEL");
});

test("fully unread OCR cannot be converted into a verified capture by filling every field manually",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context);await page.goto("/transactions");await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:"Inbound",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Mobile blood unit scanner",exact:true});
 const image=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=1200;c.height=400;const x=c.getContext("2d")!;x.fillStyle="white";x.fillRect(0,0,1200,400);x.fillStyle="black";x.font="bold 48px monospace";x.fillText("FICTIONAL UNSUPPORTED LABEL",40,100);return c.toDataURL("image/png");});
 await dialog.getByLabel("Blood-unit label image",{exact:true}).setInputFiles({name:"unread-synthetic.png",mimeType:"image/png",buffer:Buffer.from(image.split(",")[1],"base64")});
 await expect(dialog.getByText("No readable OCR fields · Scan again",{exact:true})).toBeVisible({timeout:90000});
 await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-10-9208");await dialog.getByLabel("Review blood type",{exact:true}).selectOption("A_POSITIVE");await dialog.getByLabel("Review component",{exact:true}).selectOption("WHOLE_BLOOD");await dialog.getByLabel("Collection time (UTC)",{exact:true}).fill("2026-10-17T00:00:00.000Z");await dialog.getByLabel("Expiration time (UTC)",{exact:true}).fill("2026-11-17T00:00:00.000Z");
 await expect(dialog.getByLabel("I checked all five fields against the label.")).toBeDisabled();await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();await expect(dialog.getByText("Retake a close-up photo: at least one field must remain an unchanged OCR read with an engine score of 90 or above.",{exact:true})).toBeVisible();expect(state.writes).toHaveLength(0);
});
