// Cut the five handwritten values out of each printed card: find the right-hand box lines, then drop the printed
// heading (first ink band) inside each box. Fields follow the printed order.
import sharp from 'sharp';
import {writeFileSync} from 'node:fs';
const FIELDS = ['collectedAt', 'bloodType', 'donationNumber', 'expiresAt', 'componentType'];
const out = []; const THR = Number(process.env.THR ?? 0.35);
for (let i = 1; i <= 24; i++) {
  const n = String(i).padStart(2, '0'), src = `../jpg/lat-hw-${n}.jpg`;
  const img = sharp(src).grayscale(); const {width: W, height: H} = await img.metadata();
  const g = await img.clone().raw().toBuffer(), bg = await img.clone().blur(25).raw().toBuffer();
  const dark = (x, y) => g[y * W + x] < bg[y * W + x] - 35;
  const xa = Math.round(W * 0.42), xb = Math.round(W * 0.92);
  const rowDark = Array.from({length: H}, (_, y) => { let c = 0; for (let x = xa; x < xb; x += 2) c += dark(x, y); return c / ((xb - xa) / 2); });
  const lines = []; for (let y = 0; y < H; y++) if (rowDark[y] > THR) { if (lines.length && y - lines.at(-1)[1] <= 8) lines.at(-1)[1] = y; else lines.push([y, y]); }
  const ys = lines.map(([a, b]) => Math.round((a + b) / 2));
  // Keep the 6 lines whose spacing is most regular (box top, 4 separators, bottom).
  let best = null;
  for (let s = 0; s + 5 < ys.length; s++) { const seg = ys.slice(s, s + 6), gaps = seg.slice(1).map((v, k) => v - seg[k]); const spread = Math.max(...gaps) - Math.min(...gaps);
    if (Math.min(...gaps) > H * 0.08 && (!best || spread < best.spread)) best = {seg, spread}; }
  // A faint outer border can be missed: infer it from five evenly spaced lines.
  if (!best && ys.length === 5) { const gap = Math.round((ys[4] - ys[0]) / 4); const seg = ys[0] - gap >= 0 ? [ys[0] - gap, ...ys] : [...ys, ys[4] + gap]; if (seg[5] < H) best = {seg, spread: 0, inferred: true}; }
  if (!best) { console.log('HW-' + n, 'BOX_LINES_NOT_FOUND', ys.join(',')); continue; }
  if (process.env.DEBUG) console.log('HW-' + n, 'lines', best.seg.join(','), 'H', H);
  if (best.inferred) console.log('HW-' + n, 'one box line inferred');
  // Left edge of the right box: first strong vertical line left of xa.
  const colDark = x => { let c = 0; for (let y = best.seg[0]; y < best.seg[5]; y += 2) c += dark(x, y); return c / ((best.seg[5] - best.seg[0]) / 2); };
  // The value box's left border is the rightmost strong vertical line left of the value area.
  let x0 = null; for (let x = xa; x > W * 0.2; x--) if (colDark(x) > 0.42) { x0 = x + 8; break; }
  // Faint border: fall back to the position measured on the other cards (about a third of the width).
  if (x0 === null) { x0 = Math.round(W * 0.335); console.log('HW-' + n, 'box left border estimated'); }
  for (let f = 0; f < 5; f++) {
    const top = best.seg[f] + 5, bot = best.seg[f + 1] - 5;
    // Fixed card geometry: the printed heading sits in the top 30% of each box, the handwritten value below it.
    // (Ink-band detection judged short values such as WB lighter than the heading, so it is not used.)
    const vtop = top + Math.round((bot - top) * 0.3), vbot = bot;
    const file = `../crops/lat-HW-${n}-${FIELDS[f]}.png`;
    await sharp(src).extract({left: x0, top: vtop, width: Math.round(W * 0.97) - x0, height: Math.max(20, vbot - vtop)}).png().toFile(file);
    out.push({source: 'lat', card: 'HW-' + n, field: FIELDS[f], file: file.replace('../', '')});
  }
}
writeFileSync('../crops/lat-crops.json', JSON.stringify(out, null, 1), {mode: 0o600});
console.log('crops', out.length);
