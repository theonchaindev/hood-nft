"use client";

import { getNft, RARITY_COLORS } from "@/lib/nfts";

// Fake "recent mints" tape — deterministic ids so SSR and client agree.
const TAPE_IDS = [842, 17, 356, 921, 64, 505, 733, 128, 610, 288, 951, 402, 77, 869, 214, 590];

export default function Ticker() {
  const items = TAPE_IDS.map((id) => getNft(id));
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((n) => (
        <span key={`${key}-${n.id}`} className="flex items-center gap-2 text-sm whitespace-nowrap">
          <span className="font-semibold">{n.name}</span>
          <span style={{ color: RARITY_COLORS[n.rarity] }}>{n.rarity}</span>
          <span className="text-hood-bright font-mono">▲ {n.price} SOL</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-line bg-panel py-2.5">
      <div className="flex w-max animate-marquee">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
