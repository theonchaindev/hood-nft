"use client";

import { HoodNft, RARITY_COLORS } from "@/lib/nfts";
import HoodArt from "./HoodArt";

export default function NftCard({
  nft,
  owned,
  mintedByOther,
  onClick,
}: {
  nft: HoodNft;
  owned?: boolean;
  mintedByOther?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-line bg-panel text-left transition-all hover:-translate-y-1 hover:border-hood/60 hover:shadow-[0_8px_40px_rgba(0,200,5,0.15)]"
    >
      <div className="relative">
        <HoodArt nft={nft} className="block w-full" />
        {(owned || mintedByOther) && (
          <div className="absolute inset-0 flex items-start justify-end bg-ink/30 p-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                owned ? "bg-hood text-ink" : "bg-panel-2 text-mute"
              }`}
            >
              {owned ? "OWNED" : "MINTED"}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div>
          <p className="text-sm font-bold">{nft.name}</p>
          <p className="text-xs font-semibold" style={{ color: RARITY_COLORS[nft.rarity] }}>
            {nft.rarity}
          </p>
        </div>
        <p className="font-mono text-sm font-semibold text-hood-bright">
          {nft.price} <span className="text-mute text-xs">SOL</span>
        </p>
      </div>
    </button>
  );
}
