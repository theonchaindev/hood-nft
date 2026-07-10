// Extracts an aligned RGBA layer from an AI-edited master:
// pixels that differ from the base master become the layer, everything
// else is transparent. Small specks are removed; edges get soft alpha.
// Usage: npx tsx scripts/extract-layer.mts <edited.png> <base.png> <out.png>

import sharp from "sharp";

const S = 1024;
const [editedPath, basePath, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error("usage: extract-layer.mts <edited.png> <base.png> <out.png>");
  process.exit(1);
}

const load = async (p: string) =>
  (await sharp(p).resize(S, S).raw().toBuffer({ resolveWithObject: true })).data;

const base = await load(basePath);
const edit = await load(editedPath);

// raw per-pixel difference
const HARD = 34, SOFT = 16;
const alpha = new Uint8Array(S * S);
for (let i = 0; i < S * S; i++) {
  const d = Math.max(
    Math.abs(base[i * 3] - edit[i * 3]),
    Math.abs(base[i * 3 + 1] - edit[i * 3 + 1]),
    Math.abs(base[i * 3 + 2] - edit[i * 3 + 2])
  );
  alpha[i] = d >= HARD ? 255 : d >= SOFT ? Math.round(((d - SOFT) / (HARD - SOFT)) * 255) : 0;
}

// remove speckle: keep only pixels with enough solid neighbors (3x3 vote), 2 passes
for (let pass = 0; pass < 2; pass++) {
  const next = new Uint8Array(alpha);
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      if (alpha[i] === 0) continue;
      let solid = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (alpha[i + dy * S + dx] >= 128) solid++;
      if (solid < 4) next[i] = 0;
    }
  }
  alpha.set(next);
}

// base background mask (flat gray flood from corners) for smudge filtering
const bgRef = [base[0], base[1], base[2]];
const isBaseBg = (i: number) =>
  Math.abs(base[i * 3] - bgRef[0]) <= 14 &&
  Math.abs(base[i * 3 + 1] - bgRef[1]) <= 14 &&
  Math.abs(base[i * 3 + 2] - bgRef[2]) <= 14;

// Kill whitish low-contrast repaint wisps that hang off the OUTSIDE of the
// artwork (the AI often leaves pale smudges beside hats/items). A pixel is
// "weak" if it sits over the flat background with a pale, low-saturation,
// low-contrast edit. Weak pixels die only if they can be flooded from the
// transparent outside without crossing a strong pixel — so pale paint that
// is sealed inside a bold outline (e.g. a white coffee cup) survives.
const weak = new Uint8Array(S * S);
for (let i = 0; i < S * S; i++) {
  if (alpha[i] === 0 || !isBaseBg(i)) continue;
  const r = edit[i * 3] / 255, g = edit[i * 3 + 1] / 255, b = edit[i * 3 + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
  const d = Math.max(
    Math.abs(base[i * 3] - edit[i * 3]),
    Math.abs(base[i * 3 + 1] - edit[i * 3 + 1]),
    Math.abs(base[i * 3 + 2] - edit[i * 3 + 2])
  );
  if (l > 0.68 && s < 0.32 && d < 70) weak[i] = 1;
}
const wq: number[] = [];
for (let i = 0; i < S * S; i++) {
  if (!weak[i]) continue;
  const x = i % S, y = (i / S) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= S || ny >= S || alpha[ny * S + nx] === 0) {
      wq.push(i);
      break;
    }
  }
}
const wseen = new Uint8Array(S * S);
for (const i of wq) wseen[i] = 1;
while (wq.length) {
  const i = wq.pop()!;
  alpha[i] = 0;
  const x = i % S, y = (i / S) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
    const ni = ny * S + nx;
    if (weak[ni] && !wseen[ni]) { wseen[ni] = 1; wq.push(ni); }
  }
}

// drop tiny components, and diffuse gray "repaint smudges" that live
// entirely over the flat background with weak contrast
const seen = new Uint8Array(S * S);
for (let i = 0; i < S * S; i++) {
  if (alpha[i] === 0 || seen[i]) continue;
  const stack = [i];
  const comp: number[] = [];
  seen[i] = 1;
  while (stack.length) {
    const j = stack.pop()!;
    comp.push(j);
    const x = j % S, y = (j / S) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
      const nj = ny * S + nx;
      if (alpha[nj] > 0 && !seen[nj]) { seen[nj] = 1; stack.push(nj); }
    }
  }
  let onBg = 0, diffSum = 0;
  for (const j of comp) {
    if (isBaseBg(j)) onBg++;
    diffSum += Math.max(
      Math.abs(base[j * 3] - edit[j * 3]),
      Math.abs(base[j * 3 + 1] - edit[j * 3 + 1]),
      Math.abs(base[j * 3 + 2] - edit[j * 3 + 2])
    );
  }
  const meanDiff = diffSum / comp.length;
  const bgFrac = onBg / comp.length;
  if (comp.length < 120 || (bgFrac > 0.92 && meanDiff < 60))
    for (const j of comp) alpha[j] = 0;
}

const out = Buffer.alloc(S * S * 4);
let count = 0, x0 = S, x1 = 0, y0 = S, y1 = 0;
for (let i = 0; i < S * S; i++) {
  out[i * 4] = edit[i * 3];
  out[i * 4 + 1] = edit[i * 3 + 1];
  out[i * 4 + 2] = edit[i * 3 + 2];
  out[i * 4 + 3] = alpha[i];
  if (alpha[i] > 0) {
    count++;
    const x = i % S, y = (i / S) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}

await sharp(out, { raw: { width: S, height: S, channels: 4 } }).png().toFile(outPath);
console.log(`${outPath}: ${count}px bbox=(${x0},${y0})-(${x1},${y1})`);
