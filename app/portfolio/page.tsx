"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getNft, HoodNft } from "@/lib/nfts";
import { useHood } from "@/context/HoodContext";
import NftCard from "@/components/NftCard";
import MintModal from "@/components/MintModal";

export default function PortfolioPage() {
  const { minted, wallet, connect } = useHood();
  const [selected, setSelected] = useState<HoodNft | null>(null);

  const owned = useMemo(() => {
    if (!wallet) return [];
    return Object.entries(minted)
      .filter(([, owner]) => owner === wallet)
      .map(([id]) => getNft(Number(id)));
  }, [minted, wallet]);

  const totalValue = owned.reduce((s, n) => s + n.price, 0);

  if (!wallet) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-32 text-center">
        <h1 className="text-4xl font-black">Your Portfolio</h1>
        <p className="mt-3 max-w-sm text-mute">
          Connect your wallet to see the operators you&apos;ve minted.
        </p>
        <button
          onClick={connect}
          className="mt-8 rounded-full bg-hood px-8 py-3.5 font-bold text-ink transition-transform hover:scale-105"
        >
          Connect Wallet
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="text-4xl font-black">Your Portfolio</h1>

      <div className="mt-6 grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-panel px-5 py-4">
          <p className="font-mono text-2xl font-bold text-hood-bright">{owned.length}</p>
          <p className="text-xs text-mute">HOODs held</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel px-5 py-4">
          <p className="font-mono text-2xl font-bold text-hood-bright">
            {totalValue.toFixed(2)} <span className="text-sm text-mute">SOL</span>
          </p>
          <p className="text-xs text-mute">Mint value</p>
        </div>
      </div>

      {owned.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-lg text-mute">No operators yet. The shadows await.</p>
          <Link
            href="/mint"
            className="mt-6 inline-block rounded-full bg-hood px-8 py-3 font-bold text-ink transition-transform hover:scale-105"
          >
            Mint your first HOOD
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {owned.map((n) => (
            <NftCard key={n.id} nft={n} owned onClick={() => setSelected(n)} />
          ))}
        </div>
      )}

      {selected && <MintModal nft={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
