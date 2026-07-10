"use client";

import { useMemo, useState } from "react";
import { getAllNfts, HoodNft, Rarity, RARITY_COLORS } from "@/lib/nfts";
import { useHood } from "@/context/HoodContext";
import NftCard from "@/components/NftCard";
import MintModal from "@/components/MintModal";

const PAGE_SIZE = 48;
const TIERS: ("All" | Rarity)[] = ["All", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

export default function MintPage() {
  const { minted, wallet } = useHood();
  const [tier, setTier] = useState<"All" | Rarity>("All");
  const [query, setQuery] = useState("");
  const [hideMinted, setHideMinted] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<HoodNft | null>(null);

  const all = useMemo(() => getAllNfts(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((n) => {
      if (tier !== "All" && n.rarity !== tier) return false;
      if (hideMinted && minted[n.id]) return false;
      if (q && !n.name.toLowerCase().includes(q) && !Object.values(n.traits).some((t) => t.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [all, tier, query, hideMinted, minted]);

  const shown = filtered.slice(0, visible);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="text-4xl font-black">The Collection</h1>
      <p className="mt-1 text-mute">
        {filtered.length.toLocaleString()} operators{tier !== "All" ? ` · ${tier}` : ""} — tap any HOODZ to review and mint.
      </p>

      {/* filters */}
      <div className="sticky top-[57px] z-30 -mx-4 mt-6 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTier(t);
                setVisible(PAGE_SIZE);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                tier === t
                  ? "border-hood bg-hood/15 text-hood-bright"
                  : "border-line bg-panel text-mute hover:text-white"
              }`}
              style={tier === t && t !== "All" ? { color: RARITY_COLORS[t as Rarity], borderColor: RARITY_COLORS[t as Rarity] } : undefined}
            >
              {t}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search #id or trait…"
            className="ml-auto w-48 rounded-full border border-line bg-panel px-4 py-1.5 text-sm outline-none placeholder:text-mute focus:border-hood/60"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mute">
            <input
              type="checkbox"
              checked={hideMinted}
              onChange={(e) => setHideMinted(e.target.checked)}
              className="accent-[#00c805]"
            />
            Hide minted
          </label>
        </div>
      </div>

      {/* grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((n) => (
          <NftCard
            key={n.id}
            nft={n}
            owned={!!wallet && minted[n.id] === wallet}
            mintedByOther={!!minted[n.id] && minted[n.id] !== wallet}
            onClick={() => setSelected(n)}
          />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-20 text-center text-mute">No operators match those filters.</p>
      )}

      {visible < filtered.length && (
        <div className="mt-10 text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-hood/50 bg-panel px-8 py-3 font-bold text-hood-bright transition-colors hover:bg-hood/10"
          >
            Load more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}

      {selected && <MintModal nft={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
