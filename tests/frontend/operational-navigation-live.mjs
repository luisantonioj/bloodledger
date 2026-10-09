// FR-03/09/12, NFR-01: official-cookie retained API reads; no interception or mutations.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import policy from '../../services/api/policy/institution-accounts-v1.json' with {type:'json'};
const config=JSON.parse(await readFile(process.env.BLOODLEDGER_ACCOUNT_CONFIG??'build/accounts/private.json','utf8'));
const base=process.env.BLOODLEDGER_BROWSER_BASE_URL??'http://127.0.0.1:5174';
const report={classification:'SIMULATION_ONLY',base,interception:false,checks:[],accounts:[],liveLocalRelease:'NOT_RUN',liveConflictOrFailedCommand:'NOT_RUN'};
const browser=await chromium.launch();
let retained;
async function login(account){const context=await browser.newContext();const page=await context.newPage();await page.goto(base);await page.getByLabel('Institution email or username',{exact:true}).fill(account.username);await page.getByLabel('Password',{exact:true}).fill(config.passwords[account.accountId]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Dashboard',exact:true}).waitFor();assert.ok((await context.cookies()).some(c=>c.name==='bloodledger_session'&&c.httpOnly));return {context,page};}
try{
 for(const account of policy.accounts){
  const {context,page}=await login(account);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const session=await (await context.request.get(base+'/api/v1/auth/session')).json();assert.equal(session.principal.accountId,account.accountId);assert.equal(session.principal.institutionId,account.institutionId);
  if(account.institutionId==='INST_MEDIATRIX'){
   const data=await (await context.request.get(base+'/api/v2/components',{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).json();
   const workflows=await (await context.request.get(base+'/api/v2/transfers')).json();
   retained=data.components.find(c=>c.inventoryStatus==='RESERVED'&&workflows.reservations.some(r=>r.reservation_id===c.reservationId&&r.purpose==='TRANSFER'));assert.ok(retained);
   report.componentIds=data.components.map(c=>c.componentId).sort();report.operationalUnits=data.components.length;
   const snapshots=await (await context.request.get(base+'/api/v2/historical-snapshots')).json();const snapshot=snapshots.snapshots.find(s=>s.source_business_date.startsWith('2026-10-07'));assert.ok(snapshot);assert.equal(snapshot.verified_units,522);
   const historicalIds=new Set();let cursor=null;do{const response=await context.request.get(base+'/api/v2/historical-snapshots/'+snapshot.snapshot_id+'?limit=100'+(cursor?'&cursor='+cursor:''));assert.equal(response.status(),200);const detail=await response.json();for(const unit of detail.units){assert.equal(unit.validation_status,'VALID');historicalIds.add(unit.component_id);}cursor=detail.nextCursor;}while(cursor);assert.equal(historicalIds.size,522);report.historicalUnits=historicalIds.size;
   const businessDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const census=await (await context.request.get(base+'/api/v2/analytics/inventory-evidence?businessDate='+businessDate)).json();report.census={businessDate,status:census.status,unavailableReason:census.unavailableReason,snapshotPresent:!!census.snapshot,snapshotId:census.snapshot?.snapshotId,capturedAt:census.snapshot?.capturedAt,combinations:census.snapshot?.groups.reduce((n,g)=>n+g.bloodTypes.length,0),storedAvailable:census.snapshot?.groups.flatMap(g=>g.bloodTypes).reduce((n,r)=>n+r.availableCount,0)};

   await page.getByRole('link',{name:'Blood Inventory',exact:true}).click();await page.getByRole('button',{name:'Open component '+retained.componentId,exact:true}).click();
   let dialog=page.getByRole('dialog');await expect(dialog.getByText(retained.donationId,{exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Open linked reservation',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Reservation details',exact:true})).toBeVisible();
   const reservation=await (await context.request.get(base+'/api/v2/reservations/'+retained.reservationId)).json();assert.equal(reservation.purpose,'TRANSFER');report.reservationId=reservation.reservationId;report.transferId=reservation.transferId;
   await dialog.getByRole('button',{name:'Open linked transfer request',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Transfer request details',exact:true})).toBeVisible();await expect(dialog.getByText('PENDING',{exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Back to previous record',exact:true}).click();await dialog.getByRole('button',{name:'Open member '+retained.componentId,exact:true}).click();await expect(dialog.getByText(retained.donationId,{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Close record details',exact:true}).click();
   const available=data.components.find(c=>!c.reservationId);await page.getByRole('button',{name:'Open component '+available.componentId,exact:true}).click();await expect(page.getByRole('dialog').getByText('No linked reservation.',{exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close record details',exact:true}).click();
   await page.getByRole('link',{name:'Requests & Transfers',exact:true}).click();await page.getByRole('button',{name:'Open reservation '+retained.reservationId,exact:true}).click();await expect(page.getByRole('dialog').getByRole('button',{name:'Open linked transfer request',exact:true})).toBeVisible();
   for(const kind of ['component','reservation','request']){const id={component:'COMP_MISSING',reservation:'RES_MISSING',request:'TRF_MISSING'}[kind];await page.goto(base+'/inventory?record='+kind+'&recordId='+id);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Record unavailable');}
   report.checks.push('Component → TRANSFER reservation → PENDING request → back → member; null reservation; transfers entry; missing component/reservation/request');
   const local=workflows.reservations.find(r=>r.purpose==='LOCAL_RELEASE');if(local){const detail=await (await context.request.get(base+'/api/v2/reservations/'+local.reservation_id)).json();await page.goto(base+'/inventory?record=reservation&recordId='+local.reservation_id);await expect(page.getByRole('dialog').getByText(detail.localReleaseId,{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:'Open linked transfer request',exact:true})).toHaveCount(0);assert.ok(detail.components.length);await page.getByRole('dialog').getByRole('button',{name:'Open member '+detail.components[0].componentId,exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Component details',exact:true})).toBeVisible();report.liveLocalRelease='PASS';}

   await page.goto(base+'/analytics');await expect(page.getByLabel('Forecast version')).toHaveValue('SYNTHETIC_FORECAST_V4_RUNTIME_V1');report.defaultForecast='V4';
  }else if(account.category==='BLOOD_BANK'){
   assert.ok(retained);assert.equal((await context.request.get(base+'/api/v2/components/'+retained.componentId)).status(),404);
   await page.goto(base+'/inventory?record=component&recordId='+retained.componentId);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Record unavailable');assert.equal(await page.getByText(retained.donationId,{exact:true}).count(),0);report.checks.push(account.institutionId+' rejects foreign component');
  }else if(account.category==='DOH'){
   assert.equal((await context.request.get(base+'/api/v2/reservations/'+retained.reservationId)).status(),403);
   await page.goto(base+'/transfers?record=reservation&recordId='+retained.reservationId);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Access denied');report.checks.push('DOH role denied reservation detail');
  }
  await context.request.delete(base+'/api/v1/auth/session',{headers:{Origin:base}});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('link',{name:'Dashboard',exact:true}).count(),0);assert.deepEqual(errors,[]);report.accounts.push({accountId:account.accountId,login:'PASS',sessionClearing:'PASS'});await context.close();
 }
 report.result='PASS';
} catch(error){report.result='FAIL';report.error=error.message;throw error;}finally{await browser.close();await writeFile(process.env.BLOODLEDGER_NAVIGATION_REPORT??'build/lat-stock-navigation/browser-before.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});}
console.log('PASS: retained navigation, scope denial, missing/null records and six official-cookie logins/session clearing.');
