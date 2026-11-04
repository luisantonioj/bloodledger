import {mkdir} from "node:fs/promises";
import {readPage,unitFixture} from "./fixtures/transaction-reads";
import {test,expect} from "@playwright/test";
import {setupBankCompletion} from "./fixtures/blood-bank-completion";
import {exactStockFixture} from "./fixtures/panel-revisions";
const classification="SIMULATION_ONLY";
test("exact stock overrides old aggregates, separates pending units, and exports the displayed snapshot",async({page,context})=>{
 await setupBankCompletion(page);await context.grantPermissions(["clipboard-read","clipboard-write"]);await page.goto("/");
 const card=page.locator('.exact-stock-card');await expect(card.getByRole('listitem',{name:/A\+ Whole Blood: Available: 7;/}).locator('.inventory-overview-track > strong')).toHaveText('7');await expect(card).toContainText('3 changes pending ledger confirmation');await expect(card.locator('.segment-unknown')).toHaveCount(0);
 await card.getByRole('button',{name:/A\+ Whole Blood — demo band/}).first().focus();await expect(page.getByRole('tooltip')).toContainText('Available: 7');await expect(page.getByRole('tooltip')).toContainText('Reserved: 2');await expect(page.getByRole('tooltip')).toContainText('Label expired, pending evaluation: 4');
 if(process.env.LAT_PANEL_EVIDENCE){await page.keyboard.press('Escape');await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-15-dashboard-synthetic.png',fullPage:true});}
 await card.getByRole('button',{name:'Exact counts',exact:true}).click();const table=card.getByRole('table',{name:'Exact stock counts'});await expect(table.locator('tbody tr')).toHaveCount(40);await card.getByRole('button',{name:'Copy exact counts',exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied.split('\n')).toHaveLength(41);expect(copied).toContain('A+\tWhole Blood\t7\t2');expect(copied).not.toContain('99');
 const download=page.waitForEvent('download');await card.getByRole('button',{name:'Export exact counts PDF',exact:true}).click();expect((await download).suggestedFilename()).toBe('bloodledger-exact-stock.pdf');
 await page.getByLabel('Inventory overview blood component').selectOption('PLATELETS');await expect(table.locator('tbody tr')).toHaveCount(8);await card.getByRole('button',{name:/A\+ Platelets — demo band/}).focus();await expect(page.getByRole('tooltip')).toContainText('Available: 0');
});
test("foreign or incomplete exact counts fail closed without falling back to old totals",async({page})=>{
 await setupBankCompletion(page);await page.route('**/api/v2/dashboard/stock-counts',route=>route.fulfill({json:exactStockFixture('INST_FOREIGN',99)}));await page.goto('/');await expect(page.getByText('Exact stock counts unavailable. Refresh to try again.',{exact:true})).toBeVisible();await expect(page.locator('.exact-stock-card .inventory-overview-track')).toHaveCount(0);await expect(page.locator('.dashboard-stats article').first().locator('strong')).toHaveText('—');
});
test("partial approval reserves only the reviewed FEFO quantity and closes the shortfall",async({page})=>{
 const state=await setupBankCompletion(page),source='INST_SYNTH_BANK';let submitted:Record<string,unknown>|undefined;
 const request={transfer_id:'TRF_WAITING',source_institution_id:source,destination_institution_id:'INST_SYNTH_DEST',blood_type:'A_POSITIVE',component_type:'WHOLE_BLOOD',quantity:5,urgency:'ROUTINE',status:'PENDING',decision_state:'AWAITING_DECISION',reservation_id:null,reservation_status:null,ledger_transaction_id:'TX_REQUEST'};
 await page.route('**/api/v2/transfers',route=>route.fulfill({json:{scope:'INSTITUTION',classification,requests:[request],reservations:[],timeline:[]}}));
 await page.route('**/api/v2/components',route=>route.fulfill({json:{scope:'INSTITUTION',classification,components:[1,2,3].map(i=>({componentId:'COMP_FEFO_'+i,donationId:'DON_'+i,issuerInstitutionId:source,institutionId:source,bloodType:'A_POSITIVE',componentType:'WHOLE_BLOOD',collectedAt:'2026-10-01T00:00:00Z',expiresAt:`2099-10-0${i}T00:00:00Z`,inventoryStatus:'AVAILABLE',expiryState:'CURRENT',reservationId:null,reservationVersion:null,inventoryVersion:i,policyVersion:'INTERVIEW_DERIVED_CORE_V2',classification}))}}));
 await page.route('**/api/v2/auth/operator-verifications',route=>route.fulfill({json:{verificationId:'VFY_PANEL'}}));
 await page.route('**/api/v2/reservations',async route=>{if(route.request().method()!=='POST')return route.fallback();submitted=route.request().postDataJSON();await route.fulfill({status:202,json:{commandId:'CMD_PANEL',resourceType:'TRANSFER',resourceId:'TRF_WAITING',status:'QUEUED',statusUrl:'/api/v2/commands/CMD_PANEL',acceptedAt:new Date().toISOString(),correlationId:submitted!.correlationId,safeErrorCode:null,classification,replayed:false}});});
 await page.goto('/transfers');await page.getByRole('button',{name:'Open request TRF_WAITING',exact:true}).click();const approval=page.getByRole('region',{name:'Transfer approval'});await expect(approval.getByLabel('Approved units')).toHaveValue('3');await expect(approval).toContainText('Shortfall: 2');await expect(approval.getByRole('button',{name:'Approve Transfer',exact:true})).toBeDisabled();await approval.getByLabel('Partial approval reason').selectOption('INSUFFICIENT_ELIGIBLE_STOCK');await approval.getByLabel('I confirm this request and the selected FEFO units for this transfer.').check();if(process.env.LAT_PANEL_EVIDENCE){await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-16-supplier-review-synthetic.png',fullPage:true});}
 await approval.getByRole('button',{name:'Approve Transfer',exact:true}).click();if(process.env.LAT_PANEL_EVIDENCE)await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-17-operator-verification-synthetic.png',fullPage:true});await page.getByLabel('Operator PIN',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and submit',exact:true}).click();await expect.poll(()=>Boolean(submitted)).toBe(true);expect(submitted).toMatchObject({approvedQuantity:3,partialReasonCode:'INSUFFICIENT_ELIGIBLE_STOCK',selectedComponentIds:['COMP_FEFO_1','COMP_FEFO_2','COMP_FEFO_3'],expectedComponentVersions:[1,2,3]});expect(state.missing.filter(path=>!path.includes('commands'))).toEqual([]);
});

for(const [institutionId,name] of [["INST_MEDIATRIX","Mary Mediatrix Medical Center"],["INST_SYNTH_MEDIX","Lipa Medix Medical Center"],["INST_SYNTH_NLVILLA","N.L. Villa Memorial Medical Center"]]){
 test(name+" displays inbound and outbound unit history distinctly",async({page})=>{
  const state=await setupBankCompletion(page);
  await page.route('**/api/v1/auth/session',route=>route.fulfill({json:{principal:{accountId:'ACC_HISTORY',accountCategory:'BLOOD_BANK',verificationRequired:true,userId:'USR_HISTORY',institutionId,institutionDisplayName:name,displayName:name,roleId:'ROLE-02',roleDisplayName:'Blood bank staff',permissions:['dashboard:operational','inventory:read','transfers:read','profile:read'],operators:[],classification}}}));
  await page.route(url=>url.pathname==='/api/v2/unit-history',route=>route.fulfill({json:readPage('UNIT_HISTORY_READ_V1',[{...unitFixture,rowId:'CMD_IN:COMP_SYNTH',transactionId:'CMD_IN'},{...unitFixture,rowId:'CMD_OUT:COMP_SYNTH',transactionId:'CMD_OUT',direction:'OUTBOUND',eventType:'TRANSFER_DISPATCHED'}])}));
  await page.goto('/transactions');const rows=page.locator('.transaction-history-table tbody tr');await expect(rows).toHaveCount(2);
  await page.getByLabel('Direction',{exact:true}).selectOption('Inbound');await expect(rows).toHaveCount(1);await expect(rows).toContainText('CMD_IN');
  await page.getByLabel('Direction',{exact:true}).selectOption('Outbound');await expect(rows).toHaveCount(1);await expect(rows).toContainText('CMD_OUT');
  if(process.env.LAT_PANEL_EVIDENCE){await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/unit-history-'+institutionId+'.png',fullPage:true});}
  expect(state.posts).toEqual([]);expect(state.missing).toEqual([]);
 });
}
test("supplier sees recorded requester details read-only rather than an unavailable summary",async({page})=>{
 await setupBankCompletion(page);
 await page.route('**/api/v2/transfers/TRF_WAITING/details',route=>route.fulfill({json:{transferId:'TRF_WAITING',sourceInstitutionId:'INST_SYNTH_BANK',destinationInstitutionId:'INST_SYNTH_DEST',version:1,updatedAt:new Date().toISOString(),requestingPerson:'Synthetic coordinator',staffId:'SYN-STAFF-1001',attendingPhysician:'Synthetic physician',requiredAt:'2099-11-05T01:00:00.000Z',pickupRepresentative:'Synthetic pickup staff',pickupAuthorizationReference:'SYN-AUTH-ABC123',notes:'Fictional demonstration request.',documents:[],editable:false,viewerRole:'SUPPLIER',pickupAuthorityVerified:false,unavailableFields:[{field:'patientCaseReference',dependency:'RQ-20'}]}}));
 await page.goto('/transfers');await page.getByRole('button',{name:'Open request TRF_WAITING',exact:true}).click();const details=page.getByRole('heading',{name:'Requester details',exact:true}).locator('..').locator('..');
 await expect(details).toContainText('Synthetic coordinator');await expect(details).toContainText('Synthetic pickup staff');await expect(details.getByRole('button',{name:'Edit details',exact:true})).toHaveCount(0);
 await expect(details).not.toContainText('Request details are unavailable.');
});
