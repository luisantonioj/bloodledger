// Explicit test-only loopback fixture host. Normal Vite/API/production paths never import it.
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fixture, permissions, roleNames } from './fixtures.mjs';
const root = resolve(import.meta.dirname, '../../../apps/web');
const rolePattern = /(?:^|;\s*)bloodledger_review_role=(ROLE-0[1-6])(?:;|$)/;
const statePattern = /(?:^|;\s*)bloodledger_review_state=(populated|empty|unavailable)(?:;|$)/;
function allowed(path, role) {
  const p=permissions[role];
  if(path==='/api/v1/auth/session'||path==='/api/v1/dashboard'||path==='/api/v2/dashboard')return true;
  if(path==='/api/v2/transfers')return p.includes('transfers:read');
  if(path==='/api/v2/alerts')return p.includes('alerts:read');
  if(path==='/api/v2/audit')return p.includes('audit:read');
  if(path.startsWith('/api/v2/historical-snapshots'))return ['ROLE-01','ROLE-02'].includes(role);
  if(path==='/api/v2/components')return p.includes('inventory:read');
  if(path==='/api/v2/reports/inbound-intake')return ['ROLE-01','ROLE-02'].includes(role);
  if(path.startsWith('/api/v1/transfers'))return p.includes('transfers:read');
  if(path==='/api/v1/alerts')return p.includes('alerts:read');
  if(path==='/api/v1/consortium')return p.includes('consortium:read');
  if(path==='/api/v1/audit')return p.includes('audit:read');
  if(path.startsWith('/api/v1/reports/'))return p.includes('reports:read');
  if(path==='/api/v1/demand-forecasts'||path==='/api/v2/analytics/inventory-evidence')return ['ROLE-01','ROLE-02','ROLE-03'].includes(role);
  return false;
}
const modePattern = /(?:^|;\s*)bloodledger_review_mode=(all|role)(?:;|$)/;
function pageRole(path, selected, mode) {
  if(mode === 'role')return selected;
  if(path === '/accounts')return ['ROLE-05','ROLE-06'].includes(selected)?selected:'ROLE-05';
  if(path === '/consortium'||path === '/reporting')return 'ROLE-04';
  if(path === '/audit'&&!permissions[selected].includes('audit:read'))return 'ROLE-02';
  if(path === '/inventory'&&!permissions[selected].includes('inventory:read'))return 'ROLE-01';
  if(path === '/analytics'&&!['ROLE-01','ROLE-02','ROLE-03'].includes(selected))return 'ROLE-01';
  if(['/transfers','/alerts'].includes(path)&&['ROLE-05','ROLE-06'].includes(selected))return 'ROLE-01';
  return selected;
}
const toolbar = `<style>body{padding-top:var(--visual-review-height,64px)!important}.side{top:var(--visual-review-height,64px)!important;height:calc(100vh - var(--visual-review-height,64px))!important}#visual-review{position:fixed;top:0;left:0;right:0;z-index:10000;background:#102132;color:white;min-height:48px;padding:8px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font:14px sans-serif}#visual-review select{color:#102132;background:white;padding:4px}#visual-review label{display:flex;gap:6px;align-items:center}</style><aside id="visual-review" aria-label="Synthetic visual review"><strong>UI REVIEW · SAMPLE DATA · NO BACKEND CONNECTION</strong><label>Navigation<select id="review-mode" aria-label="Review navigation"><option value="all">All pages</option><option value="role">Role view</option></select></label><label>Page<select id="review-page" aria-label="Review page"><option value="/">Dashboard</option><option value="/inventory">Blood Inventory</option><option value="/transfers">Requests &amp; Transfers</option><option value="/alerts">Alerts</option><option value="/consortium">Network view</option><option value="/audit">Activity History</option><option value="/reporting">Reports</option><option value="/analytics">Analytics</option><option value="/accounts">Accounts</option><option value="/profile">Profile</option></select></label><label>Review role<select id="review-role" aria-label="Review role">${Object.keys(permissions).map((id,i)=>`<option value="${id}">${id} — ${roleNames[i]}</option>`).join('')}</select></label><label>Data state<select id="review-state" aria-label="Data state"><option value="populated">Populated</option><option value="empty">Empty</option><option value="unavailable">Unavailable</option></select></label><span>All pages uses a permitted synthetic role per page · Writes blocked</span></aside><script type="module" src="/__review/toolbar.js"></script>`;
const toolbarScript = `const pageSelect=document.getElementById('review-page');pageSelect.value=location.pathname;pageSelect.onchange=()=>location.assign(pageSelect.value);const bar=document.getElementById('visual-review');new ResizeObserver(()=>document.documentElement.style.setProperty('--visual-review-height',bar.getBoundingClientRect().height+'px')).observe(bar);const cookie=(key,fallback)=>document.cookie.split('; ').find(x=>x.startsWith(key+'='))?.split('=')[1]??fallback;for(const [id,key,fallback] of [['review-mode','bloodledger_review_mode','all'],['review-role','bloodledger_review_role','ROLE-01'],['review-state','bloodledger_review_state','populated']]){const select=document.getElementById(id);select.value=cookie(key,fallback);select.onchange=()=>{document.cookie=key+'='+select.value+'; Path=/; SameSite=Strict';location.assign('/');};}`;
const server = await createServer({root,configFile:resolve(root,'vite.config.ts'),server:{host:'127.0.0.1',port:5175,strictPort:true,proxy:{}},plugins:[{
  name:'bloodledger-explicit-visual-review',
  async load(id){if(id.split('?')[0]===resolve(root,'src/app/application.tsx'))return (await readFile(resolve(import.meta.dirname,'application.tsx'),'utf8')).replaceAll('../../../apps/web/src/','/src/');},
  transformIndexHtml(html){return html.replace('<body>','<body>'+toolbar);},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,'http://127.0.0.1:5175');
    const send=(status,value)=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    if(url.pathname==='/__review/toolbar.js'){res.setHeader('Content-Type','text/javascript');res.end(toolbarScript);return;}
    // Never route capture to this fixture frontend.
    if(url.pathname.startsWith('/capture')){res.statusCode=404;res.end('Capture is reviewed separately at http://127.0.0.1:3000/capture/');return;}
    if(!url.pathname.startsWith('/api/'))return next();
    res.setHeader('X-BloodLedger-Data-Source','SYNTHETIC_VISUAL_FIXTURE');
    if(req.method!=='GET'){send(405,{error:{code:'VISUAL_REVIEW_READ_ONLY',message:'Visual review blocks all writes. No live API is connected.'}});return;}
    const selected=req.headers.cookie?.match(rolePattern)?.[1]??'ROLE-01';
    const mode=req.headers.cookie?.match(modePattern)?.[1]??'all';
    const referrer=req.headers.referer?new URL(req.headers.referer):null;
    const pagePath=url.searchParams.get('reviewPage')??referrer?.pathname??'/';
    const role=pageRole(pagePath,selected,mode);
    const state=req.headers.cookie?.match(statePattern)?.[1]??'populated';
    if(!allowed(url.pathname,role)){send(403,{error:{code:'FORBIDDEN',message:'Select the appropriate review role for this page.'}});return;}
    if(state==='unavailable'&&url.pathname!=='/api/v1/auth/session'){send(503,{error:{code:'VISUAL_REVIEW_UNAVAILABLE',message:'Selected unavailable visual scenario.'}});return;}
    if(url.pathname==='/api/v1/reports/inventory.csv'){res.setHeader('Content-Type','text/csv');res.end('classification,data_source\nSIMULATION_ONLY,SYNTHETIC_VISUAL_FIXTURE\n');return;}
    if(req.headers['x-bloodledger-contract-version']==='V2.1')url.searchParams.set('contractVersion','V2.1');
    const body=fixture(url,role,state);
    if(body===undefined){send(404,{error:{code:'VISUAL_REVIEW_ROUTE_MISSING',message:'No approved visual fixture for this route.'}});return;}
    send(200,body);
  });},
}]});
await server.listen();
console.log('BloodLedger populated UI review: http://127.0.0.1:5175');
console.log('Explicit synthetic visual fixtures only. No Docker, database, credentials, ledger or live API. Ctrl+C stops.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
