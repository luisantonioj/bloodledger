// PA-ACCOUNT-01 / NFR-01: real cookie login and account-isolated browser receipt storage.
// The four local receipts below test offline visibility only; they are not backend/Fabric evidence.
import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile(process.env.BLOODLEDGER_ACCOUNT_CONFIG??'build/accounts/private.json','utf8'));
const base=process.env.BLOODLEDGER_BROWSER_BASE_URL??'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
 async function login(username,account){await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(config.passwords[account]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Capture printed label',exact:false}).waitFor();}
 await page.goto(base+'/capture/');await login('bloodbank@mmc.bloodledger','USR_ACCOUNT_MEDIATRIX');
 await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bloodledger-inbound-command-status-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('command-receipts',{keyPath:'commandId'});r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   const tx=db.transaction('command-receipts','readwrite');
   const receipt={status:'COMMITTED',acceptedAt:new Date().toISOString(),statusUrl:'/api/v2/commands/CMD_LOCAL_VISIBILITY',bloodType:'A_POSITIVE',componentType:'PLATELETS',classification:'SIMULATION_ONLY'};
   for(const row of [{commandId:'CMD_LOCAL_OWN',resourceId:'LOCAL_OWN_RECEIPT',accountId:'USR_ACCOUNT_MEDIATRIX',institutionId:'INST_MEDIATRIX'},{commandId:'CMD_LOCAL_FOREIGN',resourceId:'LOCAL_FOREIGN_RECEIPT',accountId:'USR_ACCOUNT_SYNTH_MEDIX',institutionId:'INST_SYNTH_MEDIX'},{commandId:'CMD_LOCAL_LEGACY',resourceId:'LOCAL_QUARANTINED_RECEIPT'},{commandId:'CMD_LOCAL_WRONG_INSTITUTION',resourceId:'LOCAL_WRONG_INSTITUTION_RECEIPT',accountId:'USR_ACCOUNT_MEDIATRIX',institutionId:'INST_SYNTH_MEDIX'}])tx.objectStore('command-receipts').put({...receipt,...row});
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject;});db.close();
 });
 await page.reload();await page.getByText('LOCAL_OWN_RECEIPT',{exact:true}).waitFor();
 assert.equal(await page.getByText('LOCAL_FOREIGN_RECEIPT',{exact:true}).count(),0);assert.equal(await page.getByText('LOCAL_QUARANTINED_RECEIPT',{exact:true}).count(),0);assert.equal(await page.getByText('LOCAL_WRONG_INSTITUTION_RECEIPT',{exact:true}).count(),0);
 await page.getByRole('button',{name:/^Sign out /}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.getByText('LOCAL_OWN_RECEIPT',{exact:true}).count(),0);
 await login('bloodbank@medix.bloodledger','USR_ACCOUNT_SYNTH_MEDIX');await page.getByText('LOCAL_FOREIGN_RECEIPT',{exact:true}).waitFor();assert.equal(await page.getByText('LOCAL_OWN_RECEIPT',{exact:true}).count(),0);assert.equal(await page.getByText('LOCAL_QUARANTINED_RECEIPT',{exact:true}).count(),0);
 await context.close();
 console.log('PASS: Capture through live 5174 proxy, official cookies, owned receipt reload, cross-account isolation, legacy quarantine and logout clearing. Local test receipts are not ledger evidence.');
}finally{await browser.close();}
