import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HOODZ — The Hood Stays On",
  description:
    "HOODZ — 200 hoods on chain. Minting exclusively on Magic Eden.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line mt-24 py-10 text-center text-sm text-mute">
          <p>HOODZ — 200 hoods on chain. Minting exclusively on Magic Eden.</p>
        </footer>
      </body>
    </html>
  );
}
