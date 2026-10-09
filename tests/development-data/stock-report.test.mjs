// TP-STOCK-01 / NFR-05: reject missing final evidence destination before runtime access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../../scripts/development-data/stock-cli.mjs';

test('NFR-05: execution report destination is required before reading private config or opening the target', async () => {
  for (const action of ['apply', 'resume', 'verify']) {
    await assert.rejects(main([action]), /STOCK_REPORT_REQUIRED/);
    await assert.rejects(main([action, '--output', '/tmp/unused-stock-report.json']), /STOCK_REPORT_REQUIRED/);
    await assert.rejects(main([action, '--report', '/tmp/unused-stock-report.json', '--output', '/tmp/unused-stock-preview.json']), /STOCK_REPORT_REQUIRED/);
  }
});
