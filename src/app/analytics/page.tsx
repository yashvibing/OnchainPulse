import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Monad Analytics - Onchain Pulse",
  description:
    "Monad market, network, DeFi, and liquidity analytics from public data sources.",
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 md:px-6 md:pt-8">
        <AnalyticsDashboard />
      </main>
    </div>
  );
}
