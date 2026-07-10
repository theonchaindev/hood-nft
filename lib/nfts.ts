// Deterministic procedural generation of the HOOD collection.
// Every NFT is derived from its id via a seeded PRNG, so the collection
// is stable across builds with no stored assets.

export const TOTAL_SUPPLY = 1000;

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface HoodTraits {
  background: string;
  hood: string;
  eyes: string;
  accessory: string;
  aura: string;
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

export const BACKGROUNDS: WeightedTrait[] = [
  { value: "Midnight", weight: 30 },
  { value: "Forest", weight: 22 },
  { value: "Bull Run", weight: 16 },
  { value: "After Hours", weight: 12 },
  { value: "Candlesticks", weight: 9 },
  { value: "Money Printer", weight: 6 },
  { value: "Golden Hour", weight: 3.5 },
  { value: "Matrix", weight: 1.5 },
];

export const HOODS: WeightedTrait[] = [
  { value: "Classic Green", weight: 28 },
  { value: "Stealth Black", weight: 22 },
  { value: "Banker Navy", weight: 16 },
  { value: "Crimson Dip", weight: 12 },
  { value: "Royal Purple", weight: 9 },
  { value: "Arctic White", weight: 6.5 },
  { value: "24K Gold", weight: 4 },
  { value: "Holographic", weight: 2.5 },
];

export const EYES: WeightedTrait[] = [
  { value: "Green Glow", weight: 30 },
  { value: "Steady Gaze", weight: 24 },
  { value: "Bull Eyes", weight: 16 },
  { value: "Diamond", weight: 11 },
  { value: "Laser", weight: 8 },
  { value: "Ticker Tape", weight: 6 },
  { value: "Golden Stare", weight: 3.5 },
  { value: "Singularity", weight: 1.5 },
];

export const ACCESSORIES: WeightedTrait[] = [
  { value: "None", weight: 32 },
  { value: "Feather", weight: 20 },
  { value: "Gold Chain", weight: 14 },
  { value: "Diamond Hands", weight: 11 },
  { value: "Bull Horns", weight: 9 },
  { value: "Crown", weight: 7 },
  { value: "Halo", weight: 4.5 },
  { value: "Infinite Money Glitch", weight: 2.5 },
];

export const AURAS: WeightedTrait[] = [
  { value: "None", weight: 42 },
  { value: "Green Candle", weight: 22 },
  { value: "Uptrend", weight: 15 },
  { value: "Moonlight", weight: 10 },
  { value: "Solar Flare", weight: 6.5 },
  { value: "Diamond Dust", weight: 3 },
  { value: "God Candle", weight: 1.5 },
];

const TRAIT_TABLES = {
  background: BACKGROUNDS,
  hood: HOODS,
  eyes: EYES,
  accessory: ACCESSORIES,
  aura: AURAS,
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
    name: `HOOD #${String(id).padStart(4, "0")}`,
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
