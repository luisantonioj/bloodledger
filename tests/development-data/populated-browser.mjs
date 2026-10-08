// TP-STOCK-01 / FR-01–05, FR-09, FR-12–14: read-only Jopia browser self-validation.
// Real ordinary cookies on 5174 -> 3000; no interception, profile saves or actor grants.
import { chromium } from '@playwright/test';
import { readFile, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EXECUTION_SCHEMA, SCENARIO_SHA256, unseal } from '../../scripts/development-data/stock-plan.mjs';
const root = process.cwd();
async function privateJson(path) {
  assert.ok(path, 'Private input path is required');
  assert.equal((await stat(path)).mode & 0o077, 0, 'Private input permissions are required');
  return JSON.parse(await readFile(path, 'utf8'));
}
const config = await privateJson(process.env.BLOODLEDGER_BROWSER_CONFIG_PATH);
const manifest = await privateJson(process.env.BLOODLEDGER_STOCK_EXECUTION_PATH);
unseal(manifest, process.env.BLOODLEDGER_STOCK_EXECUTION_SHA256);
assert.equal(manifest.schemaVersion, EXECUTION_SCHEMA);
assert.equal(manifest.scenarioSha256, SCENARIO_SHA256);
assert.equal(manifest.labels.length, 522);
assert.equal(manifest.reservations.length, 24);
assert.ok(process.env.BLOODLEDGER_BROWSER_REPORT_PATH, 'Private report path is required');
const policy = JSON.parse(await readFile(root + '/services/api/policy/institution-accounts-v1.json', 'utf8'));
const base='http://127.0.0.1:5174';const browser=await chromium.launch({headless:true});
const report={classification:'SIMULATION_ONLY',hostValidation:'JOPIA_SELF_VALIDATION',interception:false,profileWrites:false,executionSha256:manifest.manifestSha256,accounts:[],independentLatAcceptance:'NOT_RUN',navigation:'LAT_IMPLEMENTATION_AND_INDEPENDENT_VERIFICATION_REQUIRED'};
try{
 for(const account of policy.accounts){
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.getByLabel('Institution email or username',{exact:true}).fill(account.username);await page.getByLabel('Password',{exact:true}).fill(config.passwords[account.accountId]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Dashboard',exact:true}).waitFor();
  assert.ok((await context.cookies()).some(c=>c.name==='bloodledger_session'&&c.httpOnly));
  const json=async path=>{const response=await context.request.get(base+path,{headers:{'X-BloodLedger-Contract-Version':'V2.1'}});assert.equal(response.status(),200,path);return response.json();};
  const session=await json('/api/v1/auth/session');assert.equal(session.principal.accountId,account.accountId);assert.equal(session.principal.institutionId,account.institutionId);
  let operationalCount;
  if(account.category==='BLOOD_BANK'){
   const components=(await json('/api/v2/components')).components;operationalCount=components.length;assert.equal(operationalCount,account.institutionId==='INST_MEDIATRIX'?531:0);assert.ok(components.every(c=>c.institutionId===account.institutionId));
   await page.getByRole('link',{name:'Blood Inventory',exact:true}).click();assert.equal(await page.getByLabel('Contract view').inputValue(),'V2.1');
   if(account.institutionId==='INST_MEDIATRIX'){
    await page.locator('.inventory-table tbody tr').nth(530).waitFor();assert.equal(await page.locator('.inventory-table tbody tr').count(),531);
    const states=components.reduce((a,c)=>(a[c.inventoryStatus]=(a[c.inventoryStatus]??0)+1,a),{});assert.deepEqual(states,{AVAILABLE:492,RESERVED:37,IN_TRANSIT:1,EXPIRED:1});
    const added=components.filter(c=>manifest.labels.some(l=>l.componentId===c.componentId));assert.equal(added.length,522);assert.equal(new Set(added.map(c=>c.donationId)).size,522);assert.equal(added.filter(c=>c.inventoryStatus==='RESERVED').length,36);
    const transfers=await json('/api/v2/transfers');let memberCount=0;
    for(const expected of manifest.reservations){
     const detail=await json('/api/v2/reservations/'+expected.reservationId);assert.equal(detail.status,'ACTIVE');assert.equal(detail.purpose,expected.purpose);assert.equal(detail.version,1);assert.deepEqual(detail.components.map(c=>c.componentId).sort(),[...expected.selectedComponentIds].sort());memberCount+=detail.components.length;
     if(expected.purpose==='TRANSFER'){assert.equal(detail.transferId,expected.workflowId);assert.ok(transfers.requests.some(t=>t.transfer_id===expected.workflowId&&t.destination_institution_id==='INST_SYNTH_MEDIX'&&t.status==='PENDING'));}
     else assert.equal(detail.localReleaseId,expected.workflowId);
     for(const member of detail.components){const c=components.find(c=>c.componentId===member.componentId);assert.equal(c.reservationId,detail.reservationId);assert.equal(c.reservationVersion,1);assert.equal(c.inventoryVersion,2);assert.deepEqual(await json('/api/v2/components/'+c.componentId),c);}
    }
    assert.equal(memberCount,36);
    await page.getByRole('button',{name:'Historical synthetic stock',exact:true}).click();await page.getByRole('button',{name:'Next 50 components',exact:true}).waitFor();assert.equal(await page.locator('table').nth(0).locator('tbody tr').count(),20);
    const snapshots=(await json('/api/v2/historical-snapshots')).snapshots;const historical=snapshots.find(s=>s.verified_units===522&&s.source_business_date.startsWith('2026-10-07'));assert.ok(historical);
    const historicalIds=new Set();let cursor=null;do{const detail=await json('/api/v2/historical-snapshots/'+historical.snapshot_id+'?limit=100'+(cursor?'&cursor='+cursor:''));for(const unit of detail.units){assert.equal(unit.validation_status,'VALID');assert.equal(unit.collected_at,null);assert.equal(unit.expires_at,null);assert.equal(unit.original_reservation_purpose,null);historicalIds.add(unit.component_id);}cursor=detail.nextCursor;}while(cursor);assert.equal(historicalIds.size,522);report.historicalNullFields='PRESERVED';
    report.states=states;report.reservationCount=manifest.reservations.length;report.reservationMembers=memberCount;report.historicalUnits=522;report.workflowApiLinks='PASS';
    await page.getByRole('link',{name:'Analytics',exact:true}).click();assert.equal(await page.getByLabel('Forecast version').inputValue(),'SYNTHETIC_FORECAST_V4_RUNTIME_V1');await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');await page.getByText('Forecast unavailable',{exact:true}).waitFor();report.v4Default='PASS';report.v5='UNAVAILABLE_SEPARATE_APPROVAL_REQUIRED';const alerts=await json('/api/v2/alerts');assert.equal(alerts.nearExpiryEligibility,'DISABLED_UNAPPROVED_POLICY');report.nearExpiryEligibility=alerts.nearExpiryEligibility;
   }else{
    await page.getByText('No committed V2 components',{exact:true}).waitFor();assert.equal((await context.request.get(base+'/api/v2/components/'+manifest.labels[0].componentId,{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).status(),404);
    assert.equal((await context.request.get(base+'/api/v2/historical-snapshots')).status(),403);
    const transfers=await json('/api/v2/transfers');assert.equal(transfers.requests.filter(t=>manifest.reservations.some(r=>r.purpose==='TRANSFER'&&r.workflowId===t.transfer_id)).length,account.institutionId==='INST_SYNTH_MEDIX'?13:0);
    for(const r of manifest.reservations){const response=await context.request.get(base+'/api/v2/reservations/'+r.reservationId,{headers:{'X-BloodLedger-Contract-Version':'V2.1'}});if(account.institutionId==='INST_SYNTH_MEDIX'&&r.purpose==='TRANSFER'){assert.equal(response.status(),200);const detail=await response.json();assert.equal(detail.transferId,r.workflowId);assert.equal(detail.destinationInstitutionId,account.institutionId);assert.equal(detail.status,'ACTIVE');}else assert.equal(response.status(),404);}
    if(account.institutionId==='INST_SYNTH_MEDIX')report.destinationReservationLinks='PASS';else report.unrelatedInstitutionIsolation='PASS';report.unrelatedLocalReleaseIsolation='PASS';
   }
  }else if(account.category==='REQUESTOR'){assert.equal((await json('/api/v2/components')).components.length,0);assert.equal((await context.request.get(base+'/api/v2/components/'+manifest.labels[0].componentId,{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).status(),404);for(const r of manifest.reservations)assert.equal((await context.request.get(base+'/api/v2/reservations/'+r.reservationId,{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).status(),404);}else if(['PRC','DOH'].includes(account.category))assert.equal((await context.request.get(base+'/api/v2/components',{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).status(),403);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor({timeout:15000});assert.equal(await page.getByRole('link',{name:'Dashboard',exact:true}).count(),0);assert.equal((await context.request.get(base+'/api/v1/auth/session')).status(),401);assert.deepEqual(errors,[]);
  report.accounts.push({institutionId:account.institutionId,login:'PASS',operationalCount,scope:'PASS',logout:'PASS'});await context.close();
 }
 report.completedAt=new Date().toISOString();report.result='PASS';
}catch(error){report.result='FAIL';report.failure='BROWSER_ASSERTION_OR_FLOW_FAILED';throw error;}finally{await browser.close();await writeFile(process.env.BLOODLEDGER_BROWSER_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});}
console.log(JSON.stringify(report));
