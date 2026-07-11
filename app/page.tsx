"use client";

import { useMemo, useState } from "react";
import { getNft, HoodNft } from "@/lib/nfts";
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

  const curated = useMemo(() => CURATED.map((id) => getNft(id)), []);

  const bands = useMemo(() => {
    const s = shuffle(curated, 7);
    const third = Math.ceil(s.length / 3);
    return [s.slice(0, third), s.slice(third, third * 2), s.slice(third * 2)];
  }, [curated]);


  return (
    <main>
      {/* hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 md:grid-cols-2 md:pt-24">
        <div>
          <p className="mb-4 inline-block rounded-full border border-hood/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-widest text-hood-bright">
            200 HOODS ON CHAIN · SOLANA
          </p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
            THE HOOD
            <br />
            <span className="text-hood">STAYS ON.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-mute">
            HOODZ is a collection of 200 hand-built characters with painted
            hats, faces, chains and materials. Minting exclusively on Magic
            Eden.
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
              href="#about"
              className="rounded-full border border-line bg-panel px-8 py-3.5 font-bold text-white transition-colors hover:border-hood/50"
            >
              About the Collection
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
                className="animate-float relative -mx-8 block w-2/5 overflow-hidden rounded-2xl border border-hood/40 shadow-[0_20px_60px_rgba(0,200,5,0.3)] transition-transform hover:z-10 hover:scale-110"
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

      {/* about */}
      <section id="about" className="mx-auto max-w-6xl px-4 pt-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Painted, not pasted",
              body: "Every hat, face and chain is painted onto the character with proper perspective and shadows — then composed into 200 unique HOODZ.",
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
          <h2 className="relative text-4xl font-black">Pick your HOODZ.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-mute">
            200 HOODZ. Zero faces.
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
