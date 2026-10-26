import {test,expect} from "@playwright/test";
import {fixture,scan,V1_LABEL} from "./fixtures/scanner-intake";
test("bank verified intake binds operator, freezes ambiguous body and polls queued command",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context);const dialog=await scan(page,"Inbound");await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();await dialog.getByLabel("I checked all five fields against the label.").check();await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await page.getByRole("button",{name:"Cancel verification",exact:true}).click();await expect(dialog.getByText("Operator verification cancelled. No intake was sent.",{exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Close mobile scanner",exact:true})).toBeEnabled();await dialog.getByLabel("I checked all five fields against the label.").check();await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();await expect(dialog.getByRole("button",{name:"Retry same intake",exact:true})).toBeEnabled();await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toBeDisabled();await expect(dialog.getByRole("button",{name:"Close mobile scanner",exact:true})).toBeDisabled();
 await dialog.getByRole("button",{name:"Retry same intake",exact:true}).click();await expect(page.getByLabel("Operator",{exact:true})).toBeDisabled();await expect(page.getByLabel("Operator",{exact:true})).toHaveValue("OP_SCANNER");await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();await expect(dialog.locator(".v2-command-card")).toContainText("QUEUED",{ignoreCase:true});await expect(dialog.getByRole("button",{name:"Close mobile scanner",exact:true})).toBeDisabled();await expect(dialog.locator(".v2-command-card")).toContainText("COMMITTED",{ignoreCase:true,timeout:10000});
 const attempts=state.writes.filter(row=>row.path==="/api/v2/inbound-captures");expect(attempts).toHaveLength(2);expect(attempts[0]).toEqual(attempts[1]);expect(attempts[0].body.bloodTypeEvidence.source).toBe("OCR_LABEL");expect(attempts[0].body.componentEvidence.source).toBe("OCR_LABEL");expect(attempts[0].body.ocrEvidence.fieldConfidence.donationNumber).toBeGreaterThanOrEqual(90);expect(state.writes.filter(row=>row.path.includes("operator-verifications"))).toHaveLength(2);
 await expect(dialog.getByRole("button",{name:"Dismiss status",exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();await dialog.getByRole("button",{name:"Close mobile scanner",exact:true}).click();await expect(dialog).toHaveCount(0);
});
test("PA-OCR-02 readable printed label is read, mapped to exact values and submittable",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context);const dialog=await scan(page,"Inbound",["DONATION NO: MM26-01-0001","BLOOD TYPE: A POSITIVE","COMPONENT: WHOLE BLOOD","COLLECTED AT: 2026-09-17","EXPIRES AT: 2026-10-17"],"48px monospace");
 await expect(dialog.getByLabel("Review blood type",{exact:true})).toHaveValue("A_POSITIVE");await expect(dialog.getByLabel("Review component",{exact:true})).toHaveValue("WHOLE_BLOOD");
 await expect(dialog.getByLabel("Collection time (UTC)",{exact:true})).toHaveValue("2026-09-17T00:00:00.000Z");await expect(dialog.getByLabel("Expiration time (UTC)",{exact:true})).toHaveValue("2026-10-17T00:00:00.000Z");
 await dialog.getByLabel("I checked all five fields against the label.").check();await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeEnabled();expect(state.writes).toHaveLength(0);
});
test("editing recognized intake blocks submission; outbound offers scoped transfer dispatch rather than stock removal",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context);let dialog=await scan(page,"Inbound");await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-01-0002");await expect(dialog.getByText("Edited or incomplete OCR draft · Not verified",{exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();await dialog.getByRole("button",{name:"Change direction",exact:true}).click();await dialog.getByRole("button",{name:"Outbound",exact:true}).click();await expect(dialog.getByRole("button",{name:"Run OCR",exact:true})).toHaveCount(0);await dialog.getByRole("button",{name:"Change direction",exact:true}).click();await dialog.getByRole("button",{name:"Close mobile scanner",exact:true}).click();
 dialog=await scan(page,"Outbound");await expect(dialog.getByLabel("Approved outgoing transfer",{exact:true}).locator("option")).toHaveCount(2);await dialog.getByLabel("Approved outgoing transfer",{exact:true}).selectOption("RES_SCANNER");await expect(dialog.getByRole("button",{name:"Dispatch reservation",exact:true})).toBeVisible();await expect(dialog.getByRole("button",{name:"Confirm outbound transaction",exact:true})).toHaveCount(0);expect(state.writes).toHaveLength(0);
});

for(const recovery of ["found","empty","wrongIdentity","oldReplay","cancelRetry"] as const){
 test(`lost intake recovery ${recovery} preserves frozen identity without resubmitting`,async({page,context})=>{
  test.setTimeout(120000);const state=await fixture(page,context,recovery),dialog=await scan(page,"Inbound");
  await dialog.getByLabel("I checked all five fields against the label.").check();await dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true}).click();await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Look up saved intake",exact:true})).toBeEnabled();
  if(recovery==="oldReplay"||recovery==="cancelRetry"){
   await dialog.getByRole("button",{name:"Retry same intake",exact:true}).click();await expect(page.getByLabel("Operator",{exact:true})).toBeDisabled();if(recovery==="cancelRetry"){await page.getByRole("button",{name:"Cancel verification",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("original attempt stays frozen");}else{await page.getByLabel("Operator PIN",{exact:true}).fill("12345678");await page.getByRole("button",{name:"Verify and submit",exact:true}).click();}await expect(dialog.getByRole("button",{name:"Look up saved intake",exact:true})).toBeEnabled();await expect(dialog.getByText("Already registered by another request. No duplicate unit was created.",{exact:true})).toHaveCount(0);
  }
  const postsBefore=state.writes.length;await dialog.getByRole("button",{name:"Look up saved intake",exact:true}).click();
  if(recovery==="found"||recovery==="oldReplay"||recovery==="cancelRetry"){await expect(dialog.locator(".v2-command-card")).toContainText("COMMITTED",{ignoreCase:true});await expect(dialog.getByRole("button",{name:"Look up saved intake",exact:true})).toHaveCount(0);}
  else {await expect(dialog.getByRole("alert")).toContainText("attempt stays frozen");await expect(dialog.getByRole("button",{name:"Retry same intake",exact:true})).toBeEnabled();await expect(dialog.getByRole("button",{name:"Close mobile scanner",exact:true})).toBeDisabled();await expect(dialog.locator(".v2-command-card")).toHaveCount(0);}
  expect(state.writes).toHaveLength(postsBefore);expect(state.apiReads.filter(path=>path==="/api/v2/commands")).toHaveLength(1);
 });
}

test("camera photo automatically recognizes a printed label and allows only unchanged reviewed intake",async({page,context})=>{
 test.setTimeout(120000);const state=await fixture(page,context);
 // A fictional printed form streamed through the same video -> JPEG -> OCR path as a camera.
 await page.addInitScript(lines=>{
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=600;
   const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1600,600);ctx.fillStyle="black";ctx.font="bold 48px monospace";lines.forEach((line,index)=>ctx.fillText(line,70,90+index*90));
   const stream=canvas.captureStream(10),track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
   const timer=setInterval(()=>{if(track.readyState==="ended")clearInterval(timer);else track.requestFrame();},100);
   return stream;
  };
 },V1_LABEL);
 await page.goto("/transactions");await page.getByRole("button",{name:"Open Mobile Scanner",exact:true}).click();await page.getByRole("button",{name:"Inbound",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Mobile blood unit scanner",exact:true});
 await dialog.getByRole("button",{name:"Take photo",exact:true}).click();await dialog.getByRole("button",{name:"Capture photo",exact:true}).click();
 await expect(dialog.getByText("OCR label read · Review every field",{exact:true})).toBeVisible({timeout:90000});
 await expect(dialog.getByLabel("Donation No. / Unit ID",{exact:true})).toHaveValue("MM26-01-0001");
 await dialog.getByLabel("I checked all five fields against the label.").check();
 await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeEnabled();
 await dialog.getByLabel("I checked all five fields against the label.").scrollIntoViewIfNeeded();
 await dialog.screenshot({path:"/tmp/lat-inbound-checkbox.png"});
 await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-01-0002");
 await expect(dialog.getByLabel("I checked all five fields against the label.")).toBeVisible();
 await expect(dialog.getByLabel("I checked all five fields against the label.")).toBeDisabled();
 await expect(dialog.getByLabel("I checked all five fields against the label.")).not.toBeChecked();
 await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeDisabled();
 await expect(dialog.getByText("Edited or incomplete OCR draft · Not verified",{exact:true})).toBeVisible();
 await dialog.getByLabel("Donation No. / Unit ID",{exact:true}).fill("MM26-01-0001");
 await dialog.getByLabel("I checked all five fields against the label.").check();
 await expect(dialog.getByRole("button",{name:"Confirm inbound transaction",exact:true})).toBeEnabled();expect(state.writes).toEqual([]);
});
