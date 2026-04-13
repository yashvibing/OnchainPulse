import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

interface PageProps {
  searchParams: Promise<{ address?: string; v?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const address = params.address;
  const v = params.v;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      openGraph: {
        images: [{ url: "/api/og", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        images: ["/api/og"],
      },
    };
  }

  const ogUrl = `/api/og?address=${address}${v ? `&v=${v}` : ""}`;
  const short = address.slice(0, 6) + "..." + address.slice(-4);

  return {
    title: `${short} — Onchain Pulse`,
    openGraph: {
      title: `Portfolio ${short}`,
      description: "View this wallet's DeFi positions on the Monad ecosystem.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Portfolio ${short} — Onchain Pulse`,
      images: [ogUrl],
    },
  };
}

export default function Page() {
  return <Dashboard />;
}
