"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Phantom's injected provider (subset we use)
interface PhantomProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString(): string };
  }>;
  disconnect: () => Promise<void>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

interface HoodState {
  wallet: string | null;
  hasPhantom: boolean;
  connecting: boolean;
  minted: Record<number, string>; // nft id -> owner wallet
  connect: () => Promise<void>;
  disconnect: () => void;
  mint: (id: number) => void;
}

const HoodContext = createContext<HoodState | null>(null);

const MINT_KEY = "hood-minted";
const WALLET_KEY = "hood-wallet";

export function HoodProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [hasPhantom, setHasPhantom] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [minted, setMinted] = useState<Record<number, string>>({});

  useEffect(() => {
    setHasPhantom(!!window.solana?.isPhantom);
    try {
      const stored = localStorage.getItem(MINT_KEY);
      if (stored) setMinted(JSON.parse(stored));
      const w = localStorage.getItem(WALLET_KEY);
      if (w) setWallet(w);
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      if (window.solana?.isPhantom) {
        const res = await window.solana.connect();
        const key = res.publicKey.toString();
        setWallet(key);
        localStorage.setItem(WALLET_KEY, key);
      } else {
        // no wallet extension — demo wallet so the mint flow is still usable
        const demo =
          "DEMO" +
          Array.from({ length: 28 }, () =>
            "ABCDEFGHJKLMNPQRSTUVWXYZ123456789".charAt(
              Math.floor(Math.random() * 33)
            )
          ).join("");
        setWallet(demo);
        localStorage.setItem(WALLET_KEY, demo);
      }
    } catch {
      // user rejected
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    window.solana?.disconnect().catch(() => {});
    setWallet(null);
    localStorage.removeItem(WALLET_KEY);
  }, []);

  const mint = useCallback(
    (id: number) => {
      if (!wallet) return;
      setMinted((prev) => {
        const next = { ...prev, [id]: wallet };
        localStorage.setItem(MINT_KEY, JSON.stringify(next));
        return next;
      });
    },
    [wallet]
  );

  return (
    <HoodContext.Provider
      value={{ wallet, hasPhantom, connecting, minted, connect, disconnect, mint }}
    >
      {children}
    </HoodContext.Provider>
  );
}

export function useHood() {
  const ctx = useContext(HoodContext);
  if (!ctx) throw new Error("useHood must be used within HoodProvider");
  return ctx;
}
