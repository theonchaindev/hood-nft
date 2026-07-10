// HOODZ v3 renderer — full trait system:
//   hoods: hue-remap colors + tiled texture materials (camo, galaxy, monogram…)
//   faces: neon SVG styles + AI face plates screen-blended into the hood void
//   hats:  sticker cells anchored to the hood peak
//   accessories: chains (recolor), stickers (mouth/eyes/chest/side/held),
//                scatter sprites and SVG effect overlays
// Usage: npx tsx scripts/generate3.mts <id...> | all | 1-100

import sharp from "sharp";
import { mkdirSync } from "fs";
import { getNft, TOTAL_SUPPLY, HoodNft } from "../lib/nfts";

const S = 1024;
const OUT = 800;

// ---------- color helpers ----------
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(f(h + 1 / 3) * 255),
    Math.round(f(h) * 255),
    Math.round(f(h - 1 / 3) * 255),
  ];
}

const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

// ---------- masters ----------
interface Rect { x: number; y: number; w: number; h: number }

interface Master {
  data: Buffer;
  bgMask: Uint8Array;
  hoodMask: Uint8Array;
  chainMask: Uint8Array;
  faceMask: Uint8Array;
  face: Rect;
  hoodTop: { x: number; y: number };
  hoodRect: Rect;
}

const masters: Record<string, Master> = {};

async function loadMaster(file: string): Promise<Master> {
  if (masters[file]) return masters[file];
  const { data } = await sharp(`assets/${file}`)
    .resize(S, S)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const c0 = [data[0], data[1], data[2]];
  const isBg = (i: number) =>
    Math.abs(data[i * 3] - c0[0]) <= 14 &&
    Math.abs(data[i * 3 + 1] - c0[1]) <= 14 &&
    Math.abs(data[i * 3 + 2] - c0[2]) <= 14;
  const bgMask = new Uint8Array(S * S);
  const queue: number[] = [];
  for (const st of [0, S - 1, (S - 1) * S, S * S - 1])
    if (isBg(st)) { bgMask[st] = 1; queue.push(st); }
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % S, y = (i / S) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
      const ni = ny * S + nx;
      if (!bgMask[ni] && isBg(ni)) { bgMask[ni] = 1; queue.push(ni); }
    }
  }

  const hoodMask = new Uint8Array(S * S);
  const chainMask = new Uint8Array(S * S);
  const rowBlack = new Uint32Array(S);
  const colBlack = new Uint32Array(S);
  let hx0 = S, hx1 = 0, hy0 = S, hy1 = 0;
  for (let i = 0; i < S * S; i++) {
    if (bgMask[i]) continue;
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const [h, s] = rgbToHsl(r, g, b);
    const x = i % S, y = (i / S) | 0;
    if (s > 0.18 && h >= 245 && h <= 315) {
      hoodMask[i] = 1;
      if (x < hx0) hx0 = x; if (x > hx1) hx1 = x;
      if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
    } else if (s > 0.3 && h >= 20 && h <= 70) chainMask[i] = 1;
    if (Math.max(r, g, b) < 30) { rowBlack[y]++; colBlack[x]++; }
  }

  const band = (counts: Uint32Array) => {
    const max = Math.max(...counts);
    const thr = max * 0.35;
    let a = -1, b = -1;
    for (let i = 0; i < S; i++) if (counts[i] > thr) { if (a < 0) a = i; b = i; }
    return [a, b] as const;
  };
  const [fy0, fy1] = band(rowBlack);
  const [fx0, fx1] = band(colBlack);
  const face = { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 };

  // face mask: near-black pixels inside (padded) face box
  const faceMask = new Uint8Array(S * S);
  const pad = 30;
  for (let y = Math.max(0, fy0 - pad); y <= Math.min(S - 1, fy1 + pad); y++) {
    for (let x = Math.max(0, fx0 - pad); x <= Math.min(S - 1, fx1 + pad); x++) {
      const i = y * S + x;
      if (!bgMask[i] && Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) < 46)
        faceMask[i] = 1;
    }
  }

  // hood peak: average x of hood pixels in the topmost 30 hood rows
  let topY = S;
  for (let i = 0; i < S * S; i++) if (hoodMask[i]) { topY = (i / S) | 0; break; }
  let sx = 0, n = 0;
  for (let y = topY; y < Math.min(S, topY + 30); y++)
    for (let x = 0; x < S; x++) if (hoodMask[y * S + x]) { sx += x; n++; }
  const hoodTop = { x: n ? sx / n : S / 2, y: topY };

  masters[file] = {
    data, bgMask, hoodMask, chainMask, faceMask, face, hoodTop,
    hoodRect: { x: hx0, y: hy0, w: hx1 - hx0, h: hy1 - hy0 },
  };
  return masters[file];
}

// ---------- hood + chain materials ----------
interface Remap { hue: number | null; satMul: number; lightMul: number; sweep?: boolean }

const HOOD_REMAP: Record<string, Remap> = {
  Purple: { hue: null, satMul: 1, lightMul: 1 },
  Lime: { hue: 68, satMul: 0.95, lightMul: 1.02 },
  Red: { hue: 2, satMul: 0.9, lightMul: 0.85 },
  Blue: { hue: 220, satMul: 0.8, lightMul: 0.8 },
  Black: { hue: 260, satMul: 0.1, lightMul: 0.35 },
  White: { hue: 210, satMul: 0.06, lightMul: 1.18 },
  Gold: { hue: 45, satMul: 1, lightMul: 0.95 },
  Silver: { hue: 210, satMul: 0.07, lightMul: 1 },
  Ice: { hue: 200, satMul: 0.45, lightMul: 1.12 },
  Neon: { hue: 105, satMul: 1.2, lightMul: 1.05 },
  Pink: { hue: 322, satMul: 0.85, lightMul: 1.05 },
  Orange: { hue: 28, satMul: 0.95, lightMul: 0.95 },
  Emerald: { hue: 140, satMul: 0.85, lightMul: 0.8 },
  Sapphire: { hue: 228, satMul: 0.9, lightMul: 0.65 },
  Crimson: { hue: 350, satMul: 0.9, lightMul: 0.7 },
  Chrome: { hue: 210, satMul: 0.12, lightMul: 1.1 },
  Toxic: { hue: 85, satMul: 1.1, lightMul: 0.95 },
  Rainbow: { hue: 0, satMul: 0.9, lightMul: 1, sweep: true },
};

// textured hoods: sheet cell → tiled over the hood, modulated by shading
const HOOD_TEXTURE: Record<string, { sheet: string; cols: number; rows: number; idx: number; inset: number; tile: number }> = {
  Camo: { sheet: "tex1.png", cols: 3, rows: 2, idx: 0, inset: 0.16, tile: 2 },
  "Digital Camo": { sheet: "tex1.png", cols: 3, rows: 2, idx: 1, inset: 0.16, tile: 2 },
  Denim: { sheet: "tex1.png", cols: 3, rows: 2, idx: 2, inset: 0.18, tile: 2 },
  Wood: { sheet: "tex1.png", cols: 3, rows: 2, idx: 3, inset: 0.16, tile: 2 },
  Stone: { sheet: "tex1.png", cols: 3, rows: 2, idx: 4, inset: 0.16, tile: 2 },
  Lava: { sheet: "tex1.png", cols: 3, rows: 2, idx: 5, inset: 0.16, tile: 2 },
  Crystal: { sheet: "tex2.png", cols: 2, rows: 2, idx: 1, inset: 0.14, tile: 2.5 },
  "Louis Vuitton": { sheet: "tex2.png", cols: 2, rows: 2, idx: 3, inset: 0.14, tile: 2 },
  Galaxy: { sheet: "tex3.png", cols: 2, rows: 2, idx: 0, inset: 0.17, tile: 1 },
  Cyber: { sheet: "tex3.png", cols: 2, rows: 2, idx: 1, inset: 0.17, tile: 1.5 },
  Zombie: { sheet: "tex3.png", cols: 2, rows: 2, idx: 2, inset: 0.17, tile: 1.2 },
  Gucci: { sheet: "tex3.png", cols: 2, rows: 2, idx: 3, inset: 0.17, tile: 1.5 },
};

const CHAIN_REMAP: Record<string, Remap> = {
  "Gold Chain": { hue: null, satMul: 1, lightMul: 1 },
  "Silver Chain": { hue: 210, satMul: 0.06, lightMul: 1.05 },
  "Diamond Chain": { hue: 197, satMul: 0.4, lightMul: 1.2 },
  "Rose Gold Chain": { hue: 13, satMul: 0.6, lightMul: 1.02 },
  "Emerald Chain": { hue: 140, satMul: 0.85, lightMul: 0.88 },
  "Obsidian Chain": { hue: 265, satMul: 0.25, lightMul: 0.4 },
  "Rainbow Chain": { hue: 0, satMul: 0.9, lightMul: 1, sweep: true },
};

// chains + pendants use the chain master; everything else the clean one
const CHAIN_ACCS = new Set([...Object.keys(CHAIN_REMAP), "Solana Pendant", "Bitcoin Pendant"]);

const textureCache = new Map<string, { data: Buffer; w: number; h: number }>();

async function loadTexture(hood: string): Promise<{ data: Buffer; w: number; h: number }> {
  const t = HOOD_TEXTURE[hood];
  const key = hood;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const meta = await sharp(`assets/${t.sheet}`).metadata();
  const cw = Math.floor(meta.width! / t.cols), ch = Math.floor(meta.height! / t.rows);
  const cx = (t.idx % t.cols) * cw, cy = Math.floor(t.idx / t.cols) * ch;
  const ix = Math.round(cw * t.inset), iy = Math.round(ch * t.inset);
  const size = 512;
  const { data } = await sharp(`assets/${t.sheet}`)
    .extract({ left: cx + ix, top: cy + iy, width: cw - ix * 2, height: ch - iy * 2 })
    .resize(size, size)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = { data, w: size, h: size };
  textureCache.set(key, out);
  return out;
}

async function characterLayer(hood: string, accessory: string): Promise<{ png: Buffer; m: Master }> {
  const useChain = CHAIN_ACCS.has(accessory);
  const m = await loadMaster(useChain ? "master.png" : "master-nochain.png");
  const hoodT = HOOD_REMAP[hood] ?? null;
  const hoodTex = HOOD_TEXTURE[hood] ? await loadTexture(hood) : null;
  const chainT = useChain ? CHAIN_REMAP[accessory] ?? CHAIN_REMAP["Gold Chain"] : null;

  const out = Buffer.alloc(S * S * 4);
  const hr = m.hoodRect;
  for (let i = 0; i < S * S; i++) {
    if (m.bgMask[i]) { out[i * 4 + 3] = 0; continue; }
    let r = m.data[i * 3], g = m.data[i * 3 + 1], b = m.data[i * 3 + 2];
    if (m.hoodMask[i]) {
      const [h, s, l] = rgbToHsl(r, g, b);
      if (hoodTex) {
        // tile texture over the hood bbox, modulate by original shading
        const t = HOOD_TEXTURE[hood];
        const x = i % S, y = (i / S) | 0;
        // mirrored (ping-pong) tiling so repeats have no visible seams
        const pp = (raw: number, size: number) => {
          const m2 = Math.abs(Math.floor(raw)) % (size * 2);
          return m2 < size ? m2 : size * 2 - 1 - m2;
        };
        const u = pp(((x - hr.x) / hr.w) * t.tile * hoodTex.w, hoodTex.w);
        const v = pp(((y - hr.y) / hr.h) * t.tile * hoodTex.h, hoodTex.h);
        const ti = (v * hoodTex.w + u) * 3;
        const shade = Math.min(1.35, l / 0.58);
        r = cl(hoodTex.data[ti] * shade);
        g = cl(hoodTex.data[ti + 1] * shade);
        b = cl(hoodTex.data[ti + 2] * shade);
      } else if (hoodT && hoodT.hue !== null) {
        const hue = hoodT.sweep ? (((i % S) + ((i / S) | 0)) / (2 * S)) * 300 : hoodT.hue;
        [r, g, b] = hslToRgb(hue, Math.min(1, s * hoodT.satMul), Math.min(0.97, l * hoodT.lightMul));
      }
    } else if (m.chainMask[i] && chainT && chainT.hue !== null) {
      const [h2, s2, l2] = rgbToHsl(r, g, b);
      const hue = chainT.sweep ? (((i % S) / S) * 360) : chainT.hue;
      [r, g, b] = hslToRgb(hue, Math.min(1, s2 * chainT.satMul), Math.min(0.97, l2 * chainT.lightMul));
    }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  const png = await sharp(out, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer();
  return { png, m };
}

// ---------- backgrounds ----------
const SOLIDS: Record<string, [string, string]> = {
  "Solid Charcoal": ["#3a3d42", "#17181b"], "Solid Purple": ["#7a4fd0", "#3a1d78"],
  "Solid Blue": ["#3f7fe0", "#173a80"], "Solid Green": ["#3dbb62", "#155c2e"],
  "Solid Red": ["#e05548", "#7c1f18"], "Solid Pink": ["#f078b8", "#983068"],
  "Solid Orange": ["#f09048", "#a04a10"], "Solid Teal": ["#38b8ac", "#0f5a54"],
  "Solid Yellow": ["#ecc84e", "#9a7a14"], "Solid Mint": ["#8fe0b8", "#3d8a66"],
  "Solid Cream": ["#f2e6cf", "#c9b490"], "Solid Lavender": ["#c5b3ef", "#77619f"],
};

const BG_PLATES: Record<string, { file: string; inset: number; hue: number; sat?: number; bright?: number }> = {
  "Purple Storm": { file: "bg-storm.png", inset: 0.1, hue: 0 },
  "Emerald Storm": { file: "bg-storm.png", inset: 0.1, hue: -150 },
  "Blood Storm": { file: "bg-storm.png", inset: 0.1, hue: 85 },
  "Golden Storm": { file: "bg-storm.png", inset: 0.1, hue: 135, sat: 1.15 },
  Moon: { file: "bg-night.png", inset: 0, hue: 0 },
  "Money Rain": { file: "bg-money.png", inset: 0.12, hue: 0 },
  Graffiti: { file: "bg-graffiti.png", inset: 0.04, hue: 0 },
  Cyberpunk: { file: "bg-cyberpunk.png", inset: 0.04, hue: 0 },
  Space: { file: "bg-space.png", inset: 0.04, hue: 0 },
  "Crimson Space": { file: "bg-space.png", inset: 0.04, hue: 130 },
  Fire: { file: "bg-fire.png", inset: 0.04, hue: 0 },
  "Blue Inferno": { file: "bg-fire.png", inset: 0.04, hue: 180 },
  Ice: { file: "bg-icecave.png", inset: 0.04, hue: 0 },
  Jungle: { file: "bg-jungle.png", inset: 0.04, hue: 0 },
  "Autumn Jungle": { file: "bg-jungle.png", inset: 0.04, hue: -110 },
  Desert: { file: "bg-desert.png", inset: 0.04, hue: 0 },
  Ocean: { file: "bg-ocean.png", inset: 0.04, hue: 0 },
  Matrix: { file: "bg-matrix.png", inset: 0.04, hue: 0 },
  "Red Matrix": { file: "bg-matrix.png", inset: 0.04, hue: 220 },
  Gold: { file: "bg-gold.png", inset: 0.04, hue: 0 },
  Diamond: { file: "bg-diamond.png", inset: 0.04, hue: 0 },
  "Amethyst Cave": { file: "bg-diamond.png", inset: 0.04, hue: 60 },
  Clouds: { file: "bg-clouds.png", inset: 0.04, hue: 0 },
  "Sunset Clouds": { file: "bg-clouds.png", inset: 0.04, hue: 160, sat: 1.1 },
  Castle: { file: "bg-castle.png", inset: 0.04, hue: 0 },
  Sunset: { file: "bg-sunset.png", inset: 0.04, hue: 0 },
  Synthwave: { file: "bg-synthwave.png", inset: 0.04, hue: 0 },
  "Midnight Synthwave": { file: "bg-synthwave.png", inset: 0.04, hue: 120, bright: 0.85 },
};

async function backgroundLayer(bg: string): Promise<Buffer> {
  if (SOLIDS[bg]) {
    const [from, to] = SOLIDS[bg];
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.9">
        <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
      </radialGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`)).png().toBuffer();
  }
  if (bg === "Void") {
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <defs><radialGradient id="v" cx="0.5" cy="0.42" r="0.75">
        <stop offset="0%" stop-color="#17101f"/><stop offset="70%" stop-color="#0a070e"/><stop offset="100%" stop-color="#020103"/>
      </radialGradient></defs><rect width="${S}" height="${S}" fill="url(#v)"/></svg>`)).png().toBuffer();
  }
  if (bg === "Neon") {
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <defs><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs>
      <rect width="${S}" height="${S}" fill="#0c0716"/>
      <g filter="url(#b)" fill="none" stroke-width="26">
        <circle cx="${S / 2}" cy="${S * 0.46}" r="${S * 0.44}" stroke="#ff2ea6"/>
        <circle cx="${S / 2}" cy="${S * 0.46}" r="${S * 0.34}" stroke="#2ee6ff"/>
        <circle cx="${S / 2}" cy="${S * 0.46}" r="${S * 0.25}" stroke="#b44dff"/>
      </g></svg>`)).png().toBuffer();
  }
  if (bg === "Comic Halftone") {
    let dots = "";
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x - 12, y - 10) / 16;
        dots += `<circle cx="${x * 44 + (y % 2) * 22}" cy="${y * 44}" r="${4 + d * 12}" fill="#1c1c22"/>`;
      }
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <rect width="${S}" height="${S}" fill="#f5c518"/>${dots}</svg>`)).png().toBuffer();
  }
  const p = BG_PLATES[bg] ?? BG_PLATES["Purple Storm"];
  const meta = await sharp(`assets/${p.file}`).metadata();
  const inset = Math.round(Math.min(meta.width!, meta.height!) * p.inset);
  return sharp(`assets/${p.file}`)
    .extract({ left: inset, top: inset, width: meta.width! - inset * 2, height: meta.height! - inset * 2 })
    .resize(S, S)
    .modulate({ hue: p.hue, saturation: p.sat ?? 1, brightness: p.bright ?? 1 })
    .png()
    .toBuffer();
}

// ---------- sticker system (hats + object accessories) ----------
interface StickerDef { sheet: string; cols: number; rows: number; idx: number }

const HAT_STICKERS: Record<string, StickerDef> = {
  Crown: { sheet: "hats1.png", cols: 3, rows: 2, idx: 0 },
  Halo: { sheet: "hats1.png", cols: 3, rows: 2, idx: 1 },
  "Devil Horns": { sheet: "hats1.png", cols: 3, rows: 2, idx: 2 },
  "Wizard Hat": { sheet: "hats1.png", cols: 3, rows: 2, idx: 3 },
  "Viking Helmet": { sheet: "hats1.png", cols: 3, rows: 2, idx: 4 },
  "Samurai Helmet": { sheet: "hats1.png", cols: 3, rows: 2, idx: 5 },
  "Astronaut Helmet": { sheet: "hats2.png", cols: 3, rows: 2, idx: 0 },
  "Pirate Hat": { sheet: "hats2.png", cols: 3, rows: 2, idx: 1 },
  "Cowboy Hat": { sheet: "hats2.png", cols: 3, rows: 2, idx: 2 },
  "Chef Hat": { sheet: "hats2.png", cols: 3, rows: 2, idx: 3 },
  "Santa Hat": { sheet: "hats2.png", cols: 3, rows: 2, idx: 4 },
  Beanie: { sheet: "hats2.png", cols: 3, rows: 2, idx: 5 },
  Cap: { sheet: "hats3.png", cols: 3, rows: 2, idx: 0 },
  "Bucket Hat": { sheet: "hats3.png", cols: 3, rows: 2, idx: 1 },
  "Top Hat": { sheet: "hats3.png", cols: 3, rows: 2, idx: 2 },
  Fedora: { sheet: "hats3.png", cols: 3, rows: 2, idx: 3 },
  "Construction Helmet": { sheet: "hats3.png", cols: 3, rows: 2, idx: 4 },
  "Police Cap": { sheet: "hats3.png", cols: 3, rows: 2, idx: 5 },
  "Army Helmet": { sheet: "hats4.png", cols: 3, rows: 2, idx: 0 },
  "Graduation Cap": { sheet: "hats4.png", cols: 3, rows: 2, idx: 1 },
  Mushroom: { sheet: "hats4.png", cols: 3, rows: 2, idx: 2 },
  UFO: { sheet: "hats4.png", cols: 3, rows: 2, idx: 3 },
  "Dragon Horns": { sheet: "hats4.png", cols: 3, rows: 2, idx: 4 },
  "Unicorn Horn": { sheet: "hats4.png", cols: 3, rows: 2, idx: 5 },
  "Solana Cap": { sheet: "hats5.png", cols: 2, rows: 2, idx: 0 },
  Pumpkin: { sheet: "hats5.png", cols: 2, rows: 2, idx: 1 },
  "Bunny Ears": { sheet: "hats5.png", cols: 2, rows: 2, idx: 2 },
  "Ninja Hood": { sheet: "hats6.png", cols: 2, rows: 2, idx: 0 },
  "Laurel Wreath": { sheet: "hats6.png", cols: 2, rows: 2, idx: 1 },
  "Crystal Crown": { sheet: "hats6.png", cols: 2, rows: 2, idx: 2 },
  "Bitcoin Cap": { sheet: "hats7.png", cols: 2, rows: 2, idx: 0 },
  "Cat Ears": { sheet: "hats7.png", cols: 2, rows: 2, idx: 1 },
  Headphones: { sheet: "hats7.png", cols: 2, rows: 2, idx: 2 },
  "Flame Crown": { sheet: "hats7.png", cols: 2, rows: 2, idx: 3 },
};

// per-hat tuning: scale (relative to face width) and vertical offset
// (relative to hat height; positive pushes down over the hood peak)
const HAT_TUNE: Record<string, { scale?: number; dy?: number }> = {
  Halo: { scale: 1.1, dy: -0.45 },
  UFO: { scale: 1.5, dy: -0.5 },
  "Devil Horns": { scale: 1.35, dy: -0.12 },
  "Dragon Horns": { scale: 1.5, dy: -0.12 },
  "Bunny Ears": { scale: 1.15, dy: 0.05 },
  "Cat Ears": { scale: 1.3, dy: 0.12 },
  "Unicorn Horn": { scale: 0.6, dy: -0.15 },
  "Astronaut Helmet": { scale: 1.7, dy: 0.45 },
  Headphones: { scale: 1.55, dy: 0.4 },
  "Ninja Hood": { scale: 1.4, dy: 0.24 },
  Beanie: { scale: 1.5, dy: 0.18 },
  Mushroom: { scale: 1.5, dy: 0 },
  Pumpkin: { scale: 1.35, dy: 0 },
  "Santa Hat": { scale: 1.45, dy: 0.05 },
  Crown: { scale: 1.15, dy: -0.05 },
  "Crystal Crown": { scale: 1.2, dy: -0.05 },
  "Flame Crown": { scale: 1.25, dy: -0.05 },
  "Laurel Wreath": { scale: 1.3, dy: 0.05 },
};

const ACC_STICKERS: Record<string, StickerDef & { anchor: "mouth" | "eyes" | "chest" | "side" | "held" | "ear" }> = {
  Cigar: { sheet: "acc1.png", cols: 3, rows: 2, idx: 0, anchor: "mouth" },
  Pipe: { sheet: "acc1.png", cols: 3, rows: 2, idx: 1, anchor: "mouth" },
  Bubblegum: { sheet: "acc1.png", cols: 3, rows: 2, idx: 2, anchor: "mouth" },
  Lollipop: { sheet: "acc1.png", cols: 3, rows: 2, idx: 3, anchor: "mouth" },
  Rose: { sheet: "acc1.png", cols: 3, rows: 2, idx: 4, anchor: "mouth" },
  Coffee: { sheet: "acc1.png", cols: 3, rows: 2, idx: 5, anchor: "side" },
  Sunglasses: { sheet: "acc2.png", cols: 3, rows: 2, idx: 0, anchor: "eyes" },
  "Pixel Glasses": { sheet: "acc2.png", cols: 3, rows: 2, idx: 1, anchor: "eyes" },
  Monocle: { sheet: "acc2.png", cols: 3, rows: 2, idx: 2, anchor: "eyes" },
  "VR Headset": { sheet: "acc2.png", cols: 3, rows: 2, idx: 3, anchor: "eyes" },
  Earring: { sheet: "acc2.png", cols: 3, rows: 2, idx: 4, anchor: "ear" },
  "Nose Ring": { sheet: "acc2.png", cols: 3, rows: 2, idx: 5, anchor: "mouth" },
  Katana: { sheet: "acc3.png", cols: 3, rows: 2, idx: 0, anchor: "held" },
  "Baseball Bat": { sheet: "acc3.png", cols: 3, rows: 2, idx: 1, anchor: "held" },
  "Energy Drink": { sheet: "acc3.png", cols: 3, rows: 2, idx: 2, anchor: "side" },
  AirPods: { sheet: "acc3.png", cols: 3, rows: 2, idx: 3, anchor: "ear" },
  "Solana Pendant": { sheet: "acc3.png", cols: 3, rows: 2, idx: 4, anchor: "chest" },
  "Bitcoin Pendant": { sheet: "acc3.png", cols: 3, rows: 2, idx: 5, anchor: "chest" },
  "Shoulder Raven": { sheet: "acc4.png", cols: 3, rows: 2, idx: 0, anchor: "side" },
  Snake: { sheet: "acc4.png", cols: 3, rows: 2, idx: 1, anchor: "side" },
  Frog: { sheet: "acc4.png", cols: 3, rows: 2, idx: 2, anchor: "side" },
  "Mini Ghost": { sheet: "acc4.png", cols: 3, rows: 2, idx: 3, anchor: "side" },
  "Floating Cards": { sheet: "acc4.png", cols: 3, rows: 2, idx: 4, anchor: "side" },
  "Floating Cubes": { sheet: "acc4.png", cols: 3, rows: 2, idx: 5, anchor: "side" },
};

const SCATTER_SPRITES: Record<string, StickerDef> = {
  Skulls: { sheet: "acc5.png", cols: 3, rows: 2, idx: 0 },
  "Money Rain": { sheet: "acc5.png", cols: 3, rows: 2, idx: 1 },
  Stars: { sheet: "acc5.png", cols: 3, rows: 2, idx: 2 },
  Hearts: { sheet: "acc5.png", cols: 3, rows: 2, idx: 3 },
  "Ice Aura": { sheet: "acc5.png", cols: 3, rows: 2, idx: 4 },
  Lightning: { sheet: "acc5.png", cols: 3, rows: 2, idx: 5 },
};

interface Sticker { png: Buffer; w: number; h: number }
const stickerCache = new Map<string, Promise<Sticker>>();

// slice a sheet cell, remove its flat background via corner flood fill,
// and trim to the content bounding box
async function loadSticker(def: StickerDef): Promise<Sticker> {
  const key = `${def.sheet}#${def.idx}`;
  if (stickerCache.has(key)) return stickerCache.get(key)!;
  const p = (async () => {
    const meta = await sharp(`assets/${def.sheet}`).metadata();
    const cw = Math.floor(meta.width! / def.cols), ch = Math.floor(meta.height! / def.rows);
    const cx = (def.idx % def.cols) * cw, cy = Math.floor(def.idx / def.cols) * ch;
    const { data } = await sharp(`assets/${def.sheet}`)
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const n = cw * ch;
    const alpha = new Uint8Array(n).fill(255);
    // background = anything close to the corner colors (handles gray cells,
    // white cells and soft cell borders), flood-filled from all corners
    const corners = [0, cw - 1, (ch - 1) * cw, n - 1];
    // generous tolerance so the fill crosses from gray gutters into white
    // cell panels; bold sticker outlines stop it from eating content
    const isBgLike = (i: number, ref: number[]) =>
      Math.abs(data[i * 3] - ref[0]) <= 34 &&
      Math.abs(data[i * 3 + 1] - ref[1]) <= 34 &&
      Math.abs(data[i * 3 + 2] - ref[2]) <= 34;
    const queue: Array<[number, number[]]> = [];
    for (const c of corners) {
      const ref = [data[c * 3], data[c * 3 + 1], data[c * 3 + 2]];
      queue.push([c, ref]);
      alpha[c] = 0;
    }
    while (queue.length) {
      const [i, ref] = queue.pop()!;
      const x = i % cw, y = (i / cw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const ni = ny * cw + nx;
        if (alpha[ni] && isBgLike(ni, ref)) { alpha[ni] = 0; queue.push([ni, ref]); }
      }
    }
    // content bbox
    let x0 = cw, x1 = 0, y0 = ch, y1 = 0, any = false;
    for (let i = 0; i < n; i++) {
      if (!alpha[i]) continue;
      any = true;
      const x = i % cw, y = (i / cw) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (!any) { x0 = 0; y0 = 0; x1 = cw - 1; y1 = ch - 1; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const rgba = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const si = (y + y0) * cw + (x + x0);
        const di = (y * bw + x) * 4;
        rgba[di] = data[si * 3]; rgba[di + 1] = data[si * 3 + 1];
        rgba[di + 2] = data[si * 3 + 2]; rgba[di + 3] = alpha[si];
      }
    const png = await sharp(rgba, { raw: { width: bw, height: bh, channels: 4 } }).png().toBuffer();
    return { png, w: bw, h: bh };
  })();
  stickerCache.set(key, p);
  return p;
}

interface Layer { input: Buffer; left?: number; top?: number; blend?: "screen" | "over" }

async function placeSticker(st: Sticker, width: number, cx: number, cy: number, vAlign: "center" | "bottom" = "center"): Promise<Layer> {
  const scale = width / st.w;
  const h = Math.round(st.h * scale);
  const png = await sharp(st.png).resize(Math.round(width), h).png().toBuffer();
  return {
    input: png,
    left: Math.round(cx - width / 2),
    top: Math.round(vAlign === "center" ? cy - h / 2 : cy - h),
  };
}

async function hatLayer(hat: string, m: Master): Promise<Layer | null> {
  const def = HAT_STICKERS[hat];
  if (!def) return null;
  const st = await loadSticker(def);
  const tune = HAT_TUNE[hat] ?? {};
  let width = m.face.w * (tune.scale ?? 1.35);
  // default anchor: hat bottom sits 80% of the way from the hood peak down
  // to the top of the face opening, so it hugs the crown of the hood.
  // tune.dy shifts in fractions of face height (negative floats upward).
  const bottomY = m.hoodTop.y + (m.face.y - m.hoodTop.y) * 0.8 + (tune.dy ?? 0) * m.face.h;
  // shrink tall hats that would spill past the top of the canvas
  const h = (st.h / st.w) * width;
  if (bottomY - h < 8) width *= (bottomY - 8) / h;
  return placeSticker(st, width, m.hoodTop.x, bottomY, "bottom");
}

async function accessoryLayers(acc: string, m: Master): Promise<Layer[]> {
  const def = ACC_STICKERS[acc];
  const f = m.face;
  if (def) {
    const st = await loadSticker(def);
    switch (def.anchor) {
      case "mouth": {
        const width = acc === "Nose Ring" ? f.w * 0.14 : f.w * (acc === "Bubblegum" ? 0.42 : 0.52);
        // hang off the mouth corner, slightly right of face center
        return [await placeSticker(st, width, f.x + f.w * (acc === "Nose Ring" ? 0.5 : 0.62), f.y + f.h * (acc === "Nose Ring" ? 0.78 : 0.74))];
      }
      case "eyes":
        return [await placeSticker(st, f.w * 0.94, f.x + f.w / 2, f.y + f.h * 0.44)];
      case "ear":
        return [await placeSticker(st, f.w * 0.16, f.x + f.w * 0.02, f.y + f.h * 0.62)];
      case "chest":
        return [await placeSticker(st, f.w * 0.34, S * 0.485, S * 0.83)];
      case "side":
        return [await placeSticker(st, f.w * 0.55, S * 0.85, S * 0.72)];
      case "held":
        return [await placeSticker(st, f.w * 1.05, S * 0.86, S * 0.68)];
    }
  }
  const scatter = SCATTER_SPRITES[acc];
  if (scatter) {
    const st = await loadSticker(scatter);
    const layers: Layer[] = [];
    // deterministic scatter around the character, avoiding the face
    const spots = [
      [0.1, 0.14], [0.86, 0.1], [0.06, 0.5], [0.92, 0.42],
      [0.12, 0.82], [0.88, 0.78], [0.3, 0.06], [0.68, 0.05],
    ];
    for (let i = 0; i < spots.length; i++) {
      const sz = f.w * (0.16 + (i % 3) * 0.05);
      layers.push(await placeSticker(st, sz, spots[i][0] * S, spots[i][1] * S));
    }
    return layers;
  }
  // SVG effects
  if (acc === "Fire" || acc === "Smoke" || acc === "Neon Aura") {
    const inner =
      acc === "Fire"
        ? `<circle cx="${S / 2}" cy="${S * 0.55}" r="${S * 0.5}" fill="none" stroke="#ff7a1a" stroke-width="${S * 0.14}" opacity="0.45"/>
           <circle cx="${S / 2}" cy="${S * 0.62}" r="${S * 0.42}" fill="none" stroke="#ffb300" stroke-width="${S * 0.08}" opacity="0.35"/>`
        : acc === "Smoke"
          ? `<ellipse cx="${S * 0.28}" cy="${S * 0.3}" rx="${S * 0.16}" ry="${S * 0.09}" fill="#aab2bb" opacity="0.5"/>
             <ellipse cx="${S * 0.74}" cy="${S * 0.2}" rx="${S * 0.2}" ry="${S * 0.11}" fill="#8d959e" opacity="0.45"/>
             <ellipse cx="${S * 0.16}" cy="${S * 0.66}" rx="${S * 0.14}" ry="${S * 0.08}" fill="#aab2bb" opacity="0.4"/>
             <ellipse cx="${S * 0.86}" cy="${S * 0.58}" rx="${S * 0.16}" ry="${S * 0.09}" fill="#98a1ab" opacity="0.45"/>`
          : `<circle cx="${S / 2}" cy="${S * 0.46}" r="${S * 0.4}" fill="none" stroke="#2ee6ff" stroke-width="${S * 0.035}" opacity="0.75"/>
             <circle cx="${S / 2}" cy="${S * 0.46}" r="${S * 0.46}" fill="none" stroke="#ff2ea6" stroke-width="${S * 0.025}" opacity="0.6"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <defs><filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="22"/></filter></defs>
      <g filter="url(#soft)">${inner}</g></svg>`;
    return [{ input: await sharp(Buffer.from(svg)).png().toBuffer(), blend: "screen" }];
  }
  return []; // None + chains (handled in characterLayer)
}

// ---------- faces ----------
const FACE_PLATES: Record<string, StickerDef> = {
  Skull: { sheet: "faces1.png", cols: 2, rows: 2, idx: 0 },
  Zombie: { sheet: "faces1.png", cols: 2, rows: 2, idx: 3 },
  Fire: { sheet: "faces2.png", cols: 3, rows: 2, idx: 0 },
  Ice: { sheet: "faces2.png", cols: 3, rows: 2, idx: 1 },
  Galaxy: { sheet: "faces2.png", cols: 3, rows: 2, idx: 2 },
  "Gold Drip": { sheet: "faces2.png", cols: 3, rows: 2, idx: 3 },
  Smoke: { sheet: "faces2.png", cols: 3, rows: 2, idx: 4 },
  Crystal: { sheet: "faces2.png", cols: 3, rows: 2, idx: 5 },
  "Purple Flames": { sheet: "faces3.png", cols: 3, rows: 2, idx: 0 },
  "Blue Flames": { sheet: "faces3.png", cols: 3, rows: 2, idx: 1 },
  Pumpkin: { sheet: "faces3.png", cols: 3, rows: 2, idx: 2 },
  Demon: { sheet: "faces3.png", cols: 3, rows: 2, idx: 3 },
  Vampire: { sheet: "faces3.png", cols: 3, rows: 2, idx: 4 },
  Ninja: { sheet: "faces3.png", cols: 3, rows: 2, idx: 5 },
  Samurai: { sheet: "faces4.png", cols: 3, rows: 2, idx: 0 },
  Cosmic: { sheet: "faces4.png", cols: 3, rows: 2, idx: 1 },
  "TV Screen": { sheet: "faces4.png", cols: 3, rows: 2, idx: 2 },
  "Matrix Code": { sheet: "faces4.png", cols: 3, rows: 2, idx: 3 },
  Glitch: { sheet: "faces4.png", cols: 3, rows: 2, idx: 4 },
  Robot: { sheet: "faces4.png", cols: 3, rows: 2, idx: 5 },
  Ghost: { sheet: "faces5.png", cols: 2, rows: 2, idx: 0 },
  Alien: { sheet: "faces5.png", cols: 2, rows: 2, idx: 1 },
  Cyborg: { sheet: "faces5.png", cols: 2, rows: 2, idx: 2 },
  Hollow: { sheet: "faces5.png", cols: 2, rows: 2, idx: 3 },
};

// face plates keep their black bg and screen-blend into the hood void,
// clipped to the face mask so glow never spills onto the hood rim
async function facePlateLayer(face: string, m: Master): Promise<Layer | null> {
  const def = FACE_PLATES[face];
  if (!def) return null;
  const meta = await sharp(`assets/${def.sheet}`).metadata();
  const cw = Math.floor(meta.width! / def.cols), ch = Math.floor(meta.height! / def.rows);
  // inset the cell so neighboring cells / frame borders never bleed in
  const ix = Math.round(cw * 0.09), iy = Math.round(ch * 0.09);
  const cx = (def.idx % def.cols) * cw + ix, cy = Math.floor(def.idx / def.cols) * ch + iy;
  const ew = cw - ix * 2, eh = ch - iy * 2;
  const fh = Math.round(m.face.h * 0.8);
  const fw = Math.round((ew / eh) * fh);
  const plate = await sharp(`assets/${def.sheet}`)
    .extract({ left: cx, top: cy, width: ew, height: eh })
    .resize(fw, fh)
    .raw()
    .toBuffer();
  const left = Math.round(m.face.x + m.face.w / 2 - fw / 2);
  const top = Math.round(m.face.y + m.face.h * 0.52 - fh / 2);
  // build full-canvas RGBA clipped by faceMask
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < fh; y++) {
    const gy = top + y;
    if (gy < 0 || gy >= S) continue;
    for (let x = 0; x < fw; x++) {
      const gx = left + x;
      if (gx < 0 || gx >= S) continue;
      const gi = gy * S + gx;
      if (!m.faceMask[gi]) continue;
      const si = (y * fw + x) * 3;
      const di = gi * 4;
      out[di] = plate[si]; out[di + 1] = plate[si + 1]; out[di + 2] = plate[si + 2];
      out[di + 3] = 255;
    }
  }
  return {
    input: await sharp(out, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer(),
    blend: "screen",
  };
}

function spiralPath(cx: number, cy: number, rMax: number): string {
  let d = `M ${cx} ${cy}`;
  for (let i = 1; i <= 60; i++) {
    const t = i / 60;
    const a = t * 2.6 * Math.PI * 2;
    const r = t * rMax;
    d += ` L ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d;
}

function faceSvg(style: string, f: Rect): string | null {
  const eyeY = f.y + f.h * 0.44;
  const lx = f.x + f.w * 0.32;
  const rx = f.x + f.w * 0.68;
  const e = f.w * 0.09;
  const mouthY = f.y + f.h * 0.68;
  const mcx = f.x + f.w * 0.5;
  const mw = f.w * 0.46;

  const dots = (color: string, ry = e) =>
    `<circle cx="${lx}" cy="${eyeY}" r="${ry}" fill="${color}"/><circle cx="${rx}" cy="${eyeY}" r="${ry}" fill="${color}"/>`;
  const xeyes = (color: string, sw = 10) =>
    `<line x1="${lx - e}" y1="${eyeY - e}" x2="${lx + e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
     <line x1="${lx + e}" y1="${eyeY - e}" x2="${lx - e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
     <line x1="${rx - e}" y1="${eyeY - e}" x2="${rx + e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
     <line x1="${rx + e}" y1="${eyeY - e}" x2="${rx - e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const smile = (color: string, sw = 9) =>
    `<path d="M ${mcx - mw / 2} ${mouthY - 10} Q ${mcx} ${mouthY + 28} ${mcx + mw / 2} ${mouthY - 10}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const stitched = (color: string) => {
    let s = smile(color);
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const x = mcx - mw / 2 + mw * t;
      const yc = mouthY - 10 + 4 * t * (1 - t) * 38;
      s += `<line x1="${x}" y1="${yc - 12}" x2="${x}" y2="${yc + 12}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    }
    return s;
  };
  const glyph = (color: string, ch: string) =>
    `<text x="${lx}" y="${eyeY + e}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${e * 2.8}" fill="${color}">${ch}</text>
     <text x="${rx}" y="${eyeY + e}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${e * 2.8}" fill="${color}">${ch}</text>`;
  const heart = (cx2: number, color: string) => {
    const s = e * 1.25;
    return `<path d="M ${cx2} ${eyeY + s * 0.9} C ${cx2 - s * 1.6} ${eyeY - s * 0.4} ${cx2 - s * 0.7} ${eyeY - s * 1.4} ${cx2} ${eyeY - s * 0.4} C ${cx2 + s * 0.7} ${eyeY - s * 1.4} ${cx2 + s * 1.6} ${eyeY - s * 0.4} ${cx2} ${eyeY + s * 0.9} Z" fill="${color}"/>`;
  };

  switch (style) {
    case "Empty Void": return "";
    case "Glowing Eyes": return dots("#00ff41");
    case "Red Eyes": return dots("#ff3131");
    case "X Eyes": return xeyes("#e08aff");
    case "Stitched Smile": return xeyes("#e08aff") + stitched("#e08aff");
    case "Neon Smile": return smile("#ffffff", 10);
    case "Happy LED": return dots("#2ee6ff") + smile("#2ee6ff");
    case "Angry LED":
      return `<line x1="${lx - e}" y1="${eyeY - e * 0.4}" x2="${lx + e}" y2="${eyeY + e * 0.6}" stroke="#ff3131" stroke-width="11" stroke-linecap="round"/>
        <line x1="${rx + e}" y1="${eyeY - e * 0.4}" x2="${rx - e}" y2="${eyeY + e * 0.6}" stroke="#ff3131" stroke-width="11" stroke-linecap="round"/>
        <polyline points="${mcx - mw / 2.4},${mouthY + 8} ${mcx - mw / 4.8},${mouthY - 6} ${mcx},${mouthY + 8} ${mcx + mw / 4.8},${mouthY - 6} ${mcx + mw / 2.4},${mouthY + 8}" fill="none" stroke="#ff3131" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "Heart Eyes": return heart(lx, "#ff5ca8") + heart(rx, "#ff5ca8") + smile("#ff5ca8", 8);
    case "Money Eyes": return glyph("#3dff73", "$") + smile("#3dff73");
    case "Bitcoin Eyes": return glyph("#f7931a", "₿") + smile("#f7931a", 7);
    case "Solana Eyes":
      return `<circle cx="${lx}" cy="${eyeY}" r="${e}" fill="#9945FF"/><circle cx="${rx}" cy="${eyeY}" r="${e}" fill="#14F195"/>` + smile("#14F195", 7);
    case "Spiral Eyes":
      return `<path d="${spiralPath(lx, eyeY, e * 1.15)}" fill="none" stroke="#54e0ff" stroke-width="6" stroke-linecap="round"/>
        <path d="${spiralPath(rx, eyeY, e * 1.15)}" fill="none" stroke="#54e0ff" stroke-width="6" stroke-linecap="round"/>`;
    case "Laser Eyes":
      return `<rect x="${lx - 16}" y="${eyeY - 4}" width="32" height="8" rx="4" fill="#ff1744"/>
        <rect x="${rx - 16}" y="${eyeY - 4}" width="32" height="8" rx="4" fill="#ff1744"/>
        <rect x="${rx}" y="${eyeY - 2}" width="${S - rx}" height="5" fill="#ff1744" opacity="0.55" transform="rotate(6 ${rx} ${eyeY})"/>
        <rect x="0" y="${eyeY - 2}" width="${lx}" height="5" fill="#ff1744" opacity="0.35" transform="rotate(-4 ${lx} ${eyeY})"/>`;
    case "Rainbow": {
      const cols = ["#ff3131", "#ff9f1a", "#f5e642", "#3dff73", "#2ee6ff", "#b44dff"];
      return cols.map((c, i) =>
        `<path d="M ${mcx - mw / 2 - i * 6} ${mouthY - 4} Q ${mcx} ${mouthY + 30 + i * 6} ${mcx + mw / 2 + i * 6} ${mouthY - 4}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`
      ).join("") + dots("#ffffff", e * 0.7);
    }
    case "Pixel Face": {
      const px = e * 0.8;
      const sq = (x: number, y: number, c: string) => `<rect x="${x - px}" y="${y - px}" width="${px * 2}" height="${px * 2}" fill="${c}"/>`;
      let mo = "";
      for (let i = 0; i < 5; i++) mo += sq(mcx - mw / 2 + (mw / 4) * i, mouthY + (i === 1 || i === 3 ? 10 : i === 2 ? 14 : 0), "#3dff73");
      return sq(lx, eyeY, "#3dff73") + sq(rx, eyeY, "#3dff73") + mo;
    }
    default:
      return null; // plate-based
  }
}

function faceOverlaySvg(style: string, f: Rect): Buffer | null {
  const inner = faceSvg(style, f);
  if (inner === null || inner === "") return inner === "" ? null : null;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>
    <g filter="url(#glow)" opacity="0.9">${inner}</g>
    <g filter="url(#glow)" opacity="0.6">${inner}</g>
    ${inner}
  </svg>`);
}

// ---------- main ----------
async function renderNft(id: number, outDir: string): Promise<HoodNft> {
  const nft = getNft(id);
  const { background, hood, face, hat, accessory } = nft.traits;
  const [bg, ch] = await Promise.all([backgroundLayer(background), characterLayer(hood, accessory)]);

  const layers: Layer[] = [{ input: ch.png }];

  const plate = await facePlateLayer(face, ch.m);
  if (plate) layers.push(plate);
  const svg = faceOverlaySvg(face, ch.m.face);
  if (svg) layers.push({ input: await sharp(svg).png().toBuffer() });

  for (const l of await accessoryLayers(accessory, ch.m)) layers.push(l);

  const hatL = await hatLayer(hat, ch.m);
  if (hatL) layers.push(hatL);

  const composed = await sharp(bg)
    .composite(layers.map((l) => ({ input: l.input, left: l.left, top: l.top, blend: (l.blend ?? "over") as any })))
    .png()
    .toBuffer();
  await sharp(composed).resize(OUT, OUT).png().toFile(`${outDir}/${id}.png`);
  return nft;
}

const args = process.argv.slice(2);
let ids: number[] = [];
if (args[0] === "all") ids = Array.from({ length: TOTAL_SUPPLY }, (_, i) => i + 1);
else if (args[0]?.match(/^\d+-\d+$/)) {
  const [a, b] = args[0].split("-").map(Number);
  for (let i = a; i <= Math.min(b, TOTAL_SUPPLY); i++) ids.push(i);
} else ids = args.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_SUPPLY);

if (ids.length === 0) {
  console.error("usage: npx tsx scripts/generate3.mts <id...> | all | 1-100");
  process.exit(1);
}

const outDir = "public/hoodz";
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const nft = await renderNft(id, outDir);
  console.log(`${nft.name} [${nft.rarity}]`, JSON.stringify(nft.traits));
}
