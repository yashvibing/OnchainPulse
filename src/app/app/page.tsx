import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

interface PageProps {
  searchParams: Promise<{ address?: string; d?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const address = params.address;
  const d = params.d;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      title: "Onchain Pulse App - Portfolio & DeFi Rates",
      openGraph: {
        images: [{ url: "/api/og", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        images: ["/api/og"],
      },
    };
  }

  const ogUrl = d ? `/api/og?d=${encodeURIComponent(d)}` : `/api/og?d=${address}`;
  const short = address.slice(0, 6) + "..." + address.slice(-4);

  return {
    title: `${short} - Onchain Pulse`,
    openGraph: {
      title: `Portfolio ${short}`,
      description: "View this wallet's public DeFi positions relating to Monad.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Portfolio ${short} - Onchain Pulse`,
      images: [ogUrl],
    },
  };
}

export default function AppPage() {
  return <Dashboard />;
}
