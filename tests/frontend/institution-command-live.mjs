// PA-ACCOUNT-01 / FR-09 / NFR-02: one real, separate synthetic request; never a DB fixture.
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile('build/accounts/private.json','utf8'));
const file='build/accounts/live-command.json',base='http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(20000);
 await page.goto(base+'/');await page.getByLabel('Institution email or username',{exact:true}).fill('bloodbank@medix.bloodledger');await page.getByLabel('Password',{exact:true}).fill(config.passwords.USR_ACCOUNT_SYNTH_MEDIX);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Requests & Transfers',exact:true}).click();await page.getByRole('heading',{name:'Request blood',exact:true}).waitFor();
 let saved;
 if(existsSync(file))saved=JSON.parse(await readFile(file,'utf8'));
 else {
   await page.getByLabel('Source blood bank').selectOption('INST_SYNTH_NLVILLA');
   const accepted=page.waitForResponse(r=>r.url().endsWith('/api/v2/transfers')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Submit V2 request',exact:true}).click();await page.getByRole('dialog',{name:'Verify operator',exact:true}).waitFor();
   const operator=await page.getByLabel('Operator',{exact:true}).inputValue();assert.ok(config.pins[operator]);await page.getByLabel('Operator PIN',{exact:true}).fill(config.pins[operator]);await page.getByRole('button',{name:'Verify and submit',exact:true}).click();
   const response=await accepted;assert.equal(response.status(),202);saved=await response.json();await writeFile(file,JSON.stringify(saved,null,2)+'\n',{mode:0o600,flag:'wx'});
 }
 for(let i=0;i<40;i++){
   const response=await context.request.get(base+saved.statusUrl);assert.equal(response.status(),200);const command=await response.json();
   if(command.status==='COMMITTED'){saved=command;break;}
   assert.ok(!['FAILED','CONFLICT'].includes(command.status),'Live command failed: '+command.safeErrorCode);
   await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.equal(saved.status,'COMMITTED');await writeFile('build/accounts/live-command-committed.json',JSON.stringify(saved,null,2)+'\n',{mode:0o600});
 const transfers=await (await context.request.get(base+'/api/v2/transfers')).json();const request=transfers.requests.find(r=>r.transfer_id===saved.resourceId);assert.ok(request);assert.equal(request.source_institution_id,'INST_SYNTH_NLVILLA');assert.equal(request.destination_institution_id,'INST_SYNTH_MEDIX');assert.equal(request.status,'PENDING');assert.ok(request.ledger_transaction_id);
 console.log('PASS: official Medix login, bound administrator PIN, one separate request from N.L. Villa, queue-to-Fabric COMMITTED and persisted PENDING request.');await context.close();
}finally{await browser.close();}
