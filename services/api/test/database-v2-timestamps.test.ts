// TP-JOP-D21 / FR-12 / NFR-05: component reads keep the exact ledger instant.
import assert from 'node:assert/strict';
import test from 'node:test';
import {utcIso} from '../src/database-v2.js';
test('TP-JOP-D21: a pg Date keeps its milliseconds in projection reads',()=>{
  assert.equal(utcIso(new Date('2026-10-19T14:12:53.417Z')),'2026-10-19T14:12:53.417Z');
  assert.equal(utcIso(new Date('2026-10-17T00:00:00.000Z')),'2026-10-17T00:00:00.000Z');
});
test('TP-JOP-D21: string timestamps still normalize to UTC ISO',()=>{
  assert.equal(utcIso('2026-10-19 14:12:53.417+00'),'2026-10-19T14:12:53.417Z');
});
