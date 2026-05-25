import type { Metadata } from "next";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010"),
  title: "Onchain Pulse - Portfolio & DeFi Rates",
  description:
    "Explore public wallet portfolios and displayed DeFi rates relating to Monad. Onchain Pulse is independent and not affiliated with Monad Foundation.",
  icons: {
    icon: "/onchainpulse-mark.png",
    apple: "/onchainpulse-mark.png",
  },
  openGraph: {
    title: "Onchain Pulse - Portfolio & DeFi Rates",
    description:
      "Explore public wallet portfolios, holdings, and displayed DeFi rates relating to Monad.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    type: "website",
    siteName: "Onchain Pulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse - Portfolio & DeFi Rates",
    description:
      "Explore public wallet portfolios and displayed DeFi rates relating to Monad.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="bg-radial-glow min-h-screen antialiased">
        <Providers>{children}</Providers>
        <DisclaimerModal />
      </body>
    </html>
  );
}
