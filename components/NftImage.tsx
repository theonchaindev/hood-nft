/* eslint-disable @next/next/no-img-element */
import { HoodNft } from "@/lib/nfts";

// Serves the rendered collection image for an NFT.
export default function NftImage({ nft, className }: { nft: HoodNft; className?: string }) {
  return (
    <img
      src={`/hoodz/${nft.id}.webp`}
      alt={nft.name}
      loading="lazy"
      className={className}
      draggable={false}
    />
  );
}
