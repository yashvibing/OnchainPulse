import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { StartupDirectory } from "@/components/StartupDirectory";

export const metadata: Metadata = {
  title: "Startup Feedback - Onchain Pulse",
  description:
    "Browse public DeltaV startup listings and continue to DeltaV to give feedback.",
};

export default function StartupsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-[1180px] px-5 pb-16 pt-8">
        <StartupDirectory />
      </main>
    </div>
  );
}
