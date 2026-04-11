import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MonFolio — Monad Portfolio Tracker",
  description:
    "Track your DeFi positions across the Monad ecosystem. Community-made, not affiliated with Monad Foundation.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-radial-glow min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
