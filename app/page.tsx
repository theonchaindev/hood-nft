"use client";

import { useMemo, useState } from "react";
import { getAllNfts, getNft, HoodNft } from "@/lib/nfts";
import { CURATED } from "@/lib/curated";
import { MAGIC_EDEN_URL } from "@/lib/site";
import NftImage from "@/components/NftImage";
import Marquee from "@/components/Marquee";
import Lightbox from "@/components/Lightbox";

const HERO_TRIO = [500, 773, 758]; // legendaries fanned in the hero

// deterministic shuffle so server and client render identically
function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function Home() {
  const [selected, setSelected] = useState<HoodNft | null>(null);
  const [chosenPage, setChosenPage] = useState(0);

  const curated = useMemo(() => CURATED.map((id) => getNft(id)), []);
  const legends = useMemo(() => getAllNfts().filter((n) => n.rarity === "Legendary"), []);

  const bands = useMemo(() => {
    const s = shuffle(curated, 7);
    const third = Math.ceil(s.length / 3);
    return [s.slice(0, third), s.slice(third, third * 2), s.slice(third * 2)];
  }, [curated]);

  const PER_PAGE = 12;
  const chosenPages = Math.ceil(curated.length / PER_PAGE);
  const chosen = curated.slice(chosenPage * PER_PAGE, chosenPage * PER_PAGE + PER_PAGE);

  return (
    <main>
      {/* hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 md:grid-cols-2 md:pt-24">
        <div>
          <p className="mb-4 inline-block rounded-full border border-hood/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-widest text-hood-bright">
            1,000 OPERATORS · SOLANA
          </p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Faces hidden.
            <br />
            <span className="text-hood">Vibes immaculate.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-mute">
            HOODZ is a collection of 1,000 hooded operators — hand-built
            characters with painted hats, faces, chains and materials.
            Minting exclusively on Magic Eden.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={MAGIC_EDEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="animate-pulse-glow rounded-full bg-hood px-8 py-3.5 font-bold text-ink transition-transform hover:scale-105"
            >
              Mint on Magic Eden
            </a>
            <a
              href="#chosen"
              className="rounded-full border border-line bg-panel px-8 py-3.5 font-bold text-white transition-colors hover:border-hood/50"
            >
              Browse the Chosen
            </a>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-md items-center justify-center py-6">
          <div className="absolute -inset-10 rounded-full bg-hood/10 blur-3xl" />
          {HERO_TRIO.map((id, i) => {
            const n = getNft(id);
            return (
              <button
                key={id}
                onClick={() => setSelected(n)}
                className="animate-float relative -mx-8 block w-2/5 overflow-hidden rounded-2xl border border-hood/40 shadow-[0_20px_60px_rgba(162,89,255,0.3)] transition-transform hover:z-10 hover:scale-110"
                style={{
                  "--tilt": `${(i - 1) * 8}deg`,
                  zIndex: i === 1 ? 5 : 1,
                  animationDelay: `${i * 0.6}s`,
                  scale: i === 1 ? "1.25" : "1",
                } as React.CSSProperties}
              >
                <NftImage nft={n} className="block w-full" />
              </button>
            );
          })}
        </div>
      </section>

      {/* marquee bands */}
      <section className="space-y-4 border-y border-line bg-panel/40 py-6">
        <Marquee nfts={bands[0]} speed={80} onSelect={setSelected} />
        <Marquee nfts={bands[1]} speed={95} reverse onSelect={setSelected} />
        <Marquee nfts={bands[2]} speed={70} onSelect={setSelected} />
      </section>

      {/* the chosen */}
      <section id="chosen" className="mx-auto max-w-6xl px-4 pt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold">The Chosen 200</h2>
            <p className="mt-1 text-mute">Hand-picked favourites from the vault.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChosenPage((p) => (p - 1 + chosenPages) % chosenPages)}
              className="rounded-full border border-line bg-panel px-4 py-2 font-bold text-mute transition-colors hover:border-hood/50 hover:text-white"
              aria-label="Previous"
            >
              ←
            </button>
            <span className="text-sm text-mute tabular-nums">
              {chosenPage + 1} / {chosenPages}
            </span>
            <button
              onClick={() => setChosenPage((p) => (p + 1) % chosenPages)}
              className="rounded-full border border-line bg-panel px-4 py-2 font-bold text-mute transition-colors hover:border-hood/50 hover:text-white"
              aria-label="Next"
            >
              →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {chosen.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n)}
              className="group overflow-hidden rounded-xl border border-line transition-all hover:-translate-y-1 hover:border-hood/60"
            >
              <NftImage nft={n} className="block w-full" />
            </button>
          ))}
        </div>
      </section>

      {/* legends */}
      <section id="legends" className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="text-3xl font-extrabold">
          The <span className="text-gold">Legendary</span> Ten
        </h2>
        <p className="mt-1 text-mute">Rarest trait combos in the collection. Only one of each will ever exist.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {legends.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n)}
              className="group overflow-hidden rounded-2xl border border-gold/30 bg-panel text-left transition-all hover:-translate-y-1 hover:border-gold/70 hover:shadow-[0_8px_40px_rgba(245,180,0,0.2)]"
            >
              <NftImage nft={n} className="block w-full" />
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-bold">{n.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold">Legendary</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* about */}
      <section id="about" className="mx-auto max-w-6xl px-4 pt-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Painted, not pasted",
              body: "Every hat, face and chain is painted onto the character with proper perspective and shadows — then composed into 1,000 unique operators.",
            },
            {
              title: "30 materials, 45 worlds",
              body: "Hoods in camo, denim, galaxy, lava, gold and designer fabrics. Backdrops from lightning storms to synthwave suns and diamond caves.",
            },
            {
              title: "Minting on Magic Eden",
              body: "No mint site, no gas wars here — this is the gallery. The collection drops exclusively on Magic Eden.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-panel p-6">
              <h3 className="text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="relative overflow-hidden rounded-3xl border border-hood/30 bg-panel p-10 text-center md:p-16">
          <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-hood/15 blur-3xl" />
          <h2 className="relative text-4xl font-black">Pick your operator.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-mute">
            1,000 HOODZ. 10 Legendaries. Zero faces.
          </p>
          <a
            href={MAGIC_EDEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-8 inline-block rounded-full bg-hood px-10 py-4 text-lg font-bold text-ink transition-transform hover:scale-105"
          >
            Mint on Magic Eden
          </a>
        </div>
      </section>

      {selected && <Lightbox nft={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
