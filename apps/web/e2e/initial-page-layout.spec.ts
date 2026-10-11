import {test,expect,type Page} from "@playwright/test";
const roles=[['BLOOD_BANK','ROLE-02'],['REQUESTOR','ROLE-03'],['PRC','ROLE-04'],['DOH','ROLE-05']] as const;
async function auth(page:Page,category='BLOOD_BANK',role='ROLE-02'){
 await page.route('**/api/v1/auth/session',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({principal:{accountId:'ACC_LAYOUT_SYNTH',accountCategory:category,userId:'USR_LAYOUT_SYNTH',institutionId:'INST_MEDIATRIX',institutionDisplayName:'Layout test facility',displayName:'Layout test',roleId:role,roleDisplayName:'Test role',permissions:['dashboard:operational','dashboard:regulatory','inventory:read','transfers:read','audit:read','alerts:read','profile:read'],operators:[],classification:'SIMULATION_ONLY'}})}));
}
for(const [category,role] of roles)test(`${category}: dashboard cards render before the initial read completes`,async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/v2/**',async route=>{await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Layout fixture unavailable'}})});});await auth(page,category,role);
 await page.goto('/');await expect(page.locator('.dashboard-stats article')).toHaveCount(4);await expect(page.locator('.dashboard-stats article strong').first()).toHaveText('—');
 await expect(page.getByText(/Unable to load|account session changed/i)).toHaveCount(0);
 const heading=category==='BLOOD_BANK'?'Blood Inventory Overview':category==='REQUESTOR'?'My Requests':category==='PRC'?'Blood-Bank Inventory Overview':'Compliance Reports';
 await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();release();
});
for(const [path,selector] of [['/alerts','.alert-severity-filters'],['/audit','.audit-filter-controls'],['/transfers','.bank-list-filters'],['/inventory','.inventory-filter-controls']] as const)test(`${path}: page controls remain visible while initial data is pending`,async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('**/api/v2/**',async route=>{await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Layout fixture unavailable'}})});});await auth(page);await page.goto(path);
 await expect(page.locator(selector)).toBeVisible();await expect(page.getByText(/Unable to load|account session changed/i)).toHaveCount(0);
 if(path==='/alerts')await expect(page.locator('.alert-summary strong').first()).toHaveText('—');
 if(path==='/audit')await expect(page.locator('.audit-summary strong').first()).toHaveText('—');release();
});
test('first transient read retries quietly; persistent failure retains alert layout',async({page})=>{
 let reads=0;await page.route('**/api/v2/alerts',route=>{reads++;return route.fulfill({status:reads===1?503:200,contentType:'application/json',body:JSON.stringify(reads===1?{error:{message:'Transient initial read'}}:{scope:'INSTITUTION',alerts:[],aggregates:[],classification:'SIMULATION_ONLY'})});});await auth(page);await page.goto('/alerts');await expect(page.getByText('No alerts',{exact:true})).toBeVisible();expect(reads).toBe(2);await expect(page.getByText('Transient initial read',{exact:true})).toHaveCount(0);
 await page.route('**/api/v2/alerts',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Persistent read failure'}})}));await page.reload();await expect(page.getByText('Persistent read failure',{exact:true})).toBeVisible();await expect(page.locator('.alert-severity-filters')).toBeVisible();await expect(page.locator('.alert-summary strong').first()).toHaveText('—');
});
