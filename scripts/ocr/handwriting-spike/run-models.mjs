// Run each OCR model on every value crop and score against what is written (answer key = as-written values).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pipeline, env, RawImage} from '@huggingface/transformers';
env.cacheDir = new URL('./models/', import.meta.url).pathname; env.allowRemoteModels = process.env.ALLOW_DOWNLOAD === '1';
const require = createRequire('/home/luisantonioj/projects/bloodledger/package.json');
const {createWorker, OEM} = require('tesseract.js');
const [cropsFile, model, outFile] = process.argv.slice(2);
const crops = JSON.parse(readFileSync(cropsFile, 'utf8'));
const cards = JSON.parse(readFileSync('../cards.json', 'utf8')).cards;
const truthOverrides = JSON.parse(readFileSync('../truth-overrides.json', 'utf8'));
const truth = (src, card, field) => { const o = truthOverrides[`${src}:${card}:${field}`]; if (o !== undefined) return o; return cards.find(c => c.cardId === card).write[field]; };
const norm = s => (s ?? '').toUpperCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').replace(/[.,]$/, '').trim();
const lev = (a, b) => { const d = Array.from({length: a.length + 1}, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
let read;
if (model.startsWith('file:')) {
  // Precomputed reads from an external engine (PaddleOCR): {file: [text, score, ms]}.
  const pre = JSON.parse(readFileSync(model.slice(5), 'utf8'));
  read = async file => { const [text, score] = pre[file.replace('../', '')] ?? ['', 0]; return {text, confidence: Math.round(score * 100)}; };
} else if (model === 'tesseract') {
  const w = await createWorker('eng', OEM.LSTM_ONLY, {langPath: '/home/luisantonioj/projects/bloodledger/apps/capture-pwa/public/ocr-assets/lang', cacheMethod: 'none', logger: () => {}});
  await w.setParameters({tessedit_pageseg_mode: '7'});
  read = async file => { const r = await w.recognize(file); return {text: r.data.text.trim(), confidence: Math.round(r.data.confidence)}; };
} else {
  const [id, dtype] = model.split('@');
  const ocr = await pipeline('image-to-text', id, {dtype: dtype ?? 'fp32'});
  read = async file => ({text: (await ocr(await RawImage.read(file), {max_new_tokens: 24}))[0].generated_text.trim(), confidence: null});
}
const rows = [];
for (const c of crops) {
  const expected = truth(c.source, c.card, c.field);
  const t = performance.now(); const {text, confidence} = await read('../' + c.file); const ms = Math.round(performance.now() - t);
  const row = {...c, expected, text, confidence, ms};
  if (expected !== null) { const e = norm(expected), p = norm(text); row.exact = e === p; row.cer = +(lev(e, p) / Math.max(1, e.length)).toFixed(3); }
  rows.push(row);
}
writeFileSync(outFile, JSON.stringify({model, rows}, null, 1), {mode: 0o600});
const scored = rows.filter(r => r.exact !== undefined);
const by = {}; for (const r of scored) (by[r.field] ??= []).push(r);
console.log(model, 'exact', scored.filter(r => r.exact).length + '/' + scored.length, 'meanCER', (scored.reduce((a, r) => a + r.cer, 0) / scored.length).toFixed(3), 'median ms', rows.map(r => r.ms).sort((a, b) => a - b)[rows.length >> 1]);
for (const [f, rs] of Object.entries(by)) console.log('  ', f.padEnd(15), rs.filter(r => r.exact).length + '/' + rs.length, 'CER', (rs.reduce((a, r) => a + r.cer, 0) / rs.length).toFixed(3));
process.exit(0);
