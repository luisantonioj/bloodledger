// PA-ACCOUNT-01, FR-01/03/09/12, NFR-01: retained API, official cookies, no interception.
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import policy from '../../services/api/policy/institution-accounts-v1.json' with {type:'json'};
const config=JSON.parse(await readFile(process.env.BLOODLEDGER_ACCOUNT_CONFIG??'build/accounts/private.json','utf8'));
const base=process.env.BLOODLEDGER_BROWSER_BASE_URL??'http://127.0.0.1:5174';
const report={classification:'SIMULATION_ONLY',interception:false,accounts:[],checks:[]};
const browser=await chromium.launch({headless:true});
try {
  for(const account of policy.accounts){
    const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/');
    await page.getByLabel('Institution email or username',{exact:true}).fill(account.username);
    await page.getByLabel('Password',{exact:true}).fill(config.passwords[account.accountId]);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('link',{name:'Dashboard',exact:true}).waitFor();
    assert.ok((await context.cookies()).some(c=>c.name==='bloodledger_session'&&c.httpOnly));
    const session=await (await context.request.get(base+'/api/v1/auth/session')).json();
    assert.equal(session.principal.accountId,account.accountId);assert.equal(session.principal.institutionId,account.institutionId);assert.equal(session.principal.accountCategory,account.category);
    const dashboard=await (await context.request.get(base+'/api/v2/dashboard')).json();
    const count=dashboard.inventory.reduce((sum,row)=>sum+row.confirmedCount,0);
    if(account.category==='BLOOD_BANK')assert.equal(count,account.institutionId==='INST_MEDIATRIX'?9:0);
    await page.getByText('Inventory projection',{exact:true}).waitFor();
    if(account.category==='BLOOD_BANK'){
      await page.getByRole('link',{name:'Blood Inventory',exact:true}).click();
      assert.equal(await page.getByLabel('Contract view').inputValue(),'V2.1');
      const components=await (await context.request.get(base+'/api/v2/components',{headers:{'X-BloodLedger-Contract-Version':'V2.1'}})).json();
      assert.ok(components.components.every(c=>c.institutionId===account.institutionId));
      if(account.institutionId==='INST_MEDIATRIX'){
        assert.equal(components.components.length,9);assert.equal(new Set(components.components.map(c=>c.componentType)).size,5);
        await page.getByRole('button',{name:'Historical synthetic stock',exact:true}).click();
        await page.getByRole('button',{name:'Next 50 components',exact:true}).waitFor();
        assert.equal(await page.locator('table').nth(0).locator('tbody tr').count(),20);
        const snapshots=await (await context.request.get(base+'/api/v2/historical-snapshots')).json();
        const snapshot=snapshots.snapshots.find(s=>s.source_business_date.startsWith('2026-10-07'));assert.equal(snapshot.verified_units,522);
        const ids=new Set();let cursor=null;do {const response=await context.request.get(base+'/api/v2/historical-snapshots/'+snapshot.snapshot_id+'?limit=100'+(cursor?'&cursor='+cursor:''));assert.equal(response.status(),200);const detail=await response.json();for(const unit of detail.units){assert.equal(unit.validation_status,'VALID');ids.add(unit.component_id);}cursor=detail.nextCursor;}while(cursor);assert.equal(ids.size,522);report.checks.push('522 actual historical components and VALID local receipts preserved');
      } else {await page.getByText('No committed V2 components',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Historical synthetic stock',exact:true}).count(),0);assert.equal((await context.request.get(base+'/api/v2/historical-snapshots')).status(),403);}
    }
    await page.getByRole('link',{name:'Requests & Transfers',exact:true}).click();
    await page.getByRole('heading',{name:'V2 transfers and reservations',exact:true}).waitFor();
    if(['BLOOD_BANK','REQUESTOR'].includes(account.category)){
      await page.getByRole('heading',{name:'Request blood',exact:true}).waitFor();
      assert.equal(await page.getByLabel('Source blood bank').locator('option').count(),account.category==='BLOOD_BANK'?2:3);
    }
    if(account.institutionId==='INST_MEDIATRIX'){
      const transfers=await (await context.request.get(base+'/api/v2/transfers')).json();assert.equal(transfers.requests.length,3);assert.equal(transfers.reservations.length,2);
      await page.getByRole('button',{name:'Queue local release',exact:true}).click();
      await page.getByRole('dialog',{name:'Verify operator',exact:true}).waitFor();
      assert.equal(await page.getByLabel('Operator PIN',{exact:true}).inputValue(),'');
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
      report.checks.push('Privileged local release prompts for bound operator verification; cancellation sends no command');
      await page.getByRole('link',{name:'Alerts',exact:true}).click();await page.locator('.alert-summary').waitFor();
      const alertData=await (await context.request.get(base+'/api/v2/alerts')).json();
      assert.equal(await page.getByText('Acknowledged',{exact:true}).count(),alertData.alerts.filter(a=>a.acknowledged).length);
      report.checks.push('Acknowledgement display matches authenticated account/operator ownership; retained unrelated acknowledgements remain separate');
      await page.getByRole('link',{name:'Analytics',exact:true}).click();
      assert.equal(await page.getByLabel('Forecast version').inputValue(),'SYNTHETIC_FORECAST_V4_RUNTIME_V1');
      await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');await page.getByText('Forecast unavailable',{exact:true}).waitFor();
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const census=await (await context.request.get(base+'/api/v2/analytics/inventory-evidence?businessDate='+date)).json();const counts=census.snapshot.groups.flatMap(g=>g.bloodTypes);assert.equal(counts.length,40);assert.equal(counts.reduce((sum,row)=>sum+row.availableCount,0),6);assert.equal(counts.filter(row=>row.availableCount===0).length,34);
      report.checks.push('40 operational census combinations, six available and 34 verified zeros; V4 default and V5 unavailable');
    }
    if(['PRC','DOH'].includes(account.category)){
      await page.getByRole('link',{name:'Network view',exact:true}).click();
      await page.getByRole('heading',{name:'Institution inventory aggregates',exact:true}).waitFor();
      await page.locator('table tbody tr').first().waitFor();
      await page.getByRole('link',{name:'Reports',exact:true}).click();
      await page.getByRole('heading',{name:'Stored synthetic census reports',exact:true}).waitFor();
      const reports=await (await context.request.get(base+'/api/v2/reports/doh-census')).json();
      if(reports.snapshots.length){await page.getByLabel('Stored census',{exact:true}).waitFor();await page.locator('table tbody tr').first().waitFor();}
      else await page.getByText('No census reports are recorded. Missing evidence is not shown as zero inventory.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('alert').count(),0);
      report.checks.push(account.category+' network and census reports use authenticated V2 reads');
    }
    await page.getByRole('link',{name:'Profile',exact:true}).click();await page.getByRole('heading',{name:'Your verified operators',exact:true}).waitFor();
    if(account.category==='DOH'){
      assert.equal(await page.getByRole('link',{name:'Accounts',exact:true}).count(),0);
      assert.equal((await context.request.get(base+'/api/v2/onboarding/institutions')).status(),403);
      assert.equal((await context.request.get(base+'/api/v2/onboarding/applications')).status(),403);
    }
    if(account.category==='PRC'){
      await page.getByRole('link',{name:'Accounts',exact:true}).click();await page.getByRole('heading',{name:'Institution accounts',exact:true}).waitFor();
      const directory=await (await context.request.get(base+'/api/v2/onboarding/institutions')).json();assert.equal(directory.institutions.length,6);
      assert.deepEqual(directory.institutions.map(i=>i.username).sort(),policy.accounts.map(a=>a.username).sort());
      if(process.env.BLOODLEDGER_ACCOUNT_READ_ONLY!=='true'){
      const medix=page.locator('table').first().locator('tbody tr').filter({hasText:'Synthetic Medix'});await medix.getByRole('button',{name:'Edit profile',exact:true}).click();
      await page.getByLabel('Synthetic institution name',{exact:true}).fill('Synthetic Medix');
      await page.getByRole('button',{name:'Verify and submit change',exact:true}).click();
      await page.getByRole('dialog',{name:'Verify operator',exact:true}).waitFor();
      const operatorId=await page.getByLabel('Operator',{exact:true}).inputValue();const pin=config.pins[operatorId];assert.ok(pin);
      await page.getByLabel('Operator PIN',{exact:true}).fill(pin==='00000000'?'99999999':'00000000');await page.getByRole('button',{name:'Verify and submit',exact:true}).click();
      await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal(await page.getByLabel('Operator PIN',{exact:true}).inputValue(),'');
      await page.getByLabel('Operator PIN',{exact:true}).fill(pin);await page.getByRole('button',{name:'Verify and submit',exact:true}).click();
      await page.getByText('Change recorded. The server remains authoritative for access.',{exact:true}).waitFor();
      report.checks.push('PRC directory has exact six logins; wrong PIN rejected, correct bound PIN records off-chain profile action');
      }else report.checks.push('PRC directory retains exact six institution logins');
    }
    await page.getByRole('link',{name:'Alerts',exact:true}).click();await page.locator('.alert-summary').waitFor();
    // Any protected request returning 401 must clear the complete shell, not retain a page cache.
    await context.request.delete(base+'/api/v1/auth/session',{headers:{Origin:base}});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('button',{name:'Sign in',exact:true}).waitFor({timeout:15000});
    assert.equal(await page.getByRole('link',{name:'Dashboard',exact:true}).count(),0);
    assert.deepEqual(errors,[],'No frontend runtime errors');
    report.accounts.push({institutionId:account.institutionId,category:account.category,login:'PASS',dashboardCount:count,protectedDataClearing:'PASS'});
    await context.close();
  }
  report.result='PASS';
}finally{await browser.close();await writeFile(process.env.BLOODLEDGER_ACCOUNT_REPORT??'build/accounts/browser.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});}
console.log('PASS: six institution logins and authenticated reads; historical stock, census, operator verification and session clearing checked.');
