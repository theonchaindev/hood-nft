"use client";

import { useEffect } from "react";
import { HoodNft, RARITY_COLORS } from "@/lib/nfts";
import NftImage from "./NftImage";

export default function Lightbox({
  nft,
  onClose,
}: {
  nft: HoodNft;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <NftImage nft={nft} className="block h-full w-full object-cover" />
          <div className="flex flex-col p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-extrabold">{nft.name}</h2>
                <p className="mt-1 text-sm font-bold" style={{ color: RARITY_COLORS[nft.rarity] }}>
                  {nft.rarity}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full px-2 text-2xl leading-none text-mute hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {Object.entries(nft.traits).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-xl bg-panel-2 px-4 py-2.5 text-sm"
                >
                  <span className="capitalize text-mute">{k}</span>
                  <span className="font-semibold text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
