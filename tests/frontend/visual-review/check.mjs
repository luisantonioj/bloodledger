// FR-03/09/12/14, BL-TST-01: browsable fixture coverage, authorization and write isolation.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const base='http://127.0.0.1:5175';
const browser=await chromium.launch({headless:true});
let pages=0;
try {
  const context=await browser.newContext();
  await context.addCookies([{name:'bloodledger_review_mode',value:'role',url:base}]);
  const page=await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const role of ['ROLE-01','ROLE-02','ROLE-03','ROLE-04','ROLE-05','ROLE-06']) {
    await context.addCookies([{name:'bloodledger_review_role',value:role,url:base}]);
    await page.goto(base);
    await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
    await expect(page.getByText('UI REVIEW · SAMPLE DATA · NO BACKEND CONNECTION')).toBeVisible();
    const links=await page.locator('nav a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
    if(role==='ROLE-01')assert(!links.includes('/audit')&&!links.includes('/reporting'));
    for(const path of links) {
      console.log(role,path);
      await page.goto(base+path);
      await expect(page.locator('.page-title')).toBeVisible();
      if(path==='/inventory')await expect(page.locator('.inventory-table tbody tr')).toHaveCount(8);
      if(path==='/transfers')await expect(page.locator('tbody tr').first()).toBeVisible();
      if(path==='/analytics') {
        await expect(page.locator('tbody tr').first()).toBeVisible();
        await page.getByLabel('Forecast version').selectOption('SYNTHETIC_FORECAST_V5_RUNTIME_V1');
        await expect(page.locator('tbody tr').first()).toBeVisible();
        await expect(page.getByText('FORECAST_RESPONSE_INVALID',{exact:false})).toHaveCount(0);
      }
      await expect(page.getByText('Unable to load data',{exact:true})).toHaveCount(0);
      await expect(page.getByText('V2 component inventory unavailable',{exact:true})).toHaveCount(0);
      pages++;
    }
    if(role==='ROLE-04')assert.equal((await context.request.get(base+'/api/v1/demand-forecasts')).status(),403);
  }
  const write=await context.request.post(base+'/api/v2/inbound-captures',{data:{}});
  assert.equal(write.status(),405);
  assert.equal((await write.json()).error.code,'VISUAL_REVIEW_READ_ONLY');
  await page.goto(base);
  await page.getByLabel('Review role',{exact:true}).selectOption('ROLE-01');
  await expect(page.locator('.facility-context')).toContainText('MEDIATRIX');
  await page.getByLabel('Data state',{exact:true}).selectOption('empty');
  await page.goto(base+'/inventory');
  await expect(page.getByText('No committed V2 components',{exact:true})).toBeVisible();
  await page.getByLabel('Data state',{exact:true}).selectOption('unavailable');
  await expect(page.getByText('Unable to load data',{exact:true})).toBeVisible();
  await page.getByLabel('Data state',{exact:true}).selectOption('populated');
  await expect(page.locator('.inventory-overview-chart,.inventory-chart,.stats').first()).toBeVisible();
  await page.getByLabel('Review navigation',{exact:true}).selectOption('all');
  await expect(page.locator('nav a')).toHaveCount(10);
  const allLinks=await page.locator('nav a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
  for(const path of allLinks){
    await page.goto(base+path);
    await expect(page.locator('nav a')).toHaveCount(10);
    await expect(page.locator('.page-title')).toBeVisible();
    await expect(page.getByText('Unable to load data',{exact:true})).toHaveCount(0);
    if(['/audit','/reporting','/inventory','/transfers','/analytics'].includes(path))await expect(page.locator('tbody tr').first()).toBeVisible();
    pages++;
  }
  await page.goto(base+'/reporting');
  await page.reload();
  await expect(page.locator('nav a')).toHaveCount(10);
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.getByLabel('Review navigation',{exact:true}).selectOption('role');
  await expect(page.locator('nav a')).toHaveCount(6);
  await page.getByLabel('Review navigation',{exact:true}).selectOption('all');
  await expect(page.locator('nav a')).toHaveCount(10);
  const geometry=await page.evaluate(()=>({bar:document.getElementById('visual-review').getBoundingClientRect().bottom,side:document.querySelector('.side').getBoundingClientRect().top}));
  assert(geometry.side>=geometry.bar-1,'Toolbar must not cover sidebar');
  await expect(page.getByLabel('Review page',{exact:true}).locator('option')).toHaveCount(10);
  await page.getByLabel('Review page',{exact:true}).selectOption('/inventory');
  await expect(page.getByRole('heading',{name:'Blood Inventory',exact:true})).toBeVisible();
  await page.getByLabel('Contract view').selectOption('V2.1');
  await expect(page.locator('.inventory-table')).toContainText(/CRYOPRECIPITATE/i);
  await page.getByRole('button',{name:'Historical synthetic stock',exact:true}).click();
  await expect(page.getByText('Source: SYNTHETIC_VISUAL_SOURCE',{exact:false})).toBeVisible();
  await expect(page.locator('table').nth(0).locator('tbody tr')).toHaveCount(20);
  await expect(page.locator('table').nth(1).locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button',{name:'Next 50 components',exact:true}).click();
  await expect(page.locator('table').nth(1)).toContainText('HIST_SYNTH_VISUAL_50');
  await page.getByLabel('Review page',{exact:true}).selectOption('/');
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(page.locator('.dashboard-stats article')).toHaveCount(3);
  const chartLabelsFit=await page.locator('.inventory-overview-scroll').evaluate(scroll=>[...scroll.querySelectorAll('.inventory-overview-track>strong')].every(label=>label.getBoundingClientRect().top>=scroll.getBoundingClientRect().top));
  assert(chartLabelsFit,'Tallest chart values must remain visible inside the scroll viewport');
  await expect(page.getByRole('button',{name:'Open design preview controls',exact:true})).toHaveCount(0);
  await page.screenshot({path:'/tmp/bloodledger-visual-review-dashboard.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(JSON.stringify({classification:'SIMULATION_ONLY',reviewPages:pages,allPages:'PASS: 10 web tabs with canonical synthetic page roles',roleNavigation:'PASS',readOnly:'PASS',emptyAndUnavailable:'PASS',pageErrors:0}));
}finally{await browser.close();}
