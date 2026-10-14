// Explicit test-only loopback fixture host. Normal Vite/API/production paths never import it.
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fixture, permissions, reviewAccounts, principal } from './fixtures.mjs';
const root = resolve(import.meta.dirname, '../../../apps/web');
const accountPattern = /(?:^|;\s*)bloodledger_review_account=([A-Z0-9_]+)(?:;|$)/;
const statePattern = /(?:^|;\s*)bloodledger_review_state=(populated|empty|unavailable)(?:;|$)/;
function allowed(path, user) {
  const p=user.permissions, role=user.roleId;
  if(path==='/api/v2/onboarding/institutions'||path==='/api/v2/onboarding/applications')return user.accountCategory==='PRC';
  if(path.startsWith('/api/v2/onboarding/institutions/'))return user.accountCategory==='PRC'||path==='/api/v2/onboarding/institutions/'+user.institutionId;
  if(path.startsWith('/api/v2/reports/doh-census'))return ['ROLE-01','ROLE-02','ROLE-04'].includes(role);
  if(path==='/api/v1/auth/session'||path==='/api/v1/dashboard'||path==='/api/v2/dashboard')return true;
  if(path==='/api/v2/transfers')return p.includes('transfers:read');
  if(path.startsWith('/api/v2/reservations/'))return p.includes('transfers:read');
  if(path==='/api/v2/alerts')return p.includes('alerts:read');
  if(path==='/api/v2/audit')return p.includes('audit:read');
  if(path.startsWith('/api/v2/historical-snapshots'))return ['ROLE-01','ROLE-02'].includes(role);
  if(path.startsWith('/api/v2/components'))return p.includes('inventory:read');
  if(path==='/api/v2/reports/inbound-intake')return ['ROLE-01','ROLE-02'].includes(role);
  if(path.startsWith('/api/v1/transfers'))return p.includes('transfers:read');
  if(path==='/api/v1/alerts')return p.includes('alerts:read');
  if(path==='/api/v1/consortium')return p.includes('consortium:read');
  if(path==='/api/v1/audit')return p.includes('audit:read');
  if(path.startsWith('/api/v1/reports/'))return p.includes('reports:read');
  if(path==='/api/v1/demand-forecasts'||path==='/api/v2/analytics/inventory-evidence')return ['ROLE-01','ROLE-02','ROLE-03'].includes(role);
  return false;
}
const toolbar = `<style>
body{padding-top:var(--local-account-bar-height,64px)!important}
.side{top:var(--local-account-bar-height,64px)!important;height:calc(100vh - var(--local-account-bar-height,64px))!important}
#local-account-bar{position:fixed;inset:0 0 auto;z-index:10000;display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:10px 20px;background:#102132;color:white;font:13px/1.5 sans-serif;box-shadow:0 2px 8px #0002}
.preview-modal-backdrop{z-index:10001}
#local-account-bar strong{font-size:11px;letter-spacing:.08em}#local-account-bar label{display:flex;align-items:center;gap:8px}
#local-account-bar select{max-width:100%;padding:6px 10px;border:1px solid #cad2da;border-radius:5px;background:white;color:#102132;font:inherit}
#local-account-status{font-size:12px;color:#d7e2ed}#local-account-bar select:disabled{opacity:.65}
@media(max-width:600px){#local-account-bar{padding:8px 12px}#local-account-bar label{width:100%}#local-account-bar select{min-width:0;flex:1}}
</style><aside id="local-account-bar" aria-label="Synthetic institution account switcher"><strong>LOCAL FRONTEND REVIEW</strong><label>Account<select id="local-account-select" aria-label="Switch local account" disabled><option value="">Loading accounts…</option></select></label><label>Data state<select id="review-state"><option value="populated">Populated</option><option value="empty">Empty</option><option value="unavailable">Unavailable</option></select></label><span id="local-account-status" role="status">V3 scenario fixtures · 522 additions · No backend connection</span></aside><script type="module" src="/__review/toolbar.js"></script>`;
const toolbarScript = `const bar=document.getElementById('local-account-bar'),select=document.getElementById('local-account-select');new ResizeObserver(()=>document.documentElement.style.setProperty('--local-account-bar-height',bar.getBoundingClientRect().height+'px')).observe(bar);
const accounts=await(await fetch('/__review/accounts')).json();select.replaceChildren();for(const category of [...new Set(accounts.map(a=>a.category))]){const group=document.createElement('optgroup');group.label=category;for(const a of accounts.filter(a=>a.category===category))group.append(new Option(a.label,a.accountId));select.append(group);}
const {principal}=await(await fetch('/api/v1/auth/session')).json();select.value=principal.accountId;select.disabled=false;
select.onchange=()=>{document.cookie='bloodledger_review_account='+select.value+'; Path=/; SameSite=Strict';location.assign('/');};
const state=document.getElementById('review-state');state.value=document.cookie.split('; ').find(x=>x.startsWith('bloodledger_review_state='))?.split('=')[1]??'populated';state.onchange=()=>{document.cookie='bloodledger_review_state='+state.value+'; Path=/; SameSite=Strict';location.reload();};`;
const server = await createServer({root,configFile:resolve(root,'vite.config.ts'),server:{host:'127.0.0.1',port:5175,strictPort:true,proxy:{}},plugins:[{
  name:'bloodledger-explicit-visual-review',
  async load(id){
    const path=id.split('?')[0];
    if(path===resolve(root,'src/app/application.tsx'))return (await readFile(resolve(import.meta.dirname,'application.tsx'),'utf8')).replaceAll('../../../apps/web/src/','/src/');
    if(path===resolve(root,'src/features/dashboard/inventory-overview-chart.tsx')){
      const source=await readFile(path,'utf8');
      return source.replace('Ledger-confirmed inventory by blood type','Synthetic scenario inventory by blood type').replace('confirmed units','fixture units');
    }

  },
  transformIndexHtml(html){return html.replace('<body>','<body>'+toolbar);},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://127.0.0.1:5175');
    const send=(status,value)=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    if(url.pathname==='/__review/accounts'){send(200,reviewAccounts.map(a=>({...a,category:({BLOOD_BANK:'Blood bank facility',REQUESTOR:'Requestor facility',PRC:'PRC administrator',DOH:'DOH regulatory officer'})[a.category]})));return;}
    if(url.pathname==='/__review/toolbar.js'){res.setHeader('Content-Type','text/javascript');res.end(toolbarScript);return;}
    // Never route capture to this fixture frontend.
    if(url.pathname.startsWith('/capture')){res.statusCode=404;res.end('Capture is reviewed separately at http://127.0.0.1:3000/capture/');return;}
    if(!url.pathname.startsWith('/api/'))return next();
    res.setHeader('X-BloodLedger-Data-Source','SYNTHETIC_VISUAL_FIXTURE');
    if(req.method!=='GET'){send(405,{error:{code:'VISUAL_REVIEW_READ_ONLY',message:'Visual review blocks all writes. No live API is connected.'}});return;}
    const accountId=req.headers.cookie?.match(accountPattern)?.[1]??reviewAccounts[0].accountId;
    const user=principal(undefined,accountId),role=user.roleId;
    const state=req.headers.cookie?.match(statePattern)?.[1]??'populated';
    if(!allowed(url.pathname,user)){send(403,{error:{code:'FORBIDDEN',message:'Select the appropriate review role for this page.'}});return;}
    if(state==='unavailable'&&url.pathname!=='/api/v1/auth/session'){send(503,{error:{code:'VISUAL_REVIEW_UNAVAILABLE',message:'Selected unavailable visual scenario.'}});return;}
    if(url.pathname==='/api/v1/reports/inventory.csv'){res.setHeader('Content-Type','text/csv');res.end('classification,data_source\nSIMULATION_ONLY,SYNTHETIC_VISUAL_FIXTURE\n');return;}
    if(req.headers['x-bloodledger-contract-version']==='V2.1')url.searchParams.set('contractVersion','V2.1');
    const body=fixture(url,role,state,accountId);
    if(body===undefined){send(404,{error:{code:'VISUAL_REVIEW_ROUTE_MISSING',message:'No approved visual fixture for this route.'}});return;}
    send(200,body);
  });},
}]});
await server.listen();
console.log('BloodLedger populated UI review: http://127.0.0.1:5175');
console.log('Explicit synthetic visual fixtures only. No Docker, database, credentials, ledger or live API. Ctrl+C stops.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
