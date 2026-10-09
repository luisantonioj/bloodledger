// FR-01/03/09/12: HTTP fixtures exercise UI boundaries; not retained-backend acceptance.
import {expect,test,type Page} from '@playwright/test';
const component={componentId:'COMP_TEST',donationId:'DON_TEST',issuerInstitutionId:'INST_MEDIATRIX',componentType:'PLATELETS',bloodType:'A_POSITIVE',collectedAt:'2026-10-08T00:00:00Z',expiresAt:'2026-10-12T00:00:00Z',institutionId:'INST_MEDIATRIX',inventoryStatus:'RESERVED',reservationId:'RES_TEST',reservationVersion:1,inventoryVersion:2,policyVersion:'INTERVIEW_DERIVED_CORE_V2',classification:'SIMULATION_ONLY'};
const reservation={reservationId:'RES_TEST',purpose:'LOCAL_RELEASE',status:'ACTIVE',version:1,sourceInstitutionId:'INST_MEDIATRIX',destinationInstitutionId:null,transferId:null,localReleaseId:'REL_TEST',preparedAt:null,preparedEvidencePresent:false,updatedAt:'2026-10-09T00:00:00Z',components:[{componentId:'COMP_TEST',componentType:'PLATELETS',inventoryStatus:'RESERVED',inventoryVersion:2}],classification:'SIMULATION_ONLY'};
async function setup(page:Page, failures:number[]=[]){
 let signedIn=true;const paths:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;paths.push(path);
  const send=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/api/v1/auth/session'){
   if(route.request().method==='DELETE'){signedIn=false;return route.fulfill({status:204});}
   return send(signedIn?{principal:{userId:'USR_TEST',accountId:'USR_TEST',accountCategory:'BLOOD_BANK',institutionId:'INST_MEDIATRIX',institutionDisplayName:'Synthetic Mediatrix',displayName:'Synthetic account',roleId:'ROLE-02',roleDisplayName:'Coordinator',verificationRequired:true,operators:[],permissions:['dashboard:operational','inventory:read','transfers:read','profile:read'],classification:'SIMULATION_ONLY'}}:{error:{code:'AUTH_REQUIRED'}},signedIn?200:401);
  }
  if(!signedIn)return send({error:{code:'AUTH_REQUIRED'}},401);
  if(path==='/api/v2/components')return send({scope:'INSTITUTION',components:[component],classification:'SIMULATION_ONLY'});
  if(path==='/api/v2/components/COMP_TEST')return send(component);
  if(path==='/api/v2/reservations/RES_TEST'){const failure=failures.shift();return failure?send({error:{message:'Untrusted error details'}},failure):send(reservation);}
  if(path==='/api/v2/reports/inbound-intake')return send({scope:'INSTITUTION',statuses:{},includedInventoryStatuses:['COMMITTED'],excludedFromInventory:['QUEUED','FAILED','CONFLICT'],classification:'SIMULATION_ONLY'});
  return send({error:{code:'MISSING'}},404);
 });return paths;
}
test('verified-account deep link shows local-release purpose and members without an invented endpoint',async({page})=>{
 const paths=await setup(page);await page.goto('/inventory?record=component&recordId=COMP_TEST');const dialog=page.getByRole('dialog');await expect(dialog.getByText('DON_TEST',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Open linked reservation',exact:true}).click();await expect(dialog.getByText('REL_TEST',{exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Open linked transfer request',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Open member COMP_TEST',exact:true}).click();await expect(dialog.getByText('DON_TEST',{exact:true})).toBeVisible();expect(paths.some(p=>p.includes('local-release'))).toBe(false);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
for(const [status,message] of [[403,'Access denied'],[404,'Record unavailable'],[409,'conflicted'],[503,'could not be verified']] as const){
 test(`reservation ${status} clears component detail and retry recovers`,async({page})=>{
  await setup(page,[status]);await page.goto('/inventory?record=component&recordId=COMP_TEST');const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Open linked reservation',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText(message);await expect(dialog.getByText('DON_TEST',{exact:true})).toHaveCount(0);await expect(dialog.getByText('Untrusted error details',{exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Retry record',exact:true}).click();await expect(dialog.getByText('REL_TEST',{exact:true})).toBeVisible();
 });
}
test('logout clears an open protected detail',async({page})=>{
 await setup(page);await page.goto('/inventory?record=component&recordId=COMP_TEST');await expect(page.getByRole('dialog').getByText('DON_TEST',{exact:true})).toBeVisible();await page.evaluate(()=>document.querySelector<HTMLButtonElement>('.sign-out')?.click());await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('DON_TEST',{exact:true})).toHaveCount(0);
});

test('a detail 401 clears the entire protected shell',async({page})=>{
 await setup(page,[401]);await page.goto('/inventory?record=component&recordId=COMP_TEST');await page.getByRole('dialog').getByRole('button',{name:'Open linked reservation',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('DON_TEST',{exact:true})).toHaveCount(0);
});
