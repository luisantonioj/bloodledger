// Trim each value crop to its ink: drop ruled lines (rows mostly dark) and blank margins, keep a small pad.
import sharp from 'sharp';
import {readFileSync, writeFileSync} from 'node:fs';
for (const list of ['../crops/lat-crops.json', '../crops/buno-crops.json']) {
  const crops = JSON.parse(readFileSync(list, 'utf8'));
  for (const c of crops) {
    const src = '../' + c.file, out = src.replace('.png', '.trim.png');
    const img = sharp(src).grayscale(); const {width: W, height: H} = await img.metadata();
    const g = await img.clone().raw().toBuffer(), bg = await img.clone().blur(Math.max(3, Math.round(H / 3))).raw().toBuffer();
    const ink = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) ink[i] = g[i] < bg[i] - 35 ? 1 : 0;
    const row = y => { let n = 0; for (let x = 0; x < W; x++) n += ink[y * W + x]; return n / W; };
    for (let y = 0; y < H; y++) if (row(y) > 0.35) for (let x = 0; x < W; x++) ink[y * W + x] = 0;   // ruled box lines
    for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) n += ink[y * W + x]; if (n / H > 0.6) for (let y = 0; y < H; y++) ink[y * W + x] = 0; } // vertical borders
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    // Ignore specks: a column/row counts only with at least 2 ink pixels.
    for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) n += ink[y * W + x]; if (n >= 2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
    for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) n += ink[y * W + x]; if (n >= 2) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    if (x1 < 0) { c.trimFile = c.file; c.trimEmpty = true; continue; }
    const pad = Math.round((y1 - y0) * 0.3) + 8;
    const L = Math.max(0, x0 - pad), T = Math.max(0, y0 - pad), R = Math.min(W, x1 + pad), B = Math.min(H, y1 + pad);
    await sharp(src).extract({left: L, top: T, width: R - L, height: B - T}).png().toFile(out);
    c.trimFile = c.file.replace('.png', '.trim.png');
  }
  writeFileSync(list.replace('.json', '-trim.json'), JSON.stringify(crops.map(c => ({...c, file: c.trimFile})), null, 1), {mode: 0o600});
  console.log(list, crops.length, 'empty', crops.filter(c => c.trimEmpty).length);
}
