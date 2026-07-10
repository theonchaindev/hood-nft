"use client";

import { useEffect, useState } from "react";
import { HoodNft, RARITY_COLORS } from "@/lib/nfts";
import { useHood } from "@/context/HoodContext";
import NftImage from "./NftImage";

type Stage = "review" | "processing" | "filled";

export default function MintModal({
  nft,
  onClose,
}: {
  nft: HoodNft;
  onClose: () => void;
}) {
  const { wallet, minted, connect, mint } = useHood();
  const [stage, setStage] = useState<Stage>("review");

  const owner = minted[nft.id];
  const owned = owner && owner === wallet;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleMint = () => {
    setStage("processing");
    // fake network / block confirmation delay
    setTimeout(() => {
      mint(nft.id);
      setStage("filled");
    }, 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid sm:grid-cols-2">
          <div className="relative">
            <NftImage nft={nft} className="block h-full w-full object-cover" />
            {stage === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-line border-t-hood" />
              </div>
            )}
            {stage === "filled" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
                <div className="animate-pop flex h-16 w-16 items-center justify-center rounded-full bg-hood text-3xl font-black text-ink">
                  ✓
                </div>
                <p className="text-lg font-bold text-hood-bright">Order Filled</p>
              </div>
            )}
          </div>

          <div className="flex flex-col p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-extrabold">{nft.name}</h2>
                <p
                  className="mt-1 text-sm font-bold"
                  style={{ color: RARITY_COLORS[nft.rarity] }}
                >
                  {nft.rarity} · Rarity score {nft.score}
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
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-sm text-mute">Mint price</span>
                <span className="font-mono text-2xl font-bold text-hood-bright">
                  {nft.price} SOL
                </span>
              </div>

              {stage === "filled" || owned ? (
                <div className="rounded-full bg-panel-2 py-3 text-center font-bold text-hood-bright">
                  In your portfolio 🎉
                </div>
              ) : owner ? (
                <div className="rounded-full bg-panel-2 py-3 text-center font-bold text-mute">
                  Already minted
                </div>
              ) : !wallet ? (
                <button
                  onClick={connect}
                  className="w-full rounded-full bg-hood py-3 font-bold text-ink transition-transform hover:scale-[1.02]"
                >
                  Connect Wallet to Mint
                </button>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={stage === "processing"}
                  className="animate-pulse-glow w-full rounded-full bg-hood py-3 font-bold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {stage === "processing" ? "Confirming on-chain…" : "Mint Now"}
                </button>
              )}
              <p className="mt-3 text-center text-xs text-mute">
                $0 commission. Gas is between you and the validator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
