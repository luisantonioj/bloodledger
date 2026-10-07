import assert from "node:assert/strict";
import test from "node:test";
import { HISTORICAL_BLOOD_TYPES, HISTORICAL_COMPONENT_TYPES, makeHistoricalManifest, validateHistoricalManifest } from "../src/historical-model";
export function source() { return { workbookSha256: "a".repeat(64), businessDate: "2026-01-02", counts: HISTORICAL_BLOOD_TYPES.flatMap(bloodType => HISTORICAL_COMPONENT_TYPES.map(componentType => ({ bloodType, componentType, available: 1, reserved: 1, closing: 2 }))) }; }
test("FR-14 historical generation preserves all series, counts, unknowns and deterministic identity", () => {
  const input = source(), a = makeHistoricalManifest(input);
  assert.deepEqual(a, makeHistoricalManifest({...input, counts:[...input.counts].reverse()}));
  assert.equal(a.units.length,40); assert.equal(a.units.filter(u=>u.snapshotStatus==="RESERVED").length,20);
  assert.ok(a.units.every(u=>u.expiresAt===null&&u.donationNumber===null));
  assert.deepEqual(validateHistoricalManifest(a),a);
  assert.notEqual(makeHistoricalManifest({...input,workbookSha256:"b".repeat(64)}).snapshotId,a.snapshotId);
  assert.throws(()=>validateHistoricalManifest({...a,units:a.units.slice(1)}));
});
test("FR-14 rejects missing, duplicate, unbalanced, fractional, negative and wrong source rows", () => {
  const input=source();
  assert.throws(()=>makeHistoricalManifest({...input, counts:input.counts.slice(1)}));
  assert.throws(()=>makeHistoricalManifest({...input, counts:input.counts.map(()=>input.counts[0])}));
  for(const available of [-1,0.5,NaN,3]) assert.throws(()=>makeHistoricalManifest({...input,counts:input.counts.map((r,i)=>i===0?{...r,available}:r)}));
  assert.throws(()=>makeHistoricalManifest({...input,businessDate:"2026-02-30"}));
  assert.throws(()=>makeHistoricalManifest({...input,workbookSha256:"wrong"}));
  const zero=makeHistoricalManifest({...input,counts:input.counts.map(r=>({...r,available:0,reserved:0,closing:0}))});
  assert.equal(zero.units.length,0); assert.equal(zero.counts.length,20);
});
