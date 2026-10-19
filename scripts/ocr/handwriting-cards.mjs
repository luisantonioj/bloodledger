// Handwriting OCR spike (2026-10-18), SIMULATION_ONLY. Generates 24 fictional Mediatrix-like cards to be written by
// hand: blank printable cards (headings only, so OCR sees only handwriting), separate per-writer prompt pages, and
// the expected values for scoring. Outputs stay in an ignored private folder.
//   node scripts/ocr/handwriting-cards.mjs --output build/ocr-private/handwriting-spike-20261018
// Render the PDF with the pinned Playwright image (see scripts/ocr/README.md): add --pdf.
import {chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const output = resolve(args[args.indexOf('--output') + 1] ?? '');
if (!args.includes('--output') || !(output.startsWith(resolve(root, 'build') + '/') || output.startsWith('/tmp/'))) throw Error('--output must be under ignored build/ or /tmp/');
const layout = JSON.parse(readFileSync(resolve(root, 'contracts/synthetic-label-layout-v1.json'), 'utf8'));
const profile = layout.profiles.find(p => p.id === 'SYN_MEDIATRIX_LAYOUT');
if (!profile) throw Error('SYN_MEDIATRIX_LAYOUT missing');

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SPOKEN = {'A+': 'A Positive', 'A-': 'A Negative', 'B+': 'B Positive', 'B-': 'B Negative', 'AB+': 'AB Positive', 'AB-': 'AB Negative', 'O+': 'O Positive', 'O-': 'O Negative'};
// Synthetic collection-to-expiry gaps in days; not shelf-life policy (RQ-03 stays open).
const COMPONENTS = [['WB', 35], ['PRBC', 42], ['FFP', 365], ['PLT', 5], ['CRYO', 365]];
const day = ms => new Date(ms).toISOString().slice(0, 10);
// The reference label's handwritten convention: month-day-two-digit-year, no leading zeros (for example 9-30-26).
const short = iso => { const [y, m, d] = iso.split('-'); return `${+m}-${+d}-${y.slice(2)}`; };

// Spike-only layout that follows how the reference bag label is filled in: field order, generic heading words,
// value written below each heading, spoken blood type and M-D-YY dates. It copies no branding, logo, screening
// sticker, manufacturer text, barcode or lot number (PA-OCR-01). Component is an extra box BloodLedger needs.
const FIELDS = [['collectedAt', 'Collection Date'], ['bloodType', 'ABO/Rh Type'], ['donationNumber', 'Donation No.'], ['expiresAt', 'Expiry Date'], ['componentType', 'Component']];
const cards = [];
for (let i = 0; i < 24; i++) {
  const blood = BLOOD[i % 8];
  const [code, gap] = COMPONENTS[i % 5];
  // Every expiry falls after the 2026-10-21 defense; a third of the units were collected in September.
  const collected = code === 'PLT' ? Date.UTC(2026, 9, 17 + (i % 4)) : i % 3 === 0 ? Date.UTC(2026, 8, 20 + (i % 10)) : Date.UTC(2026, 9, 1 + (i % 21));
  const collectedAt = day(collected), expiresAt = day(collected + gap * 86_400_000);
  const donationNumber = `MM26-${collectedAt.slice(5, 7)}-${9201 + i}`;
  cards.push({cardId: `HW-${String(i + 1).padStart(2, '0')}`, writer: `WRITER_0${1 + (i % 3)}`, donationNumber,
    bloodType: layout.bloodTypeForms[blood], componentType: layout.componentForms[code], collectedAt, expiresAt, datePrecision: 'DATE',
    write: {collectedAt: short(collectedAt), bloodType: SPOKEN[blood], donationNumber, expiresAt: short(expiresAt), componentType: code}});
}
if (new Set(cards.flatMap(c => c.donationNumber.replace(/\D/g, '').split(''))).size !== 10) throw Error('Digit coverage incomplete');
if (new Set(cards.map(c => c.bloodType)).size !== 8 || new Set(cards.map(c => c.componentType)).size !== 5) throw Error('Coverage incomplete');

const blank = c => `<section class="card"><div class="left"><div class="marker">${layout.marker}</div><div class="bank">${profile.bankLine}</div><div class="id">${c.cardId}</div><div class="cap">Handwriting OCR spike · fictional values</div></div>
<div class="right">${FIELDS.map(([, h]) => `<div class="box"><div class="h">${h}</div><div class="write"></div></div>`).join('')}</div></section>`;
const writers = [...new Set(cards.map(c => c.writer))];
const prompt = w => `<section class="prompt"><h2>${w} — what to write</h2>
<p>Write in your normal handwriting with a dark pen, inside the box under each heading on the card with the matching ID, the way a blood bank label is filled in. Copy the values exactly. Do not write your name. These values are fictional.</p>
<table><tr><th>Card</th>${FIELDS.map(([, h]) => `<th>${h}</th>`).join('')}</tr>
${cards.filter(c => c.writer === w).map(c => `<tr><td>${c.cardId}</td>${FIELDS.map(([k]) => `<td>${c.write[k]}</td>`).join('')}</tr>`).join('')}</table></section>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handwriting OCR spike cards</title><style>
@page{size:A4 portrait;margin:10mm}body{margin:0;font-family:Arial,"Liberation Sans","DejaVu Sans",sans-serif;color:#000;background:#fff}
.card{break-inside:avoid;display:flex;gap:4mm;border:1px dashed #999;width:186mm;box-sizing:border-box;padding:4mm;margin:0 0 5mm}
.left{width:52mm;border:1px solid #000;padding:3mm;box-sizing:border-box;font-size:9pt}.marker{font-weight:700}.bank{margin-top:3mm;font-weight:700}.id{margin-top:3mm;font-size:12pt;font-weight:700}.cap{margin-top:3mm;color:#444}
.right{flex:1;border:1px solid #000}.box{border-bottom:1px solid #000;height:15mm;padding:1mm 2mm;box-sizing:border-box}.box:last-child{border-bottom:none}.h{font-size:9pt}
.prompt{break-before:page}table{border-collapse:collapse;font-size:11pt;width:100%}th,td{border:1px solid #666;padding:2mm}
</style></head><body>${cards.map(blank).join('\n')}${writers.map(prompt).join('\n')}</body></html>`;

if (existsSync(resolve(output, 'cards.json'))) throw Error('Refusing to overwrite an existing card set');
mkdirSync(output, {recursive: true, mode: 0o700});
const meta = {classification: 'SIMULATION_ONLY', purpose: 'Handwriting OCR spike pilot; fictional values, not Buno corpus',
  layout: {id: 'SPIKE_MEDIATRIX_LIKE_HANDWRITTEN', version: '1', note: 'Spike only. Follows the reference label fill-in convention; copies no branding. Not a PA-OCR-01 profile.'},
  fields: FIELDS.map(([field, heading]) => ({field, heading, placement: 'BELOW'})), cards};
writeFileSync(resolve(output, 'cards.json'), JSON.stringify(meta, null, 2) + '\n', {mode: 0o600});
writeFileSync(resolve(output, 'handwriting-sheets.html'), html, {mode: 0o600});
if (args.includes('--pdf')) {
  const {chromium} = await import('@playwright/test');
  const browser = await chromium.launch();
  try { const page = await browser.newPage(); await page.setContent(html); await page.pdf({path: resolve(output, 'handwriting-sheets.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true}); chmodSync(resolve(output, 'handwriting-sheets.pdf'), 0o600); }
  finally { await browser.close(); }
}
console.log(`cards ${cards.length} → ${output}`);
