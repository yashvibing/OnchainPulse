import type { Metadata } from "next";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010"),
  title: "Onchain Pulse — Monad Portfolio Tracker",
  description:
    "Onchain Pulse is an independent, unofficial interface. It is not associated with, endorsed by, or affiliated with Monad Foundation.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Onchain Pulse",
    description:
      "View public-wallet DeFi positions relating to Monad, including staking, lending, LP, vault, and token data.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    type: "website",
    siteName: "Onchain Pulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse — Monad Portfolio Tracker",
    description:
      "View public-wallet DeFi positions relating to Monad.",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-radial-glow min-h-screen antialiased">
        <Providers>{children}</Providers>
        <DisclaimerModal />
      </body>
    </html>
  );
}
