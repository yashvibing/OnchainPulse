import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onchain Pulse — Monad Portfolio Tracker",
  description:
    "Track your DeFi positions across the Monad ecosystem. Community-made, not affiliated with Monad Foundation.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Onchain Pulse",
    description:
      "Track your DeFi positions across the Monad ecosystem. Staking, lending, LP, vaults, and tokens.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    type: "website",
    siteName: "Onchain Pulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onchain Pulse — Monad Portfolio Tracker",
    description:
      "Track your DeFi positions across the Monad ecosystem.",
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
      </body>
    </html>
  );
}
