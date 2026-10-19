// Aggregate predictions: per model and source, field exact match, character error rate, grammar-valid rate, and
// the dangerous case: a read that passes the field grammar but is wrong.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
const norm = s => (s ?? '').toUpperCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').replace(/[.,]$/, '').trim();
const GRAMMAR = {collectedAt: /^(1[0-2]|[1-9])-(3[01]|[12][0-9]|[1-9])-[0-9]{2}$/, expiresAt: /^(1[0-2]|[1-9])-(3[01]|[12][0-9]|[1-9])-[0-9]{2}$/,
  bloodType: /^(A|B|AB|O) (POSITIVE|NEGATIVE)$/, donationNumber: /^MM[0-9]{2}-(0[1-9]|1[0-2])-[0-9]{4}$/, componentType: /^(WB|PRBC|FFP|PLT|CRYO)$/};
const FIELDS = Object.keys(GRAMMAR);
const files = readdirSync('..').filter(f => /^pred-.*\.json$/.test(f));
const table = [];
for (const f of files) {
  const {model: raw, rows} = JSON.parse(readFileSync('../' + f, 'utf8')); const model = raw.startsWith('file:') ? raw.replace(/^file:..\/|\.json$/g, '') : raw;
  const source = f.includes('-lat-') ? 'lat' : 'buno';
  const scored = rows.filter(r => r.exact !== undefined);
  const stat = rs => ({n: rs.length, exact: rs.filter(r => r.exact).length, cer: +(rs.reduce((a, r) => a + Math.min(1, r.cer), 0) / Math.max(1, rs.length)).toFixed(3),
    valid: rs.filter(r => GRAMMAR[r.field].test(norm(r.text))).length, validWrong: rs.filter(r => GRAMMAR[r.field].test(norm(r.text)) && !r.exact).length});
  const cards = [...new Set(rows.map(r => r.card))];
  const cardsAll = cards.filter(c => { const rs = scored.filter(r => r.card === c); return rs.length === 5 && rs.every(r => r.exact); }).length;
  table.push({model, source, overall: stat(scored), fields: Object.fromEntries(FIELDS.map(k => [k, stat(scored.filter(r => r.field === k))])), cards: cards.length, cardsAllFieldsExact: cardsAll,
    medianMs: rows.map(r => r.ms).sort((a, b) => a - b)[rows.length >> 1]});
}
writeFileSync('../summary.json', JSON.stringify(table, null, 1), {mode: 0o600});
for (const t of table) {
  console.log(`\n${t.source.toUpperCase()} · ${t.model} · fields exact ${t.overall.exact}/${t.overall.n} (${(100 * t.overall.exact / t.overall.n).toFixed(0)}%) · mean CER ${t.overall.cer} · valid-but-wrong ${t.overall.validWrong} · whole cards ${t.cardsAllFieldsExact}/${t.cards} · ${t.medianMs} ms/field`);
  for (const k of FIELDS) { const s = t.fields[k]; console.log(`   ${k.padEnd(15)} ${String(s.exact).padStart(2)}/${s.n}  CER ${s.cer}  valid ${s.valid}  valid-but-wrong ${s.validWrong}`); }
}
