// BL-TST-01 / NFR-11: real local login, institution scope, keyboard access and origin denial.
import assert from 'node:assert/strict';
import { chromium, expect, request } from '@playwright/test';
import { readFileSync } from 'node:fs';

const base = 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const anonymous = await request.newContext();
try {
  const page = await context.newPage();
  await page.goto(base);
  const bar = page.getByRole('complementary', { name: 'Temporary local account switcher' });
  const select = page.getByLabel('Switch local account', { exact: true });
  await expect(bar).toBeVisible();
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(7);
  await select.focus();
  await expect(select).toBeFocused();
  const accounts = await (await context.request.get(base + '/__local_accounts')).json();
  const exposed = await page.content() + JSON.stringify(accounts) + await (await context.request.get(base + '/__local_accounts/toolbar.js')).text();
  const privateFile = JSON.parse(readFileSync(new URL('../../build/accounts/private.json', import.meta.url), 'utf8'));
  assert(Object.values(privateFile.passwords).every(password => !exposed.includes(password)), 'Credentials must remain server-side');
  assert.equal((await context.request.get(base + '/@fs/workspace/build/accounts/private.json')).status(), 403);
  let priorCookie;
  for (const account of accounts) {
    await Promise.all([page.waitForEvent('domcontentloaded'), select.selectOption(account.accountId)]);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(select).toHaveValue(account.accountId);
    const session = await context.request.get(base + '/api/v1/auth/session');
    assert.equal(session.status(), 200);
    assert.equal((await session.json()).principal.accountId, account.accountId);
    const cardLabels = {
      'Blood bank facility': ['Total Blood Units', 'Expiring Soon', 'Low Stock', 'Pending Requests'],
      'Requestor facility': ['Submitted Requests', 'Awaiting Review', 'On the Way', 'Received'],
      'PRC administrator': ['Participating Blood Banks', 'Redistributable Supply', 'Critical Blood Types', 'Open Supply Requests'],
      'DOH regulatory officer': ['Monitored Blood Banks', 'Fully Compliant', 'Reports Due', 'Late Submissions'],
    };
    await expect(page.locator('.dashboard-stats article > span')).toHaveText(cardLabels[account.category]);
    if (account.category === 'Blood bank facility') {
      for (const index of [1, 2, 3]) await expect(page.locator('.dashboard-stats article > strong').nth(index)).toHaveAttribute('aria-label', 'Unavailable');
    } else {
      await expect(page.locator('.dashboard-stats article > strong')).toHaveText(['—', '—', '—', '—']);
    }
    if (account.category === 'Requestor facility') {
      await expect(page.getByRole('heading', { name: 'My Requests', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Network Blood Availability', exact: true })).toBeVisible();
      await expect(page.locator('.inventory-overview-card')).toHaveCount(0);
    } else {
      await expect(page.locator('.requester-dashboard-grid')).toHaveCount(0);
    }
    await expect(page.locator('.dashboard-stats article > small')).toHaveCount(0);
    await expect(page.locator('.dashboard-evidence')).toHaveCount(0);
    await expect(page.locator('.dashboard-aggregate-table,.dashboard-table-head')).toHaveCount(0);
    await expect(page.locator('.dashboard-actions')).toContainText('Last updated:');
    assert(await page.locator('.dashboard-stats article').evaluateAll(elements => elements.every(element => ['none', 'normal'].includes(getComputedStyle(element, '::before').content))), 'Summary cards must have no colored edge decoration');
    const cookie = (await context.cookies()).find(c => c.name === 'bloodledger_session');
    assert(cookie?.httpOnly, 'Normal HttpOnly session must be retained');
    if (priorCookie) {
      const revoked = await anonymous.get(base + '/api/v1/auth/session', { headers: { Cookie: `bloodledger_session=${priorCookie}` } });
      assert.equal(revoked.status(), 401, 'Previous account session must be revoked');
    }
    priorCookie = cookie.value;
    const geometry = await page.evaluate(() => ({ bar: document.getElementById('local-account-bar').getBoundingClientRect().bottom, side: document.querySelector('.side').getBoundingClientRect().top }));
    assert(geometry.side >= geometry.bar - 1, 'Bar must not cover sidebar');
    console.log('PASS', account.label);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(select).toBeVisible();
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  await expect(refresh).toBeVisible();
  const actionsFit = await page.locator('.dashboard-actions').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth;
  });
  assert(actionsFit, 'Timestamp and refresh must fit a narrow viewport');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'Account bar must fit narrow screens');
  assert.equal((await context.request.post(base + '/__local_accounts/switch', { headers: { Origin: 'http://untrusted.invalid' }, data: { accountId: accounts[0].accountId } })).status(), 403);
  assert.equal((await context.request.post(base + '/__local_accounts/switch', { headers: { Origin: base }, data: { accountId: 'UNKNOWN' } })).status(), 400);
  assert.equal((await context.request.delete(base + '/__local_accounts/switch', { headers: { Origin: base } })).status(), 405);
  console.log('PASS keyboard, narrow viewport, credential isolation, prior-session revocation and rejected requests');
} finally {
  await context.request.delete(base + '/api/v1/auth/session', { headers: { Origin: base } }).catch(() => undefined);
  await anonymous.dispose();
  await browser.close();
}
