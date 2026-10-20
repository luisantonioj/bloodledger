// Buno's freehand pages: find columns and written lines, group lines in tens (heading/value pairs in label order),
// keep the value lines. Card positions per photo were read from the photos.
import sharp from 'sharp';
import {writeFileSync} from 'node:fs';
const FIELDS = ['collectedAt', 'bloodType', 'donationNumber', 'expiresAt', 'componentType'];
const PHOTOS = {
  'photos/buno-writer01-sheet.webp': {style: 'neat', columns: [['HW-01', 'HW-04', 'HW-07'], ['HW-10', 'HW-13', 'HW-16'], ['HW-19', 'HW-22']], joinGap: 0.002},
  'jpg/buno1.jpg': {style: 'neat-cursive', columns: [['HW-20'], ['HW-23']]},
  'jpg/buno2.jpg': {style: 'rushed', columns: [['HW-14', 'HW-17']], joinGap: 0.002},
  'jpg/buno3.jpg': {style: 'neat', columns: [['HW-08', 'HW-11']]},
  'jpg/buno4.jpg': {style: 'upright', columns: [['HW-02', 'HW-05']], joinGap: 0.002},
};
const out = [], debug = process.env.DEBUG;
for (const [photo, {style, columns}] of Object.entries(PHOTOS)) {
  const src = '../' + photo, base = sharp(src).rotate().grayscale();
  const {width: W, height: H} = await base.metadata();
  const g = await base.clone().raw().toBuffer(), bg = await base.clone().blur(30).raw().toBuffer();
  const ink = (x, y) => g[y * W + x] < bg[y * W + x] - 40;
  // Ignore the dark table border: only count columns whose ink is sparse.
  const colInk = Array.from({length: W}, (_, x) => { let n = 0; for (let y = 0; y < H; y += 3) n += ink(x, y); return n / (H / 3); });
  const cols = []; let s = -1, gap = 0; const minGap = Math.round(W * 0.03);
  for (let x = 0; x < W; x++) { const on = colInk[x] > 0.01 && colInk[x] < 0.35; if (on) { if (s < 0) s = x; gap = 0; } else if (s >= 0 && ++gap > minGap) { cols.push([s, x - gap]); s = -1; } }
  if (s >= 0) cols.push([s, W - 1]);
  // Drop the dark photo border at either edge and trim its blurred fringe from an edge column.
  const textCols = cols.filter(([a, b]) => b - a > W * 0.08 && a < W * 0.9).map(([a, b]) => [a < W * 0.04 ? a + Math.round(W * 0.04) : a, b]);
  if (textCols.length !== columns.length) { console.log(photo, 'COLUMNS', textCols.length, 'expected', columns.length, JSON.stringify(textCols)); continue; }
  for (const [ci, [x0, x1]] of textCols.entries()) {
    const rowInk = Array.from({length: H}, (_, y) => { let n = 0; for (let x = x0; x <= x1; x++) n += ink(x, y); return n; });
    const bands = []; let a = -1, gg = 0; const minRow = Math.max(3, Math.round((x1 - x0) * 0.004)), joinGap = Math.round(H * (PHOTOS[photo].joinGap ?? 0.006));
    for (let y = 0; y < H; y++) { if (rowInk[y] > minRow) { if (a < 0) a = y; gg = 0; } else if (a >= 0 && ++gg > joinGap) { bands.push([a, y - gg]); a = -1; } }
    if (a >= 0) bands.push([a, H - 1]);
    const lines = bands.filter(([p, q]) => q - p > H * 0.008);
    const cards = columns[ci];
    if (debug || lines.length !== cards.length * 10) console.log(photo, 'col', ci, 'lines', lines.length, 'expected', cards.length * 10);
    if (lines.length !== cards.length * 10) continue;
    for (const [k, card] of cards.entries()) for (let f = 0; f < 5; f++) {
      const [y0, y1] = lines[k * 10 + f * 2 + 1];
      const pad = Math.round((y1 - y0) * 0.25);
      const file = `crops/buno-${card}-${FIELDS[f]}.png`;
      await sharp(src).rotate().extract({left: Math.max(0, x0 - 10), top: Math.max(0, y0 - pad), width: Math.min(W, x1 + 10) - Math.max(0, x0 - 10), height: Math.min(H, y1 + pad) - Math.max(0, y0 - pad)}).png().toFile('../' + file);
      out.push({source: 'buno', card, field: FIELDS[f], style, file});
    }
  }
}
writeFileSync('../crops/buno-crops.json', JSON.stringify(out, null, 1), {mode: 0o600});
console.log('crops', out.length);
