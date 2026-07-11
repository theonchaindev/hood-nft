"use client";

import Link from "next/link";
import { MAGIC_EDEN_URL } from "@/lib/site";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-8 w-8">
            <path
              d="M16 3 C10 4.5 6.5 9 5.5 14 C4.5 20 3.5 25 3 29 L 29 29 C 28.5 25 27.5 20 26.5 14 C 25.5 9 22 4.5 16 3 Z"
              fill="#00c805"
            />
            <ellipse cx="16" cy="14.5" rx="6" ry="7" fill="#060907" />
            <circle cx="13.4" cy="14" r="1.4" fill="#0aff5e" />
            <circle cx="18.6" cy="14" r="1.4" fill="#0aff5e" />
          </svg>
          <span className="text-lg font-extrabold tracking-tight">HOODZ</span>
        </Link>

        <div className="hidden items-center gap-5 text-sm font-medium text-mute sm:flex">
          <a href="#chosen" className="hover:text-white">The Chosen</a>
          <a href="#legends" className="hover:text-white">Legends</a>
          <a href="#about" className="hover:text-white">About</a>
        </div>

        <a
          href={MAGIC_EDEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-hood px-5 py-2 text-sm font-bold text-ink transition-transform hover:scale-105"
        >
          Mint on Magic Eden
        </a>
      </div>
    </nav>
  );
}
