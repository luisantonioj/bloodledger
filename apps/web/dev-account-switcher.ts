import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const credentialsPath = fileURLToPath(new URL("../../build/accounts/private.json", import.meta.url));
const policyPath = fileURLToPath(new URL("../../services/api/policy/institution-accounts-v1.json", import.meta.url));
const origin = "http://127.0.0.1:5174";
const endpoint = "/__local_accounts";
const labels: Record<string, string> = {
  INST_MEDIATRIX: "Mary Mediatrix Medical Center",
  INST_SYNTH_MEDIX: "Lipa Medix Medical Center",
  INST_SYNTH_NLVILLA: "N.L. Villa Memorial Medical Center",
  INST_SYNTH_METROLIPA: "Metro Lipa Medical Center",
  INST_SYNTH_PRC: "PRC Lipa City Chapter",
  INST_SYNTH_DOH: "DOH-CHD CALABARZON",
};
const categories: Record<string, string> = { BLOOD_BANK: "Blood bank facility", REQUESTOR: "Requestor facility", PRC: "PRC administrator", DOH: "DOH regulatory officer" };
interface Account { accountId: string; username: string; institutionId: string; category: string }

const toolbar = `<style>
body{padding-top:var(--local-account-bar-height,64px)!important}
.side{top:var(--local-account-bar-height,64px)!important;height:calc(100vh - var(--local-account-bar-height,64px))!important}
#local-account-bar{position:fixed;inset:0 0 auto;z-index:10000;display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:10px 20px;background:#102132;color:white;font:13px/1.5 sans-serif;box-shadow:0 2px 8px #0002}
#local-account-bar strong{font-size:11px;letter-spacing:.08em}#local-account-bar label{display:flex;align-items:center;gap:8px}
#local-account-bar select{max-width:100%;padding:6px 10px;border:1px solid #cad2da;border-radius:5px;background:white;color:#102132;font:inherit}
#local-account-status{font-size:12px;color:#d7e2ed}#local-account-bar select:disabled{opacity:.65}
@media(max-width:600px){#local-account-bar{padding:8px 12px}#local-account-bar label{width:100%}#local-account-bar select{min-width:0;flex:1}}
</style><aside id="local-account-bar" aria-label="Temporary local account switcher"><strong>LOCAL FRONTEND REVIEW</strong><label>Account<select id="local-account-select" aria-label="Switch local account" disabled><option value="">Loading accounts…</option></select></label><span id="local-account-status" role="status">Existing synthetic accounts · Live local data</span></aside><script type="module" src="${endpoint}/toolbar.js"></script>`;

const script = `
const bar=document.getElementById('local-account-bar'),select=document.getElementById('local-account-select'),status=document.getElementById('local-account-status');
new ResizeObserver(()=>document.documentElement.style.setProperty('--local-account-bar-height',bar.getBoundingClientRect().height+'px')).observe(bar);
let previous='';
try {
  const response=await fetch('${endpoint}',{credentials:'same-origin'});
  if(!response.ok)throw Error();
  const accounts=await response.json();
  select.replaceChildren(new Option('Choose an account…',''));
  for(const category of [...new Set(accounts.map(a=>a.category))]){
    const group=document.createElement('optgroup');group.label=category;
    for(const account of accounts.filter(a=>a.category===category))group.append(new Option(account.label,account.accountId));
    select.append(group);
  }
  const session=await fetch('/api/v1/auth/session',{credentials:'same-origin'});
  if(session.ok){const {principal}=await session.json();previous=principal.accountId??principal.userId;select.value=previous;}
  select.disabled=false;
}catch{status.textContent='Local account switcher unavailable.';}
select.addEventListener('change',async()=>{
  if(!select.value)return;
  select.disabled=true;status.textContent='Switching account…';
  try{
    const response=await fetch('${endpoint}/switch',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:select.value})});
    if(!response.ok)throw Error();
    location.assign('/');
  }catch{select.value=previous;status.textContent='Account switch failed. Refresh and try again.';select.disabled=false;}
});`;

// BL-TST-01 / NFR-11: explicit local convenience; all identities still use API authentication.
export function localAccountSwitcher(): Plugin {
  let enabled = false;
  return {
    name: "bloodledger-local-account-switcher",
    apply: "serve",
    configResolved(config) {
      enabled = config.server.port === 5174 && existsSync(credentialsPath);
      config.server.fs.deny.push("**/build/**");
    },
    transformIndexHtml(html) { return enabled ? html.replace("<body>", "<body>" + toolbar) : html; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        // Private retained artifacts must never be served by Vite's /@fs handler.
        if (path && decodeURIComponent(path).replaceAll("\\", "/").includes("/build/")) {
          res.statusCode = 403;
          res.end("Private local artifacts are unavailable.");
          return;
        }
        if (!path?.startsWith(endpoint)) return next();
        res.setHeader("Cache-Control", "no-store");
        const send = (code: number, value: unknown) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value)); };
        if (!enabled || req.headers.host !== "127.0.0.1:5174") return send(404, { error: "LOCAL_SWITCHER_UNAVAILABLE" });
        if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") return send(403, { error: "ORIGIN_FORBIDDEN" });
        if (path === endpoint + "/toolbar.js" && req.method === "GET") { res.setHeader("Content-Type", "text/javascript"); res.end(script); return; }
        try {
          const accounts = (JSON.parse(readFileSync(policyPath, "utf8")) as { accounts: Account[] }).accounts;
          if (path === endpoint && req.method === "GET") return send(200, accounts.map(a => ({ accountId: a.accountId, label: labels[a.institutionId] ?? a.institutionId, category: categories[a.category] ?? a.category })));
          if (path !== endpoint + "/switch" || req.method !== "POST") return send(405, { error: "METHOD_NOT_ALLOWED" });
          if (req.headers.origin !== origin || req.headers["content-type"] !== "application/json") return send(403, { error: "ORIGIN_FORBIDDEN" });
          let body = "";
          for await (const chunk of req) { body += chunk; if (body.length > 1024) return send(413, { error: "REQUEST_TOO_LARGE" }); }
          const { accountId } = JSON.parse(body);
          const account = accounts.find(a => a.accountId === accountId);
          if (!account) return send(400, { error: "ACCOUNT_INVALID" });
          const privateFile = JSON.parse(readFileSync(credentialsPath, "utf8")) as { passwords: Record<string, string> };
          const password = privateFile.passwords[account.accountId];
          if (!password) return send(503, { error: "LOCAL_CREDENTIAL_UNAVAILABLE" });
          const cookies: string[] = [];
          if (req.headers.cookie) {
            const logout = await fetch("http://127.0.0.1:3000/api/v1/auth/session", { method: "DELETE", headers: { Origin: origin, Cookie: req.headers.cookie }, signal: AbortSignal.timeout(10_000) });
            cookies.push(...logout.headers.getSetCookie());
            if (!logout.ok) return send(502, { error: "LOCAL_SIGN_OUT_FAILED" });
          }
          const login = await fetch("http://127.0.0.1:3000/api/v1/auth/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ username: account.username, password }), signal: AbortSignal.timeout(10_000) });
          cookies.push(...login.headers.getSetCookie());
          if (cookies.length) res.setHeader("Set-Cookie", cookies);
          return send(login.ok ? 200 : 502, login.ok ? { switched: true } : { error: "LOCAL_SIGN_IN_FAILED" });
        } catch { return send(503, { error: "LOCAL_SWITCHER_UNAVAILABLE" }); }
      });
    },
  };
}
