import {mkdir} from "node:fs/promises";
import {readPage,unitFixture} from "./fixtures/transaction-reads";
import {test,expect} from "@playwright/test";
import {setupBankCompletion} from "./fixtures/blood-bank-completion";
import {exactStockFixture} from "./fixtures/panel-revisions";
const classification="SIMULATION_ONLY";
test("exact stock overrides old aggregates and separates pending units in the chart",async({page})=>{
 await setupBankCompletion(page);await page.goto("/");
 const card=page.locator('.exact-stock-card');await expect(card.getByRole('listitem',{name:/A\+ Whole Blood: Available: 7;/}).locator('.inventory-overview-track > strong')).toHaveText('7');await expect(card).toContainText('3 changes pending ledger confirmation');await expect(card.locator('.segment-unknown')).toHaveCount(0);
 const segment=card.getByRole('button',{name:/A\+ Whole Blood — demo band/}).first();
 await segment.evaluate(element=>element.closest('.inventory-overview-fill')!.scrollIntoView({block:'end',inline:'nearest'}));
 await segment.hover();
 const tooltip=page.getByRole('tooltip');
 await expect(tooltip).toBeVisible();
 const fill=card.getByRole('listitem',{name:/^A\+ Whole Blood:/}).locator('.inventory-overview-fill');
 const barBounds=(await fill.boundingBox())!;
 const tooltipBounds=(await tooltip.boundingBox())!;
 expect(tooltipBounds.y+tooltipBounds.height).toBeLessThanOrEqual(barBounds.y-8);
 await segment.focus();await expect(tooltip).toContainText('Available: 7');await expect(tooltip).toContainText('Reserved: 2');await expect(tooltip).toContainText('Label expired, pending evaluation: 4');
 await expect(page.getByRole('tooltip').locator('.exact-stock-tooltip-counts > span')).toHaveText([
  'Available: 7','Reserved: 2','Expired: 2','Label expired, pending evaluation: 4',
  'Outgoing in transit: 0','Received (not usable): 0','On hold: 0','Compromised: 0',
 ]);
 if(process.env.LAT_PANEL_EVIDENCE){await page.keyboard.press('Escape');await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-15-dashboard-synthetic.png',fullPage:true});}
 await expect(card.getByRole('button',{name:/^(Exact counts|Copy exact counts|Export exact counts PDF)$/})).toHaveCount(0);
 await expect(card.getByText(/SIMULATION_ONLY · Exact inventory counts/)).toHaveCount(0);
 await expect(card.getByRole('button',{name:'Refresh exact counts',exact:true})).toHaveCount(0);
 await expect(card.getByText(/^As of /)).toHaveCount(0);
 await expect(page.locator('.dashboard-actions')).toContainText('Last updated:');
 await expect(card.locator('.inventory-overview-bar')).toHaveCount(40);
 await expect(card.locator('.inventory-overview-label')).toHaveText(['A+','B+','AB+','O+','A-','B-','AB-','O-']);
 const availability=card.getByLabel('Availability',{exact:true});
 const wholeBlood=card.getByRole('listitem',{name:/^A\+ Whole Blood:/});
 const number=wholeBlood.locator('.inventory-overview-track > strong');
 await expect(availability.locator('option')).toHaveText(['Available','Reserved']);
 await expect(availability).toHaveValue('AVAILABLE');
 await availability.selectOption('RESERVED');
 await expect(number).toHaveText('2');
 await expect(card.locator('.inventory-overview-axis-title')).toHaveText('Reserved units');
 await expect(card.locator('.inventory-overview-legend')).toHaveCount(0);
 await wholeBlood.getByRole('button').focus();
 await expect(page.getByRole('tooltip')).toContainText('Expired: 2');
 await expect(page.getByRole('tooltip')).toContainText('Label expired, pending evaluation: 4');
 await availability.selectOption('AVAILABLE');
 await expect(number).toHaveText('7');
 await expect(card.locator('.inventory-overview-legend')).toBeVisible();
 await page.route('**/api/v2/dashboard/stock-counts',route=>route.fulfill({json:exactStockFixture('INST_SYNTH_BANK',8,2,4,2)}));
 await page.locator('.dashboard-actions').getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(card.getByRole('listitem',{name:/A\+ Whole Blood: Available: 8;/}).locator('.inventory-overview-track > strong')).toHaveText('8');
 await page.getByLabel('Inventory overview blood component').selectOption('PLATELETS');await expect(card.locator('.inventory-overview-bar')).toHaveCount(8);await card.getByRole('button',{name:/A\+ Platelets — demo band/}).focus();await expect(page.getByRole('tooltip')).toContainText('Available: 0');
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
 await page.goto('/transfers');await page.getByRole('button',{name:'Open request TRF_WAITING',exact:true}).click();const approval=page.getByRole('region',{name:'Transfer approval'});await expect(approval.getByLabel('Approved units')).toHaveValue('3');const shortfall=approval.locator('.approval-quantity').filter({hasText:'Unfilled units'});await expect(shortfall.getByText('2',{exact:true})).toBeVisible();await expect(shortfall.getByText('Closes as a shortfall',{exact:true})).toBeVisible();await expect(approval.getByRole('button',{name:'Recheck available units',exact:true})).toBeVisible();await expect(approval.getByRole('table').getByRole('row')).toHaveCount(4);await expect(approval.getByRole('button',{name:'Approve Transfer',exact:true})).toBeDisabled();await approval.getByLabel('Partial approval reason').selectOption('INSUFFICIENT_ELIGIBLE_STOCK');await approval.getByRole('textbox',{name:'Comments (optional)',exact:true}).fill('Synthetic review note');await approval.getByLabel('I’ve reviewed the request and selected units.').check();if(process.env.LAT_PANEL_EVIDENCE){await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-16-supplier-review-synthetic.png',fullPage:true});}
 await approval.getByRole('button',{name:'Approve Transfer',exact:true}).click();if(process.env.LAT_PANEL_EVIDENCE)await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/figure-17-operator-verification-synthetic.png',fullPage:true});await page.getByLabel('Operator PIN',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and submit',exact:true}).click();await expect.poll(()=>Boolean(submitted)).toBe(true);expect(submitted).toMatchObject({approvedQuantity:3,partialReasonCode:'INSUFFICIENT_ELIGIBLE_STOCK',selectedComponentIds:['COMP_FEFO_1','COMP_FEFO_2','COMP_FEFO_3'],expectedComponentVersions:[1,2,3]});expect(JSON.stringify(submitted)).not.toContain('Synthetic review note');expect(state.missing.filter(path=>!path.includes('commands'))).toEqual([]);
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
 const updatedAt=new Date().toISOString();
 const documents=[
  {documentId:'DOC_'+'1'.repeat(40),kind:'REQUEST_FORM',displayName:'synthetic-request-form.pdf',contentType:'application/pdf',sizeBytes:1024,uploadedAt:updatedAt},
  {documentId:'DOC_'+'2'.repeat(40),kind:'PICKUP_AUTHORIZATION',displayName:'synthetic-pickup-authorization.pdf',contentType:'application/pdf',sizeBytes:1024,uploadedAt:updatedAt},
 ];
 await page.route('**/api/v2/transfers/TRF_WAITING/details',route=>route.fulfill({json:{transferId:'TRF_WAITING',sourceInstitutionId:'INST_SYNTH_BANK',destinationInstitutionId:'INST_SYNTH_DEST',version:1,updatedAt,requestingPerson:'Synthetic coordinator',staffId:'SYN-STAFF-1001',attendingPhysician:'Synthetic physician',requiredAt:'2099-11-05T01:00:00.000Z',pickupRepresentative:'Synthetic pickup staff',pickupAuthorizationReference:'SYN-AUTH-ABC123',notes:'Fictional demonstration request.',documents,editable:false,viewerRole:'SUPPLIER',pickupAuthorityVerified:false,unavailableFields:[{field:'patientCaseReference',dependency:'RQ-20'}]}}));
 await page.goto('/transfers');
 const requestButton=page.getByRole('button',{name:'Open request TRF_WAITING',exact:true});
 await requestButton.click();
 const record=page.getByRole('dialog',{name:'Request details',exact:true});
 await expect(record.getByRole('button',{name:'Close record details'})).toBeFocused();
 await expect(requestButton).toBeVisible();
 const bounds=await record.boundingBox(),viewport=page.viewportSize();
 expect(bounds!.x+bounds!.width/2).toBeCloseTo(viewport!.width/2,0);
 expect(bounds!.y+bounds!.height/2).toBeCloseTo(viewport!.height/2,0);
 const summary=record.getByRole('region',{name:'Blood request',exact:true});
 const details=record.getByRole('region',{name:'Requester details',exact:true});
 await expect(summary.getByText('Request ID',{exact:true})).toBeVisible();
 await expect(summary.getByText('TRF_WAITING',{exact:true})).toBeVisible();
 await expect(record.getByText(/^awaiting decision$/i)).toHaveCount(0);
 await expect(page.getByRole('row').filter({has:requestButton}).getByText(/^awaiting decision$/i)).toBeVisible();
 await expect(details).toContainText('Synthetic coordinator');await expect(details).toContainText('Synthetic pickup staff');await expect(details.getByRole('button',{name:'Edit details',exact:true})).toHaveCount(0);
 await expect(details).not.toContainText('Request details are unavailable.');
 await expect(details).not.toContainText('Version 1');
 for(const document of documents){
  const link=details.getByRole('link',{name:'Download '+document.displayName,exact:true});
  await expect(details.getByText(document.displayName,{exact:true})).toHaveCSS('text-decoration-line','none');
  await expect(link.locator('svg')).toBeVisible();
  await expect(link).toHaveAttribute('href','/api/v2/transfers/TRF_WAITING/documents/'+document.documentId);
  await expect(link).toHaveAttribute('download',document.displayName);
 }
 const [left,right,close,help]=await Promise.all([
  summary.boundingBox(),details.boundingBox(),
  record.getByRole('button',{name:'Close record details'}).boundingBox(),record.getByRole('button',{name:'Record details information'}).boundingBox(),
 ]);
 expect(right!.x).toBeGreaterThan(left!.x+left!.width);
 expect(right!.y).toBeCloseTo(left!.y,0);
 expect(right!.width).toBeCloseTo(left!.width,0);
 expect(right!.height).toBeCloseTo(left!.height,0);
 await expect(summary.locator('header')).toHaveCSS('border-bottom-width','1px');
 await expect(details.locator('header')).toHaveCSS('border-bottom-width','1px');
 const [leftValue,rightValue]=await Promise.all([summary.locator('dl>dd').first().boundingBox(),details.locator('dl>dd').first().boundingBox()]);
 expect(leftValue!.x-left!.x).toBeCloseTo(rightValue!.x-right!.x,0);
 expect(leftValue!.y).toBeCloseTo(rightValue!.y,0);
 expect(close!.y+close!.height/2).toBeCloseTo(help!.y+help!.height/2,0);
 if(process.env.LAT_PANEL_EVIDENCE){
  await mkdir(process.env.LAT_PANEL_EVIDENCE,{recursive:true});
  await page.screenshot({path:process.env.LAT_PANEL_EVIDENCE+'/request-details-modal.png'});
 }
 await page.setViewportSize({width:390,height:844});
 const [stackedSummary,stackedDetails]=await Promise.all([summary.boundingBox(),details.boundingBox()]);
 expect(stackedDetails!.y).toBeGreaterThan(stackedSummary!.y+stackedSummary!.height);
 expect(stackedDetails!.x).toBeCloseTo(stackedSummary!.x,0);
 await page.keyboard.press('Escape');
 await expect(record).toHaveCount(0);
 await expect(requestButton).toBeFocused();
});
