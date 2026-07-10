// HOODZ v2 renderer — layered composition from AI-painted masters:
//   assets/master.png          purple hoodie + gold cuban chain, flat gray bg
//   assets/master-nochain.png  same without the chain
//   assets/bg-*.png            painted background plates (hue-shifted per trait)
// Hood + chain are recolored via hue remap on the original pixels (masks are
// computed before any recolor so a gold hood never bleeds into the chain).
// Neon faces + auras are SVG overlays. Usage: npx tsx scripts/generate2.mts <ids|all>

import sharp from "sharp";
import { mkdirSync } from "fs";
import { getNft, TOTAL_SUPPLY, HoodNft } from "../lib/nfts";

const S = 1024; // working canvas
const OUT = 800; // output size

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

// ---------- masters ----------
interface Master {
  data: Buffer; // rgb
  bgMask: Uint8Array;
  hoodMask: Uint8Array;
  chainMask: Uint8Array;
  face: { x: number; y: number; w: number; h: number };
}

const masters: Record<string, Master> = {};

async function loadMaster(file: string): Promise<Master> {
  if (masters[file]) return masters[file];
  const { data } = await sharp(`assets/${file}`)
    .resize(S, S)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // flood-fill the flat gray from the corners (tolerant of JPEG noise)
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

  // trait masks computed on ORIGINAL colors
  const hoodMask = new Uint8Array(S * S);
  const chainMask = new Uint8Array(S * S);
  const rowBlack = new Uint32Array(S);
  const colBlack = new Uint32Array(S);
  for (let i = 0; i < S * S; i++) {
    if (bgMask[i]) continue;
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s > 0.18 && h >= 245 && h <= 315) hoodMask[i] = 1;
    else if (s > 0.3 && h >= 20 && h <= 70 && l > 0.12 && l < 0.97) chainMask[i] = 1;
    if (Math.max(r, g, b) < 30) {
      rowBlack[(i / S) | 0]++;
      colBlack[i % S]++;
    }
  }

  // face = the dense contiguous band of black rows/cols (outlines are sparse)
  const band = (counts: Uint32Array) => {
    const max = Math.max(...counts);
    const thr = max * 0.35;
    let a = -1, b = -1;
    for (let i = 0; i < S; i++) {
      if (counts[i] > thr) { if (a < 0) a = i; b = i; }
    }
    return [a, b] as const;
  };
  const [fy0, fy1] = band(rowBlack);
  const [fx0, fx1] = band(colBlack);
  const face = { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 };

  masters[file] = { data, bgMask, hoodMask, chainMask, face };
  return masters[file];
}

// ---------- recolor targets ----------
interface Remap { hue: number | null; satMul: number; lightMul: number; sweep?: boolean }

const HOOD_REMAP: Record<string, Remap> = {
  "Royal Purple": { hue: null, satMul: 1, lightMul: 1 },
  "Stealth Black": { hue: 260, satMul: 0.1, lightMul: 0.35 },
  "Bull Green": { hue: 132, satMul: 0.85, lightMul: 0.82 },
  Crimson: { hue: 352, satMul: 0.9, lightMul: 0.85 },
  Volt: { hue: 68, satMul: 0.95, lightMul: 1.02 },
  "Ice Blue": { hue: 202, satMul: 0.7, lightMul: 1.02 },
  "24K Gold": { hue: 45, satMul: 1, lightMul: 0.95 },
  Holographic: { hue: 180, satMul: 0.85, lightMul: 1, sweep: true },
};

const CHAIN_REMAP: Record<string, Remap> = {
  "Gold Cuban": { hue: null, satMul: 1, lightMul: 1 },
  "Silver Cuban": { hue: 210, satMul: 0.06, lightMul: 1.05 },
  "Rose Gold": { hue: 13, satMul: 0.6, lightMul: 1.02 },
  "Emerald Links": { hue: 140, satMul: 0.85, lightMul: 0.88 },
  Obsidian: { hue: 265, satMul: 0.25, lightMul: 0.4 },
  "Iced Out": { hue: 197, satMul: 0.45, lightMul: 1.15 },
  "Rainbow Links": { hue: 0, satMul: 0.9, lightMul: 1, sweep: true },
};

async function characterLayer(hood: string, chain: string): Promise<{ png: Buffer; face: Master["face"] }> {
  const file = chain === "No Chain" ? "master-nochain.png" : "master.png";
  const m = await loadMaster(file);
  const hoodT = HOOD_REMAP[hood] ?? HOOD_REMAP["Royal Purple"];
  const chainT = chain === "No Chain" ? null : CHAIN_REMAP[chain] ?? CHAIN_REMAP["Gold Cuban"];
  const out = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    if (m.bgMask[i]) { out[i * 4 + 3] = 0; continue; }
    let r = m.data[i * 3], g = m.data[i * 3 + 1], b = m.data[i * 3 + 2];
    const t = m.hoodMask[i] ? hoodT : m.chainMask[i] && chainT ? chainT : null;
    if (t && t.hue !== null) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const hue = t.sweep ? t.hue + (((i % S) + ((i / S) | 0)) / (2 * S)) * 300 : t.hue;
      [r, g, b] = hslToRgb(hue, Math.min(1, s * t.satMul), Math.min(0.97, l * t.lightMul));
    }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  const png = await sharp(out, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer();
  return { png, face: m.face };
}

// ---------- backgrounds ----------
// plate + border-crop inset + hue rotation
const BG_PLATES: Record<string, { file: string; inset: number; hue: number; sat?: number; bright?: number }> = {
  "Purple Storm": { file: "bg-storm.png", inset: 0.1, hue: 0 },
  "Emerald Storm": { file: "bg-storm.png", inset: 0.1, hue: -150 },
  "Blood Storm": { file: "bg-storm.png", inset: 0.1, hue: 85 },
  "Golden Storm": { file: "bg-storm.png", inset: 0.1, hue: 135, sat: 1.15 },
  "Bull Chart": { file: "bg-chart.png", inset: 0.02, hue: 0 },
  Moonlight: { file: "bg-night.png", inset: 0, hue: 0 },
  "Money Rain": { file: "bg-money.png", inset: 0.12, hue: 0 },
};

async function backgroundLayer(bg: string): Promise<Buffer> {
  if (bg === "Void") {
    return sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
        <defs><radialGradient id="v" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0%" stop-color="#17101f"/><stop offset="70%" stop-color="#0a070e"/><stop offset="100%" stop-color="#020103"/>
        </radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#v)"/>
      </svg>`)
    ).png().toBuffer();
  }
  const p = BG_PLATES[bg] ?? BG_PLATES["Purple Storm"];
  const inset = Math.round(1024 * p.inset);
  let img = sharp(`assets/${p.file}`)
    .extract({ left: inset, top: inset, width: 1024 - inset * 2, height: 1024 - inset * 2 })
    .resize(S, S);
  img = img.modulate({ hue: p.hue, saturation: p.sat ?? 1, brightness: p.bright ?? 1 });
  return img.png().toBuffer();
}

// ---------- neon faces ----------
function spiralPath(cx: number, cy: number, rMax: number): string {
  let d = `M ${cx} ${cy}`;
  const turns = 2.6, steps = 60;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = t * rMax;
    d += ` L ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d;
}

function faceSvg(style: string, f: Master["face"]): string {
  const eyeY = f.y + f.h * 0.44;
  const lx = f.x + f.w * 0.32;
  const rx = f.x + f.w * 0.68;
  const e = f.w * 0.09; // eye half-size
  const mouthY = f.y + f.h * 0.68;
  const mcx = f.x + f.w * 0.5;
  const mw = f.w * 0.46;

  const xEye = (cx: number, color: string, w = 10) =>
    `<line x1="${cx - e}" y1="${eyeY - e}" x2="${cx + e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>
     <line x1="${cx + e}" y1="${eyeY - e}" x2="${cx - e}" y2="${eyeY + e}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

  const stitchedSmile = (color: string) => {
    const y0 = mouthY;
    let s = `<path d="M ${mcx - mw / 2} ${y0 - 14} Q ${mcx} ${y0 + 26} ${mcx + mw / 2} ${y0 - 14}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const x = mcx - mw / 2 + mw * t;
      const y = y0 - 14 + Math.sin(Math.PI * t) * 34 - 14 * (1 - Math.abs(t - 0.5) * 2) * 0;
      const yc = y0 - 14 + (4 * t * (1 - t)) * 40; // point on the quad curve
      s += `<line x1="${x}" y1="${yc - 12}" x2="${x}" y2="${yc + 12}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    }
    return s;
  };

  const heart = (cx: number, color: string) => {
    const s = e * 1.25;
    return `<path d="M ${cx} ${eyeY + s * 0.9} C ${cx - s * 1.6} ${eyeY - s * 0.4} ${cx - s * 0.7} ${eyeY - s * 1.4} ${cx} ${eyeY - s * 0.4} C ${cx + s * 0.7} ${eyeY - s * 1.4} ${cx + s * 1.6} ${eyeY - s * 0.4} ${cx} ${eyeY + s * 0.9} Z" fill="${color}"/>`;
  };

  let inner = "";
  switch (style) {
    case "Purple Purge":
      inner = xEye(lx, "#e08aff") + xEye(rx, "#e08aff") + stitchedSmile("#e08aff");
      break;
    case "Green Glow":
      inner = `<circle cx="${lx}" cy="${eyeY}" r="${e * 0.9}" fill="#39ff6a"/><circle cx="${rx}" cy="${eyeY}" r="${e * 0.9}" fill="#39ff6a"/>
        <path d="M ${mcx - mw / 2.6} ${mouthY} Q ${mcx} ${mouthY + 22} ${mcx + mw / 2.6} ${mouthY}" fill="none" stroke="#39ff6a" stroke-width="8" stroke-linecap="round"/>`;
      break;
    case "Dead Stare":
      inner = xEye(lx, "#f2f4f8", 8) + xEye(rx, "#f2f4f8", 8) +
        `<line x1="${mcx - mw / 3}" y1="${mouthY + 4}" x2="${mcx + mw / 3}" y2="${mouthY + 4}" stroke="#f2f4f8" stroke-width="7" stroke-linecap="round"/>`;
      break;
    case "Heart Eyes":
      inner = heart(lx, "#ff5ca8") + heart(rx, "#ff5ca8") +
        `<path d="M ${mcx - mw / 2.8} ${mouthY} Q ${mcx} ${mouthY + 26} ${mcx + mw / 2.8} ${mouthY}" fill="none" stroke="#ff5ca8" stroke-width="8" stroke-linecap="round"/>`;
      break;
    case "Bull Rage":
      inner = `<line x1="${lx - e}" y1="${eyeY - e * 0.4}" x2="${lx + e}" y2="${eyeY + e * 0.6}" stroke="#ff3131" stroke-width="11" stroke-linecap="round"/>
        <line x1="${rx + e}" y1="${eyeY - e * 0.4}" x2="${rx - e}" y2="${eyeY + e * 0.6}" stroke="#ff3131" stroke-width="11" stroke-linecap="round"/>
        <polyline points="${mcx - mw / 2.4},${mouthY + 8} ${mcx - mw / 4.8},${mouthY - 6} ${mcx},${mouthY + 8} ${mcx + mw / 4.8},${mouthY - 6} ${mcx + mw / 2.4},${mouthY + 8}" fill="none" stroke="#ff3131" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case "Spiral Daze":
      inner = `<path d="${spiralPath(lx, eyeY, e * 1.15)}" fill="none" stroke="#54e0ff" stroke-width="6" stroke-linecap="round"/>
        <path d="${spiralPath(rx, eyeY, e * 1.15)}" fill="none" stroke="#54e0ff" stroke-width="6" stroke-linecap="round"/>
        <path d="M ${mcx - mw / 3} ${mouthY} q ${mw / 9} 14 ${mw / 4.5} 0 q ${mw / 9} -14 ${mw / 4.5} 0" fill="none" stroke="#54e0ff" stroke-width="7" stroke-linecap="round"/>`;
      break;
    case "Dollar Vision":
      inner = `<text x="${lx}" y="${eyeY + e}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${e * 2.8}" fill="#3dff73">$</text>
        <text x="${rx}" y="${eyeY + e}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${e * 2.8}" fill="#3dff73">$</text>
        <path d="M ${mcx - mw / 2.4} ${mouthY - 6} Q ${mcx} ${mouthY + 30} ${mcx + mw / 2.4} ${mouthY - 6}" fill="none" stroke="#3dff73" stroke-width="9" stroke-linecap="round"/>`;
      break;
    case "Singularity":
      inner = `<circle cx="${lx}" cy="${eyeY}" r="${e}" fill="none" stroke="#ffffff" stroke-width="7"/>
        <circle cx="${rx}" cy="${eyeY}" r="${e}" fill="none" stroke="#ffffff" stroke-width="7"/>
        <circle cx="${lx}" cy="${eyeY}" r="${e * 0.3}" fill="#ffffff"/><circle cx="${rx}" cy="${eyeY}" r="${e * 0.3}" fill="#ffffff"/>`;
      break;
  }
  return inner;
}

function faceOverlay(style: string, f: Master["face"]): Buffer {
  const inner = faceSvg(style, f);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>
    <g filter="url(#glow)" opacity="0.9">${inner}</g>
    <g filter="url(#glow)" opacity="0.6">${inner}</g>
    ${inner}
  </svg>`);
}

// ---------- auras (screen-blended over everything) ----------
function auraOverlay(aura: string): Buffer | null {
  let inner = "";
  switch (aura) {
    case "Green Candle":
      inner = `<rect x="${S * 0.38}" y="${S * 0.05}" width="${S * 0.24}" height="${S * 0.95}" rx="30" fill="#00c805" opacity="0.3"/>`;
      break;
    case "God Candle":
      inner = `<rect x="${S * 0.36}" y="0" width="${S * 0.28}" height="${S}" fill="#00ff41" opacity="0.3"/>
        <rect x="${S * 0.45}" y="0" width="${S * 0.1}" height="${S}" fill="#d8ffd8" opacity="0.4"/>`;
      break;
    case "Ember Glow":
      inner = `<circle cx="${S / 2}" cy="${S * 0.52}" r="${S * 0.52}" fill="none" stroke="#ff7a1a" stroke-width="${S * 0.16}" opacity="0.4"/>`;
      break;
    case "Frost Halo":
      inner = `<circle cx="${S / 2}" cy="${S * 0.42}" r="${S * 0.34}" fill="none" stroke="#9fdcff" stroke-width="${S * 0.05}" opacity="0.5"/>`;
      break;
    case "Diamond Dust": {
      for (let i = 0; i < 22; i++) {
        const x = ((i * 467) % S + (i % 3) * 40) % S;
        const y = ((i * 271) % S);
        const r = 8 + (i % 4) * 5;
        inner += `<path d="M ${x} ${y - r} L ${x + r * 0.7} ${y} L ${x} ${y + r} L ${x - r * 0.7} ${y} Z" fill="#c8f2ff" opacity="0.85"/>`;
      }
      break;
    }
    case "Golden Hour":
      inner = `<rect width="${S}" height="${S * 0.6}" fill="url(#gh)" opacity="0.5"/>`;
      break;
    default:
      return null;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs>
      <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>
      <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffcf5c"/><stop offset="100%" stop-color="#ffcf5c" stop-opacity="0"/></linearGradient>
    </defs>
    <g filter="url(#soft)">${inner}</g>
  </svg>`);
}

// ---------- main ----------
const charCache = new Map<string, Promise<{ png: Buffer; face: Master["face"] }>>();

function cachedCharacter(hood: string, chain: string) {
  const key = `${hood}|${chain}`;
  if (!charCache.has(key)) charCache.set(key, characterLayer(hood, chain));
  return charCache.get(key)!;
}

async function renderNft(id: number, outDir: string): Promise<HoodNft> {
  const nft = getNft(id);
  const { background, hood, eyes, accessory, aura } = nft.traits;
  const [bg, ch] = await Promise.all([backgroundLayer(background), cachedCharacter(hood, accessory)]);
  const auraBuf = auraOverlay(aura);
  const composed = await sharp(bg)
    .composite([
      { input: ch.png },
      ...(auraBuf ? [{ input: auraBuf, blend: "screen" as const }] : []),
      { input: await sharp(faceOverlay(eyes, ch.face)).png().toBuffer() },
    ])
    .png()
    .toBuffer();
  await sharp(composed).resize(OUT, OUT).png().toFile(`${outDir}/${id}.png`);
  return nft;
}

const args = process.argv.slice(2);
const ids =
  args[0] === "all"
    ? Array.from({ length: TOTAL_SUPPLY }, (_, i) => i + 1)
    : args.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_SUPPLY);

if (ids.length === 0) {
  console.error("usage: npx tsx scripts/generate2.mts <id...> | all");
  process.exit(1);
}

const outDir = "public/hoodz";
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const nft = await renderNft(id, outDir);
  console.log(`${nft.name} [${nft.rarity}]`, JSON.stringify(nft.traits));
}
