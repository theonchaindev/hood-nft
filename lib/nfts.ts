// Deterministic procedural generation of the HOODZ collection.
// Every NFT is derived from its id via a seeded PRNG, so the collection
// is stable across builds. Art is rendered by scripts/generate3.mts.

export const TOTAL_SUPPLY = 1000;

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface HoodTraits {
  background: string;
  hood: string;
  face: string;
  hat: string;
  accessory: string;
}

export interface HoodNft {
  id: number;
  name: string;
  traits: HoodTraits;
  rarity: Rarity;
  score: number;
  price: number; // in SOL
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface WeightedTrait {
  value: string;
  weight: number;
}

function pick(rand: () => number, options: WeightedTrait[]): WeightedTrait {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let roll = rand() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return options[options.length - 1];
}

const w = (value: string, weight: number): WeightedTrait => ({ value, weight });

export const BACKGROUNDS: WeightedTrait[] = [
  // solids (SVG)
  w("Solid Charcoal", 5), w("Solid Purple", 4.5), w("Solid Blue", 4.5),
  w("Solid Green", 4), w("Solid Red", 4), w("Solid Pink", 3.5),
  w("Solid Orange", 3.5), w("Solid Teal", 3.5), w("Solid Yellow", 3),
  w("Solid Mint", 3), w("Solid Cream", 3), w("Solid Lavender", 3),
  // painted plates
  w("Purple Storm", 4), w("Moon", 3.5), w("Sunset", 3.5), w("Clouds", 3.5),
  w("Graffiti", 3), w("Jungle", 3), w("Desert", 3), w("Ocean", 3),
  w("Ice", 2.8), w("Space", 2.8), w("Cyberpunk", 2.5), w("Fire", 2.5),
  w("Emerald Storm", 2.2), w("Castle", 2.2), w("Synthwave", 2),
  w("Matrix", 1.8), w("Money Rain", 1.8), w("Blood Storm", 1.6),
  w("Blue Inferno", 1.4), w("Autumn Jungle", 1.4), w("Sunset Clouds", 1.4),
  w("Crimson Space", 1.2), w("Amethyst Cave", 1.2), w("Red Matrix", 1),
  w("Midnight Synthwave", 1), w("Neon", 1), w("Comic Halftone", 1),
  w("Gold", 0.9), w("Golden Storm", 0.7), w("Diamond", 0.6), w("Void", 0.4),
];

export const HOODS: WeightedTrait[] = [
  w("Lime", 7), w("Purple", 6.5), w("Black", 6), w("Blue", 5.5),
  w("Red", 5.5), w("White", 5), w("Orange", 4.5), w("Pink", 4.5),
  w("Silver", 4), w("Emerald", 3.8), w("Crimson", 3.5), w("Sapphire", 3.5),
  w("Ice", 3.2), w("Neon", 3), w("Toxic", 2.8), w("Camo", 2.6),
  w("Denim", 2.5), w("Wood", 2.2), w("Stone", 2.2), w("Digital Camo", 2),
  w("Zombie", 1.8), w("Gold", 1.6), w("Chrome", 1.5), w("Lava", 1.4),
  w("Cyber", 1.2), w("Gucci", 1), w("Louis Vuitton", 0.9),
  w("Crystal", 0.8), w("Galaxy", 0.7), w("Rainbow", 0.6),
];

// NOTE: only traits with painted layers (or pure glow/effect overlays) are
// listed. Items awaiting Meshy credits to be painted live in lib/pending-traits.md
export const FACES: WeightedTrait[] = [
  w("Glowing Eyes", 6), w("Empty Void", 5.5), w("Neon Smile", 5),
  w("X Eyes", 4.8), w("Happy LED", 4.5), w("Stitched Smile", 4.2),
  w("Red Eyes", 4), w("Angry LED", 3.8), w("Heart Eyes", 3.5),
  w("Money Eyes", 3.2), w("Spiral Eyes", 3), w("Pixel Face", 2.8),
  w("Skull", 2.6), w("Zombie", 2.5), w("Ghost", 2.4), w("Hollow", 2.3),
  w("Smoke", 2.2), w("Fire", 2.1), w("Ice", 2), w("Ninja", 2),
  w("Pumpkin", 1.9), w("Vampire", 1.8), w("Alien", 1.8), w("Rainbow", 1.7),
  w("Laser Eyes", 1.6), w("TV Screen", 1.5), w("Matrix Code", 1.5),
  w("Robot", 1.4), w("Cyborg", 1.3), w("Demon", 1.2),
  w("Bitcoin Eyes", 0.9), w("Solana Eyes", 0.9),
];

export const HATS: WeightedTrait[] = [
  w("None", 22), w("Beanie", 5.5), w("Cap", 5.5), w("Bucket Hat", 4.3),
  w("Cowboy Hat", 3.5), w("Fedora", 3.2),
  w("Chef Hat", 3), w("Construction Helmet", 3), w("Police Cap", 2.8),
  w("Santa Hat", 2.6), w("Graduation Cap", 2.5), w("Top Hat", 2.4),
  w("Army Helmet", 2.4), w("Pirate Hat", 2.2), w("Headphones", 2.2),
  w("Bunny Ears", 2), w("Cat Ears", 2),
  w("Wizard Hat", 1.7), w("Viking Helmet", 1.6),
  w("Crown", 0.8),
];

export const ACCESSORIES: WeightedTrait[] = [
  w("None", 18), w("Gold Chain", 4.5), w("Silver Chain", 4),
  w("Cigar", 3.5), w("Sunglasses", 3.5), w("Coffee", 3.2),
  w("Lollipop", 3), w("Bubblegum", 3), w("Rose", 2.8), w("Pipe", 2.6),
  w("Energy Drink", 2.5), w("AirPods", 2.4), w("Earring", 2.4),
  w("Baseball Bat", 2.2), w("Pixel Glasses", 2.2), w("Nose Ring", 2),
  w("Frog", 1.9), w("Snake", 1.8), w("Mini Ghost", 1.8),
  w("Shoulder Raven", 1.7), w("Monocle", 1.6), w("Floating Cards", 1.5),
  w("Katana", 1.5),
  w("Hearts", 1.3), w("Stars", 1.2), w("Skulls", 1.2), w("Smoke", 1.1),
  w("Ice Aura", 1.1), w("Emerald Chain", 1), w("Rose Gold Chain", 1),
  w("Money Rain", 0.9), w("Lightning", 0.9), w("Fire", 0.8),
  w("Neon Aura", 0.8), w("Obsidian Chain", 0.7),
  w("Diamond Chain", 0.5), w("Rainbow Chain", 0.4),
];

const TRAIT_TABLES = {
  background: BACKGROUNDS,
  hood: HOODS,
  face: FACES,
  hat: HATS,
  accessory: ACCESSORIES,
} as const;

function rawScore(id: number): { traits: HoodTraits; score: number } {
  const rand = mulberry32(id * 7919 + 13);
  const traits = {} as HoodTraits;
  let score = 0;
  for (const key of Object.keys(TRAIT_TABLES) as (keyof HoodTraits)[]) {
    const table = TRAIT_TABLES[key];
    const total = table.reduce((s, o) => s + o.weight, 0);
    const picked = pick(rand, table);
    traits[key] = picked.value;
    // rarer traits contribute more: inverse-frequency scoring
    score += total / picked.weight;
  }
  return { traits, score: Math.round(score) };
}

// Tier cutoffs are percentile-based over the real collection so the
// distribution is guaranteed: 10 Legendary, 40 Epic, 100 Rare, 250 Uncommon.
let cutoffs: { legendary: number; epic: number; rare: number; uncommon: number } | null = null;

function getCutoffs() {
  if (!cutoffs) {
    const scores: number[] = [];
    for (let i = 1; i <= TOTAL_SUPPLY; i++) scores.push(rawScore(i).score);
    scores.sort((a, b) => b - a);
    cutoffs = {
      legendary: scores[9],
      epic: scores[49],
      rare: scores[149],
      uncommon: scores[399],
    };
  }
  return cutoffs;
}

function rarityFromScore(score: number): Rarity {
  const c = getCutoffs();
  if (score >= c.legendary) return "Legendary";
  if (score >= c.epic) return "Epic";
  if (score >= c.rare) return "Rare";
  if (score >= c.uncommon) return "Uncommon";
  return "Common";
}

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: "#8c9196",
  Uncommon: "#00c805",
  Rare: "#00b8d9",
  Epic: "#a259ff",
  Legendary: "#f5b400",
};

const RARITY_PRICE: Record<Rarity, number> = {
  Common: 0.25,
  Uncommon: 0.5,
  Rare: 1.2,
  Epic: 3,
  Legendary: 8,
};

export function getNft(id: number): HoodNft {
  const { traits, score } = rawScore(id);
  const rarity = rarityFromScore(score);
  return {
    id,
    name: `HOODZ #${String(id).padStart(4, "0")}`,
    traits,
    rarity,
    score,
    price: RARITY_PRICE[rarity],
  };
}

export function getAllNfts(): HoodNft[] {
  const out: HoodNft[] = [];
  for (let i = 1; i <= TOTAL_SUPPLY; i++) out.push(getNft(i));
  return out;
}
