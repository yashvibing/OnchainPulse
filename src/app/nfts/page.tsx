import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { NftCollections } from "@/components/NftCollections";

export const metadata: Metadata = {
  title: "NFT Markets - Onchain Pulse",
  description:
    "Track Monad NFT collections by floor price, volume, sales, owners, supply, and marketplace activity.",
};

export default function NftsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-6">
        <section className="mb-8 border-b border-[var(--color-border)] pb-8 pt-2">
          <div className="label-caps text-[var(--color-accent-primary)]">
            NFT terminal
          </div>
          <h1 className="mt-3 text-[40px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            NFT Markets
          </h1>
          <p className="mt-3 max-w-[820px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Compare Monad NFT collections by floor, offers, trading activity, supply, and holder distribution.
          </p>
        </section>

        <NftCollections />
      </main>
    </div>
  );
}
