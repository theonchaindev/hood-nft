"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getAllNfts, getNft, HoodNft, RARITY_COLORS, TOTAL_SUPPLY } from "@/lib/nfts";
import { useHood } from "@/context/HoodContext";
import HoodArt from "@/components/HoodArt";
import NftCard from "@/components/NftCard";
import MintModal from "@/components/MintModal";
import Ticker from "@/components/Ticker";

const FEATURED_IDS = [773, 292, 758, 77, 214, 842, 128, 610];
const HERO_ID = 666;

export default function Home() {
  const { minted, wallet } = useHood();
  const [selected, setSelected] = useState<HoodNft | null>(null);

  const featured = FEATURED_IDS.map((id) => getNft(id));
  const hero = getNft(HERO_ID);

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of getAllNfts()) counts[n.rarity] = (counts[n.rarity] ?? 0) + 1;
    return counts;
  }, []);

  const mintedCount = Object.keys(minted).length;

  return (
    <main>
      {/* hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:pt-20">
        <div>
          <p className="mb-4 inline-block rounded-full border border-hood/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-widest text-hood-bright">
            MINT IS LIVE · SOLANA
          </p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Investing was for them.
            <br />
            <span className="text-hood">The HOOD</span> is for you.
          </h1>
          <p className="mt-5 max-w-md text-lg text-mute">
            1,000 hooded operators trading from the shadows. Zero commission,
            zero suits, 100% on-chain conviction. Pick your operator and mint
            the movement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/mint"
              className="animate-pulse-glow rounded-full bg-hood px-8 py-3.5 font-bold text-ink transition-transform hover:scale-105"
            >
              Start Minting
            </Link>
            <a
              href="#rarity"
              className="rounded-full border border-line bg-panel px-8 py-3.5 font-bold text-white transition-colors hover:border-hood/50"
            >
              Rarity Tiers
            </a>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              { label: "Supply", value: TOTAL_SUPPLY.toLocaleString() },
              { label: "Minted", value: mintedCount.toLocaleString() },
              { label: "Floor", value: "0.25 SOL" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-panel px-4 py-3">
                <p className="font-mono text-xl font-bold text-hood-bright">{s.value}</p>
                <p className="text-xs text-mute">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-8 rounded-full bg-hood/10 blur-3xl" />
          <button
            onClick={() => setSelected(hero)}
            className="animate-float relative block w-full overflow-hidden rounded-3xl border border-hood/30 shadow-[0_20px_80px_rgba(0,200,5,0.25)]"
          >
            <HoodArt nft={hero} className="block w-full" />
          </button>
          <p className="mt-3 text-center text-sm text-mute">
            {hero.name} · <span style={{ color: RARITY_COLORS[hero.rarity] }}>{hero.rarity}</span>
          </p>
        </div>
      </section>

      <Ticker />

      {/* featured */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Trending Operators</h2>
            <p className="mt-1 text-mute">Most-watched HOODs this hour.</p>
          </div>
          <Link href="/mint" className="text-sm font-bold text-hood-bright hover:underline">
            View all 1,000 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((n) => (
            <NftCard
              key={n.id}
              nft={n}
              owned={minted[n.id] === wallet && !!wallet}
              mintedByOther={!!minted[n.id] && minted[n.id] !== wallet}
              onClick={() => setSelected(n)}
            />
          ))}
        </div>
      </section>

      {/* rarity tiers */}
      <section id="rarity" className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="text-3xl font-extrabold">Rarity Tiers</h2>
        <p className="mt-1 text-mute">
          Every HOOD is generated from weighted traits — backgrounds, hoods,
          eyes, accessories and auras. Rarer combos, higher tier.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {(["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const).map((r) => (
            <div
              key={r}
              className="rounded-2xl border border-line bg-panel p-4 text-center transition-colors hover:border-hood/40"
              style={{ borderTopColor: RARITY_COLORS[r], borderTopWidth: 3 }}
            >
              <p className="font-bold" style={{ color: RARITY_COLORS[r] }}>{r}</p>
              <p className="mt-1 font-mono text-2xl font-bold">{rarityCounts[r] ?? 0}</p>
              <p className="text-xs text-mute">of {TOTAL_SUPPLY}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="text-3xl font-extrabold">Zero-commission minting</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Connect",
              body: "Link your Phantom wallet in one click. No account, no KYC, no waiting for market open.",
            },
            {
              step: "02",
              title: "Pick your operator",
              body: "Browse all 1,000 HOODs with live trait and rarity data. Filter by tier, hunt the Legendaries.",
            },
            {
              step: "03",
              title: "Mint & hold",
              body: "Confirm the order and your HOOD lands in your portfolio. Diamond hands optional but encouraged.",
            },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-line bg-panel p-6">
              <p className="font-mono text-sm font-bold text-hood">{s.step}</p>
              <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="relative overflow-hidden rounded-3xl border border-hood/30 bg-panel p-10 text-center md:p-16">
          <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-hood/15 blur-3xl" />
          <h2 className="relative text-4xl font-black">The market never sleeps. Neither does the HOOD.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-mute">
            {TOTAL_SUPPLY - mintedCount} operators still unminted. When they&apos;re gone, they&apos;re gone.
          </p>
          <Link
            href="/mint"
            className="relative mt-8 inline-block rounded-full bg-hood px-10 py-4 text-lg font-bold text-ink transition-transform hover:scale-105"
          >
            Mint Yours
          </Link>
        </div>
      </section>

      {selected && <MintModal nft={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
