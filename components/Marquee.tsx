"use client";

import { HoodNft } from "@/lib/nfts";
import NftImage from "./NftImage";

// Infinite horizontal band of artwork. Content is duplicated once so the
// -50% translate loops seamlessly. Hovering the band pauses it.
export default function Marquee({
  nfts,
  reverse,
  speed = 65,
  size = 200,
  onSelect,
}: {
  nfts: HoodNft[];
  reverse?: boolean;
  speed?: number;
  size?: number;
  onSelect: (nft: HoodNft) => void;
}) {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 gap-4 pr-4">
      {nfts.map((n) => (
        <button
          key={`${key}-${n.id}`}
          onClick={() => onSelect(n)}
          className="group relative shrink-0 overflow-hidden rounded-2xl border border-line transition-transform hover:scale-[1.04] hover:border-hood/70"
          style={{ width: size, height: size }}
          aria-label={n.name}
        >
          <NftImage nft={n} className="block h-full w-full object-cover" />
          <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/90 to-transparent px-3 pb-2 pt-6 text-left text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
            {n.name}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="marquee-paused overflow-hidden">
      <div
        className={`flex w-max ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}
      >
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
