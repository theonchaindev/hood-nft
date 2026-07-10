import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { HoodProvider } from "@/context/HoodContext";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HOODZ — Mint the Movement",
  description:
    "HOODZ is a collection of 1,000 hooded operators on Solana. Commission-free minting for the people.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <HoodProvider>
          <Nav />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-line mt-24 py-10 text-center text-sm text-mute">
            <p>
              HOODZ is a parody art collection. Not affiliated with Robinhood
              Markets. Not financial advice — it&apos;s better.
            </p>
          </footer>
        </HoodProvider>
      </body>
    </html>
  );
}
