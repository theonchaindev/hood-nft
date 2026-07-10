// Renders HOODZ NFTs from assets/hoodz-base.png + the trait system in lib/nfts.ts.
// Usage: npx tsx scripts/generate.mts 1 2 3 666   (or "all" for the full supply)

import sharp from "sharp";
import { mkdirSync } from "fs";
import { getNft, TOTAL_SUPPLY, HoodNft } from "../lib/nfts";

const W = 400;
const H = 400;

// ---------- hood recolor targets (hue °, sat/light multipliers) ----------
interface HoodTransform {
  hue: number | null; // null = keep original lime
  satMul: number;
  lightMul: number;
  holo?: boolean;
}

const HOOD_TRANSFORMS: Record<string, HoodTransform> = {
  "Classic Green": { hue: null, satMul: 1, lightMul: 1 }, // original volt lime
  "Stealth Black": { hue: 210, satMul: 0.08, lightMul: 0.32 },
  "Banker Navy": { hue: 222, satMul: 0.75, lightMul: 0.55 },
  "Crimson Dip": { hue: 352, satMul: 0.85, lightMul: 0.72 },
  "Royal Purple": { hue: 268, satMul: 0.8, lightMul: 0.72 },
  "Arctic White": { hue: 210, satMul: 0.06, lightMul: 1.18 },
  "24K Gold": { hue: 44, satMul: 1.05, lightMul: 0.88 },
  Holographic: { hue: 190, satMul: 0.9, lightMul: 0.95, holo: true },
};

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
  h = ((h % 360) + 360) % 360 / 360;
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

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

// ---------- character layer: transparent bg + recolored hood ----------
let baseCache: Buffer | null = null;
let bgMaskCache: Uint8Array | null = null;

async function loadBase() {
  if (baseCache && bgMaskCache) return { data: baseCache, bgMask: bgMaskCache };
  const { data } = await sharp("assets/hoodz-base.png")
    .raw()
    .toBuffer({ resolveWithObject: true });

  // flood-fill the uniform gray from the corners to build a background mask,
  // so gray/white pixels inside the character are left alone
  const bgMask = new Uint8Array(W * H);
  const isBgColor = (i: number) =>
    Math.abs(data[i * 3] - 229) <= 8 &&
    Math.abs(data[i * 3 + 1] - 229) <= 8 &&
    Math.abs(data[i * 3 + 2] - 229) <= 8;
  const queue: number[] = [];
  for (const start of [0, W - 1, (H - 1) * W, H * W - 1]) {
    if (isBgColor(start)) { queue.push(start); bgMask[start] = 1; }
  }
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (!bgMask[ni] && isBgColor(ni)) { bgMask[ni] = 1; queue.push(ni); }
    }
  }
  baseCache = data;
  bgMaskCache = bgMask;
  return { data, bgMask };
}

async function characterLayer(hoodName: string): Promise<Buffer> {
  const { data, bgMask } = await loadBase();
  const t = HOOD_TRANSFORMS[hoodName] ?? HOOD_TRANSFORMS["Classic Green"];
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (bgMask[i]) {
      out[i * 4 + 3] = 0; // background -> transparent
      continue;
    }
    let [nr, ng, nb] = [r, g, b];
    const [h, s, l] = rgbToHsl(r, g, b);
    // lime family = the hoodie; leave outlines / face / highlights alone
    if (s > 0.25 && h >= 40 && h <= 105) {
      const hue = t.holo
        ? (t.hue ?? 0) + (((i % W) + ((i / W) | 0)) / (W + H)) * 160
        : t.hue;
      if (hue !== null) {
        [nr, ng, nb] = hslToRgb(hue, Math.min(1, s * t.satMul), Math.min(0.97, l * t.lightMul));
      }
    }
    out[i * 4] = clamp255(nr);
    out[i * 4 + 1] = clamp255(ng);
    out[i * 4 + 2] = clamp255(nb);
    out[i * 4 + 3] = 255;
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// ---------- background + aura layer (behind character) ----------
const BG_GRADS: Record<string, [string, string]> = {
  Midnight: ["#0b0f14", "#161e28"],
  Forest: ["#0a1c10", "#12321d"],
  "Bull Run": ["#06280f", "#0d4a1e"],
  "After Hours": ["#100c20", "#221942"],
  Candlesticks: ["#0b0e13", "#141b24"],
  "Money Printer": ["#131807", "#26380e"],
  "Golden Hour": ["#241804", "#4a340c"],
  Matrix: ["#020e05", "#04200e"],
};

function seeded(id: number, salt: number) {
  const x = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function bgDetailSvg(bg: string, id: number): string {
  if (bg === "Candlesticks") {
    let s = "";
    for (let i = 0; i < 8; i++) {
      const x = 14 + i * 48;
      const h = 30 + seeded(id, i) * 90;
      const y = 300 - h - seeded(id, i + 20) * 140;
      const c = seeded(id, i + 40) > 0.4 ? "#00c805" : "#e8452f";
      s += `<line x1="${x + 8}" y1="${y - 20}" x2="${x + 8}" y2="${y + h + 20}" stroke="${c}" stroke-width="2" opacity="0.5"/>`;
      s += `<rect x="${x}" y="${y}" width="16" height="${h}" rx="2" fill="${c}" opacity="0.5"/>`;
    }
    return s;
  }
  if (bg === "Matrix") {
    let s = "";
    for (let i = 0; i < 13; i++) {
      s += `<text x="${8 + i * 31}" y="${36 + seeded(id, i) * 350}" fill="#00ff41" opacity="0.45" font-size="17" font-family="monospace">${Math.round(seeded(id, i + 7) * 9)}${Math.round(seeded(id, i + 13) * 9)}${Math.round(seeded(id, i + 17) * 9)}</text>`;
    }
    return s;
  }
  if (bg === "Bull Run" || bg === "Money Printer") {
    const pts = Array.from({ length: 9 }, (_, i) => `${i * 50},${340 - i * 24 - seeded(id, i) * 40}`).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="#00e806" stroke-width="4" opacity="0.55"/>`;
  }
  if (bg === "Golden Hour")
    return `<circle cx="200" cy="130" r="140" fill="#ffb300" opacity="0.28"/><circle cx="200" cy="130" r="90" fill="#ffd54a" opacity="0.22"/>`;
  if (bg === "After Hours") {
    let s = "";
    for (let i = 0; i < 22; i++)
      s += `<circle cx="${seeded(id, i) * 400}" cy="${seeded(id, i + 50) * 260}" r="${1 + seeded(id, i + 90)}" fill="#cbd5ff" opacity="0.8"/>`;
    return s;
  }
  return "";
}

function auraSvg(aura: string): string {
  switch (aura) {
    case "Green Candle":
      return `<rect x="145" y="20" width="110" height="380" rx="14" fill="#00c805" opacity="0.22"/>`;
    case "Uptrend":
      return `<polyline points="20,350 110,295 175,320 260,215 385,105" fill="none" stroke="#00e806" stroke-width="8" opacity="0.5" stroke-linecap="round"/>`;
    case "Moonlight":
      return `<circle cx="200" cy="190" r="165" fill="#9db8ff" opacity="0.2"/>`;
    case "Solar Flare":
      return `<circle cx="200" cy="190" r="175" fill="#ff7a00" opacity="0.26"/><circle cx="200" cy="190" r="110" fill="#ffb300" opacity="0.2"/>`;
    case "Diamond Dust": {
      let s = "";
      for (let i = 0; i < 16; i++)
        s += `<path d="M ${22 + i * 24} ${50 + (i % 5) * 68} l 5 7 l -5 7 l -5 -7 Z" fill="#9be8ff" opacity="0.8"/>`;
      return s;
    }
    case "God Candle":
      return `<rect x="165" y="0" width="70" height="400" fill="#00ff41" opacity="0.3"/><rect x="186" y="0" width="28" height="400" fill="#eaffea" opacity="0.4"/>`;
    default:
      return "";
  }
}

function backgroundLayer(nft: HoodNft): Buffer {
  const [from, to] = BG_GRADS[nft.traits.background] ?? BG_GRADS.Midnight;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${bgDetailSvg(nft.traits.background, nft.id)}
    ${auraSvg(nft.traits.aura)}
  </svg>`;
  return Buffer.from(svg);
}

// ---------- eyes + accessories (on top of character) ----------
// face opening is the black blob roughly x 95..235, y 60..290
const EYE_L = { x: 152, y: 178 };
const EYE_R = { x: 205, y: 182 };

function eyesSvg(eyes: string): string {
  const glow = (color: string, inner: string) => `
    <g filter="url(#blur)">${inner.replaceAll("EYECOL", color)}</g>
    ${inner.replaceAll("EYECOL", color)}`;
  switch (eyes) {
    case "Green Glow":
      return glow("#00ff41", `<circle cx="${EYE_L.x}" cy="${EYE_L.y}" r="9" fill="EYECOL"/><circle cx="${EYE_R.x}" cy="${EYE_R.y}" r="9" fill="EYECOL"/>`);
    case "Steady Gaze":
      return glow("#e8eef4", `<ellipse cx="${EYE_L.x}" cy="${EYE_L.y}" rx="10" ry="3.5" fill="EYECOL"/><ellipse cx="${EYE_R.x}" cy="${EYE_R.y}" rx="10" ry="3.5" fill="EYECOL"/>`);
    case "Bull Eyes":
      return glow("#ff3b30", `<circle cx="${EYE_L.x}" cy="${EYE_L.y}" r="9" fill="EYECOL"/><circle cx="${EYE_R.x}" cy="${EYE_R.y}" r="9" fill="EYECOL"/>`);
    case "Diamond":
      return glow("#9be8ff", `<path d="M ${EYE_L.x} ${EYE_L.y - 10} l 9 10 l -9 10 l -9 -10 Z" fill="EYECOL"/><path d="M ${EYE_R.x} ${EYE_R.y - 10} l 9 10 l -9 10 l -9 -10 Z" fill="EYECOL"/>`);
    case "Laser":
      return glow("#ff1744", `<rect x="${EYE_L.x - 16}" y="${EYE_L.y - 4}" width="32" height="8" rx="4" fill="EYECOL"/><rect x="${EYE_R.x - 16}" y="${EYE_R.y - 4}" width="32" height="8" rx="4" fill="EYECOL"/>`) +
        `<rect x="${EYE_R.x}" y="${EYE_R.y - 2}" width="200" height="4" fill="#ff1744" opacity="0.55" transform="rotate(6 ${EYE_R.x} ${EYE_R.y})"/>`;
    case "Ticker Tape":
      return glow("#00ff41", `<text x="${EYE_L.x - 9}" y="${EYE_L.y + 7}" font-size="19" font-family="monospace" font-weight="700" fill="EYECOL">▲</text><text x="${EYE_R.x - 9}" y="${EYE_R.y + 7}" font-size="19" font-family="monospace" font-weight="700" fill="EYECOL">▲</text>`);
    case "Golden Stare":
      return glow("#ffd54a", `<circle cx="${EYE_L.x}" cy="${EYE_L.y}" r="9" fill="EYECOL"/><circle cx="${EYE_R.x}" cy="${EYE_R.y}" r="9" fill="EYECOL"/>`);
    case "Singularity":
      return glow("#ffffff", `<circle cx="${EYE_L.x}" cy="${EYE_L.y}" r="9" fill="none" stroke="EYECOL" stroke-width="3.5"/><circle cx="${EYE_R.x}" cy="${EYE_R.y}" r="9" fill="none" stroke="EYECOL" stroke-width="3.5"/>`);
    default:
      return "";
  }
}

function accessorySvg(accessory: string): string {
  switch (accessory) {
    case "Feather":
      return `<g transform="rotate(-28 302 96)"><ellipse cx="302" cy="96" rx="11" ry="38" fill="#ff5000" stroke="#111" stroke-width="3"/><line x1="302" y1="62" x2="302" y2="132" stroke="#a33200" stroke-width="3"/></g>`;
    case "Gold Chain": {
      let links = "";
      for (let i = 0; i < 9; i++) {
        const x = 128 + i * 18;
        const y = 352 + Math.pow(Math.abs(i - 4), 1.6) * -3.4 + 14;
        links += `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#f5b400" stroke-width="5"/>`;
      }
      return links + `<circle cx="200" cy="378" r="13" fill="#f5b400" stroke="#9e770a" stroke-width="2"/><text x="200" y="384" text-anchor="middle" font-size="16" font-weight="800" fill="#0b0f14" font-family="Arial">H</text>`;
    }
    case "Diamond Hands":
      return `<path d="M 96 358 l 16 -20 h 28 l 16 20 l -30 30 Z" fill="#9be8ff" stroke="#0a6a80" stroke-width="3"/><path d="M 244 358 l 16 -20 h 28 l 16 20 l -30 30 Z" fill="#9be8ff" stroke="#0a6a80" stroke-width="3"/>`;
    case "Bull Horns":
      return `<path d="M 92 96 C 62 70 58 36 80 14 C 74 54 90 74 114 84 Z" fill="#f2f2f2" stroke="#111" stroke-width="4"/><path d="M 320 110 C 350 84 354 50 332 28 C 338 68 322 88 298 98 Z" fill="#f2f2f2" stroke="#111" stroke-width="4"/>`;
    case "Crown":
      return `<g transform="rotate(-8 190 40)"><path d="M 140 62 L 148 22 L 172 46 L 192 10 L 212 46 L 236 22 L 244 62 Z" fill="#f5b400" stroke="#111" stroke-width="4"/><circle cx="148" cy="20" r="6" fill="#ff3b30"/><circle cx="192" cy="8" r="6" fill="#00b8d9"/><circle cx="236" cy="20" r="6" fill="#00c805"/></g>`;
    case "Halo":
      return `<ellipse cx="195" cy="18" rx="60" ry="13" fill="none" stroke="#ffe27a" stroke-width="8" opacity="0.95"/>`;
    case "Infinite Money Glitch":
      return `<text x="86" y="60" font-size="34" fill="#00ff41" font-family="monospace" font-weight="700">$</text>
        <text x="300" y="90" font-size="26" fill="#00ff41" font-family="monospace" opacity="0.8">$</text>
        <text x="60" y="180" font-size="24" fill="#00ff41" font-family="monospace" opacity="0.7">$</text>
        <text x="330" y="210" font-size="30" fill="#00ff41" font-family="monospace" opacity="0.85">$</text>
        <ellipse cx="195" cy="18" rx="48" ry="12" fill="none" stroke="#00ff41" stroke-width="5" stroke-dasharray="12 7"/>`;
    default:
      return "";
  }
}

function overlayLayer(nft: HoodNft): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><filter id="blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter></defs>
    ${eyesSvg(nft.traits.eyes)}
    ${accessorySvg(nft.traits.accessory)}
  </svg>`;
  return Buffer.from(svg);
}

// candle auras get a screen-blended pass over the whole image so the beam
// glows through the character instead of hiding behind it
function auraGlowLayer(aura: string): Buffer | null {
  let inner = "";
  if (aura === "God Candle")
    inner = `<rect x="150" y="0" width="100" height="400" fill="#00ff41" opacity="0.32"/>
      <rect x="180" y="0" width="40" height="400" fill="#baffba" opacity="0.35"/>`;
  else if (aura === "Green Candle")
    inner = `<rect x="150" y="30" width="100" height="370" rx="14" fill="#00c805" opacity="0.3"/>`;
  else return null;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10"/></filter></defs>
      <g filter="url(#soft)">${inner}</g>
    </svg>`
  );
}

// ---------- main ----------
async function renderNft(id: number, outDir: string) {
  const nft = getNft(id);
  const character = await characterLayer(nft.traits.hood);
  const glow = auraGlowLayer(nft.traits.aura);
  await sharp(backgroundLayer(nft))
    .composite([
      { input: character },
      ...(glow ? [{ input: glow, blend: "screen" as const }] : []),
      { input: overlayLayer(nft) },
    ])
    .png()
    .toFile(`${outDir}/${id}.png`);
  return nft;
}

const args = process.argv.slice(2);
const ids =
  args[0] === "all"
    ? Array.from({ length: TOTAL_SUPPLY }, (_, i) => i + 1)
    : args.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_SUPPLY);

if (ids.length === 0) {
  console.error("usage: npx tsx scripts/generate.mts <id...> | all");
  process.exit(1);
}

const outDir = "public/hoodz";
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const nft = await renderNft(id, outDir);
  console.log(`${nft.name} [${nft.rarity}]`, JSON.stringify(nft.traits));
}
