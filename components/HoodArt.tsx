import { HoodNft } from "@/lib/nfts";

// Pure-SVG renderer for a HOOD NFT. Everything is derived from traits so
// artwork is deterministic and needs no image assets.

const BG_STYLES: Record<string, { from: string; to: string }> = {
  Midnight: { from: "#0b0f14", to: "#131a22" },
  Forest: { from: "#07130a", to: "#0e2415" },
  "Bull Run": { from: "#04210c", to: "#0a3d18" },
  "After Hours": { from: "#0e0a1a", to: "#1c1433" },
  Candlesticks: { from: "#0a0d12", to: "#10161e" },
  "Money Printer": { from: "#101408", to: "#1e2a0c" },
  "Golden Hour": { from: "#1a1206", to: "#33240a" },
  Matrix: { from: "#010a04", to: "#03170a" },
};

const HOOD_STYLES: Record<string, { base: string; shade: string; trim: string }> = {
  "Classic Green": { base: "#00c805", shade: "#00930a", trim: "#0aff5e" },
  "Stealth Black": { base: "#1c2026", shade: "#101317", trim: "#3a414b" },
  "Banker Navy": { base: "#16305e", shade: "#0d1e3d", trim: "#2f5db3" },
  "Crimson Dip": { base: "#c0233a", shade: "#821526", trim: "#ff5c72" },
  "Royal Purple": { base: "#6b2fd6", shade: "#471e93", trim: "#a875ff" },
  "Arctic White": { base: "#e8edf2", shade: "#b9c3cd", trim: "#ffffff" },
  "24K Gold": { base: "#d9a514", shade: "#9e770a", trim: "#ffe27a" },
  Holographic: { base: "url(#holo)", shade: "#3b7bd4", trim: "#c1f0ff" },
};

const EYE_STYLES: Record<string, { color: string; glow: string }> = {
  "Green Glow": { color: "#00ff41", glow: "#00c805" },
  "Steady Gaze": { color: "#dfe6ee", glow: "#8c9196" },
  "Bull Eyes": { color: "#ff3b30", glow: "#c0233a" },
  Diamond: { color: "#9be8ff", glow: "#00b8d9" },
  Laser: { color: "#ff1744", glow: "#ff1744" },
  "Ticker Tape": { color: "#00ff41", glow: "#00c805" },
  "Golden Stare": { color: "#ffd54a", glow: "#f5b400" },
  Singularity: { color: "#ffffff", glow: "#a259ff" },
};

function seeded(id: number, salt: number) {
  const x = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function BackgroundDetail({ bg, id }: { bg: string; id: number }) {
  if (bg === "Candlesticks") {
    const candles = Array.from({ length: 8 }, (_, i) => {
      const x = 20 + i * 48;
      const h = 30 + seeded(id, i) * 90;
      const y = 300 - h - seeded(id, i + 20) * 120;
      const up = seeded(id, i + 40) > 0.4;
      return (
        <g key={i} opacity={0.35}>
          <line x1={x + 8} y1={y - 18} x2={x + 8} y2={y + h + 18} stroke={up ? "#00c805" : "#c0233a"} strokeWidth={2} />
          <rect x={x} y={y} width={16} height={h} rx={2} fill={up ? "#00c805" : "#c0233a"} />
        </g>
      );
    });
    return <g>{candles}</g>;
  }
  if (bg === "Matrix") {
    const cols = Array.from({ length: 12 }, (_, i) => (
      <text key={i} x={12 + i * 33} y={40 + seeded(id, i) * 340} fill="#00ff41" opacity={0.28} fontSize={16} fontFamily="monospace">
        {Math.round(seeded(id, i + 7) * 9)}
        {Math.round(seeded(id, i + 13) * 9)}
        {Math.round(seeded(id, i + 17) * 9)}
      </text>
    ));
    return <g>{cols}</g>;
  }
  if (bg === "Bull Run" || bg === "Money Printer") {
    const pts = Array.from({ length: 9 }, (_, i) => `${i * 50},${330 - i * 22 - seeded(id, i) * 40}`).join(" ");
    return <polyline points={pts} fill="none" stroke="#00c805" strokeWidth={3} opacity={0.35} />;
  }
  if (bg === "Golden Hour") {
    return <circle cx={200} cy={120} r={130} fill="#f5b400" opacity={0.14} />;
  }
  if (bg === "After Hours") {
    const stars = Array.from({ length: 18 }, (_, i) => (
      <circle key={i} cx={seeded(id, i) * 400} cy={seeded(id, i + 50) * 220} r={1.4} fill="#cbd5ff" opacity={0.6} />
    ));
    return <g>{stars}</g>;
  }
  return null;
}

function Aura({ aura }: { aura: string }) {
  switch (aura) {
    case "Green Candle":
      return <rect x={150} y={40} width={100} height={330} rx={12} fill="#00c805" opacity={0.12} />;
    case "Uptrend":
      return <polyline points="30,340 120,290 180,310 260,220 370,120" fill="none" stroke="#00c805" strokeWidth={6} opacity={0.3} strokeLinecap="round" />;
    case "Moonlight":
      return <circle cx={200} cy={190} r={150} fill="#9db8ff" opacity={0.12} />;
    case "Solar Flare":
      return <circle cx={200} cy={190} r={150} fill="#ff7a00" opacity={0.16} />;
    case "Diamond Dust":
      return (
        <g opacity={0.5}>
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M ${30 + i * 27} ${60 + (i % 5) * 60} l 4 6 l -4 6 l -4 -6 Z`} fill="#9be8ff" />
          ))}
        </g>
      );
    case "God Candle":
      return (
        <g>
          <rect x={170} y={0} width={60} height={400} fill="#00ff41" opacity={0.18} />
          <rect x={188} y={0} width={24} height={400} fill="#eaffea" opacity={0.25} />
        </g>
      );
    default:
      return null;
  }
}

function Accessory({ accessory, trim }: { accessory: string; trim: string }) {
  switch (accessory) {
    case "Feather":
      return (
        <g transform="rotate(-24 258 118)">
          <ellipse cx={258} cy={118} rx={10} ry={34} fill="#ff5000" />
          <line x1={258} y1={88} x2={258} y2={152} stroke="#a33200" strokeWidth={2.5} />
        </g>
      );
    case "Gold Chain":
      return (
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={155 + i * 15} cy={300 + Math.abs(i - 3) * -6 + 18} r={6} fill="none" stroke="#f5b400" strokeWidth={4} />
          ))}
          <circle cx={200} cy={330} r={11} fill="#f5b400" />
          <text x={200} y={335} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0b0f14" fontFamily="Arial">H</text>
        </g>
      );
    case "Diamond Hands":
      return (
        <g>
          <path d="M 128 356 l 14 -18 h 24 l 14 18 l -26 26 Z" fill="#9be8ff" stroke="#00b8d9" strokeWidth={2} />
          <path d="M 220 356 l 14 -18 h 24 l 14 18 l -26 26 Z" fill="#9be8ff" stroke="#00b8d9" strokeWidth={2} />
        </g>
      );
    case "Bull Horns":
      return (
        <g>
          <path d="M 120 120 C 95 95 92 65 110 45 C 106 80 118 96 138 106 Z" fill="#e8edf2" />
          <path d="M 280 120 C 305 95 308 65 290 45 C 294 80 282 96 262 106 Z" fill="#e8edf2" />
        </g>
      );
    case "Crown":
      return (
        <g>
          <path d="M 152 84 L 160 52 L 182 74 L 200 42 L 218 74 L 240 52 L 248 84 Z" fill="#f5b400" stroke="#9e770a" strokeWidth={3} />
          <circle cx={160} cy={50} r={5} fill="#ff3b30" />
          <circle cx={200} cy={40} r={5} fill="#00b8d9" />
          <circle cx={240} cy={50} r={5} fill="#00c805" />
        </g>
      );
    case "Halo":
      return <ellipse cx={200} cy={52} rx={52} ry={12} fill="none" stroke="#ffe27a" strokeWidth={6} opacity={0.9} />;
    case "Infinite Money Glitch":
      return (
        <g>
          <text x={122} y={70} fontSize={30} fill="#00ff41" fontFamily="monospace" opacity={0.9}>$</text>
          <text x={262} y={96} fontSize={22} fill="#00ff41" fontFamily="monospace" opacity={0.7}>$</text>
          <text x={96} y={160} fontSize={20} fill="#00ff41" fontFamily="monospace" opacity={0.6}>$</text>
          <text x={292} y={190} fontSize={26} fill="#00ff41" fontFamily="monospace" opacity={0.8}>$</text>
          <ellipse cx={200} cy={52} rx={40} ry={11} fill="none" stroke={trim} strokeWidth={4} strokeDasharray="10 6" />
        </g>
      );
    default:
      return null;
  }
}

export default function HoodArt({ nft, className }: { nft: HoodNft; className?: string }) {
  const bg = BG_STYLES[nft.traits.background] ?? BG_STYLES.Midnight;
  const hood = HOOD_STYLES[nft.traits.hood] ?? HOOD_STYLES["Classic Green"];
  const eyes = EYE_STYLES[nft.traits.eyes] ?? EYE_STYLES["Green Glow"];
  const uid = `n${nft.id}`;

  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label={nft.name}>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
        <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7ff" />
          <stop offset="35%" stopColor="#a78bfa" />
          <stop offset="70%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
        <radialGradient id={`face-${uid}`} cx="0.5" cy="0.42" r="0.65">
          <stop offset="0%" stopColor="#11151b" />
          <stop offset="100%" stopColor="#04060a" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={400} height={400} fill={`url(#bg-${uid})`} />
      <BackgroundDetail bg={nft.traits.background} id={nft.id} />
      <Aura aura={nft.traits.aura} />

      {/* cloak body */}
      <path
        d="M 200 78 C 148 78 120 128 114 178 C 108 232 92 300 84 372 L 316 372 C 308 300 292 232 286 178 C 280 128 252 78 200 78 Z"
        fill={hood.base}
      />
      {/* cloak shading */}
      <path
        d="M 200 78 C 168 84 142 130 136 182 C 130 240 112 306 104 372 L 84 372 C 92 300 108 232 114 178 C 120 128 148 78 200 78 Z"
        fill={hood.shade}
        opacity={0.8}
      />
      {/* hood peak */}
      <path d="M 200 46 C 168 52 146 78 140 108 L 200 92 L 260 108 C 254 78 232 52 200 46 Z" fill={hood.base} />
      <path d="M 200 46 C 168 52 146 78 140 108 L 200 92 Z" fill={hood.shade} opacity={0.6} />

      {/* face opening */}
      <ellipse cx={200} cy={168} rx={58} ry={70} fill={`url(#face-${uid})`} />
      {/* hood rim */}
      <ellipse cx={200} cy={168} rx={58} ry={70} fill="none" stroke={hood.trim} strokeWidth={5} opacity={0.9} />

      {/* eyes */}
      {nft.traits.eyes === "Laser" ? (
        <g filter={`url(#glow-${uid})`}>
          <rect x={158} y={162} width={30} height={7} rx={3} fill={eyes.color} />
          <rect x={212} y={162} width={30} height={7} rx={3} fill={eyes.color} />
          <rect x={186} y={163} width={140} height={4} fill={eyes.color} opacity={0.5} transform="rotate(8 186 163)" />
        </g>
      ) : nft.traits.eyes === "Diamond" ? (
        <g filter={`url(#glow-${uid})`}>
          <path d="M 172 158 l 8 8 l -8 8 l -8 -8 Z" fill={eyes.color} />
          <path d="M 228 158 l 8 8 l -8 8 l -8 -8 Z" fill={eyes.color} />
        </g>
      ) : nft.traits.eyes === "Ticker Tape" ? (
        <g filter={`url(#glow-${uid})`} fontFamily="monospace" fontSize={15} fontWeight={700}>
          <text x={162} y={172} fill={eyes.color}>▲</text>
          <text x={222} y={172} fill={eyes.color}>▲</text>
        </g>
      ) : (
        <g filter={`url(#glow-${uid})`}>
          <ellipse cx={174} cy={166} rx={9} ry={nft.traits.eyes === "Steady Gaze" ? 4 : 9} fill={eyes.color} />
          <ellipse cx={226} cy={166} rx={9} ry={nft.traits.eyes === "Steady Gaze" ? 4 : 9} fill={eyes.color} />
        </g>
      )}

      {/* drawstrings */}
      <line x1={186} y1={232} x2={182} y2={268} stroke={hood.trim} strokeWidth={4} strokeLinecap="round" />
      <line x1={214} y1={232} x2={218} y2={268} stroke={hood.trim} strokeWidth={4} strokeLinecap="round" />

      <Accessory accessory={nft.traits.accessory} trim={hood.trim} />
    </svg>
  );
}
