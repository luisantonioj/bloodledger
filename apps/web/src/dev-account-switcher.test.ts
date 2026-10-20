import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedConfig, ViteDevServer } from "vite";
import { localAccountSwitcher } from "../dev-account-switcher";

const files = vi.hoisted(() => ({ existsSync: vi.fn(() => true), readFileSync: vi.fn() }));
vi.mock("node:fs", () => files);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); files.existsSync.mockReturnValue(true); });

function configure(port = 5174) {
  const plugin = localAccountSwitcher();
  const config = { server: { port, fs: { deny: [] as string[] } } };
  (plugin.configResolved as (config: ResolvedConfig) => void)(config as ResolvedConfig);
  const html = (plugin.transformIndexHtml as (html: string) => string)("<body>Sign in</body>");
  let middleware!: (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
  (plugin.configureServer as (server: ViteDevServer) => void)({ middlewares: { use: (handler: typeof middleware) => { middleware = handler; } } } as unknown as ViteDevServer);
  return { plugin, config, html, middleware };
}

describe("BL-TST-01 / NFR-11 local switcher requires explicit host opt-in", () => {
  it.each([undefined, "", "false", "1"])("does not enable with credentials present and opt-in %s", async value => {
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", value);
    const { html, config, middleware } = configure();
    expect(html).not.toContain("local-account-bar");
    expect(config.server.fs.deny).toContain("**/build/**");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const [url, method] of [["/__local_accounts", "GET"], ["/__local_accounts/toolbar.js", "GET"], ["/__local_accounts/switch", "POST"]]) {
      const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
      await middleware({ url, method, headers: { host: "127.0.0.1:5174", origin: "http://127.0.0.1:5174", "content-type": "application/json" } } as IncomingMessage, res as unknown as ServerResponse, vi.fn());
      expect(res.statusCode).toBe(404);
    }
    expect(files.readFileSync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enables the toolbar only with explicit opt-in, credentials and the review port", () => {
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");
    expect(configure().html).toContain("local-account-bar");
    expect(configure(5175).html).not.toContain("local-account-bar");
    files.existsSync.mockReturnValue(false);
    expect(configure().html).not.toContain("local-account-bar");
  });

  it("retains the loopback host restriction even when explicitly enabled", async () => {
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");
    const { middleware } = configure();
    const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
    await middleware({ url: "/__local_accounts", method: "GET", headers: { host: "uat.example:5174" } } as IncomingMessage, res as unknown as ServerResponse, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(files.readFileSync).not.toHaveBeenCalled();
  });
  it.each(["127.0.0.1:5174", "localhost:5174"])("loads the toolbar script on local host %s", async host => {
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");
    const {middleware}=configure();
    const res={statusCode:200,setHeader:vi.fn(),end:vi.fn()};
    await middleware({url:"/__local_accounts/toolbar.js",method:"GET",headers:{host}} as IncomingMessage,res as unknown as ServerResponse,vi.fn());
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type","text/javascript");
    expect(res.end.mock.calls[0][0]).toContain("AbortSignal.timeout(10000)");
  });
  it("rejects a mismatched switching origin even on localhost",async()=>{
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");
    files.readFileSync.mockReturnValue(JSON.stringify({accounts:[]}));
    const {middleware}=configure(),res={statusCode:200,setHeader:vi.fn(),end:vi.fn()};
    await middleware({url:"/__local_accounts/switch",method:"POST",headers:{host:"localhost:5174",origin:"http://127.0.0.1:5174","content-type":"application/json"}} as IncomingMessage,res as unknown as ServerResponse,vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("canonicalizes same-origin localhost review requests before the API proxy",async()=>{
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");const {middleware}=configure();
    const req={url:"/api/v1/auth/session",method:"POST",headers:{host:"localhost:5174",origin:"http://localhost:5174","sec-fetch-site":"same-origin"}} as IncomingMessage;
    const next=vi.fn();await middleware(req,{} as ServerResponse,next);expect(next).toHaveBeenCalled();expect(req.headers.origin).toBe("http://127.0.0.1:5174");
  });
  it.each(["http://foreign.invalid","http://localhost:5175"])("does not normalize untrusted origin %s",async origin=>{
    vi.stubEnv("BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER", "true");const {middleware}=configure();
    const req={url:"/api/v2/staff",method:"POST",headers:{host:"localhost:5174",origin}} as IncomingMessage;
    await middleware(req,{} as ServerResponse,vi.fn());expect(req.headers.origin).toBe(origin);
  });

});
