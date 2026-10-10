// FR-12 / ADR-036: ordinary primary cookies and per-command operator grants.
import { requireStock } from './stock-plan.mjs';
export class InstitutionClient {
  constructor(config, apiUrl, fetcher = fetch) {
    requireStock(/^http:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal|bloodledger-persistent-api):3000$/.test(apiUrl), 'STOCK_LOCAL_API_REQUIRED');
    this.config = config; this.apiUrl = apiUrl; this.fetcher = fetcher; this.sessions = new Map();
  }
  async response(path, method, payload, headers = {}) {
    // A JSON content type without a body is rejected before the route runs (for example, logout).
    const result = await this.fetcher(this.apiUrl + path, { method, headers: { Origin: 'http://127.0.0.1:5174', ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-BloodLedger-Contract-Version': 'V2.1', ...headers }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    const body = await result.json();
    if (!result.ok) throw new Error(body.error?.code ?? 'STOCK_HTTP_FAILED');
    return { result, body };
  }
  async session(name) {
    const previous = this.sessions.get(name);
    if (previous && Date.now() - previous.at < 720_000) return previous;
    const account = this.config.accounts?.[name];
    requireStock(account && typeof account.username === 'string' && typeof account.password === 'string', 'STOCK_PRIVATE_ACCOUNT_REQUIRED');
    const { result, body } = await this.response('/api/v1/auth/session', 'POST', { username: account.username, password: account.password });
    const cookie = result.headers.get('set-cookie')?.split(';')[0];
    const principal = body.principal;
    const operator = principal?.operators?.find(o => o.operatorId === account.operatorId);
    requireStock(cookie && principal?.verificationRequired === true && principal.accountState === 'ACTIVE' && principal.accountId && principal.accountCategory === 'BLOOD_BANK' && operator?.roleId === 'ROLE-02', 'STOCK_PRIMARY_OPERATOR_REQUIRED');
    const institutionId = name === 'coordinator' ? 'INST_MEDIATRIX' : 'INST_SYNTH_MEDIX';
    requireStock(principal.institutionId === institutionId, 'STOCK_ACCOUNT_INSTITUTION_MISMATCH');
    const session = { cookie, principal, operator, at: Date.now() }; this.sessions.set(name, session); return session;
  }
  async read(name, path) {
    const session = await this.session(name);
    return (await this.response(path, 'GET', undefined, { Cookie: session.cookie })).body;
  }
  async command(name, path, payload, idempotencyKey) {
    const session = await this.session(name), account = this.config.accounts[name];
    requireStock(/^[0-9]{8}$/.test(account.pin ?? ''), 'STOCK_PRIVATE_PIN_REQUIRED');
    const verification = await this.response('/api/v2/auth/operator-verifications', 'POST', { operatorId: session.operator.operatorId, pin: account.pin, action: 'POST ' + path, payload, idempotencyKey }, { Cookie: session.cookie });
    requireStock(typeof verification.body.verificationId === 'string', 'STOCK_OPERATOR_GRANT_REQUIRED');
    return (await this.response(path, 'POST', payload, { Cookie: session.cookie, 'Idempotency-Key': idempotencyKey, 'Operator-Verification': verification.body.verificationId })).body;
  }
  async close() {
    for (const session of this.sessions.values()) await this.response('/api/v1/auth/session', 'DELETE', undefined, { Cookie: session.cookie }).catch(() => undefined);
    this.sessions.clear();
  }
}
