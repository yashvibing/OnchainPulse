"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface GoogleAnalyticsProps {
  measurementId?: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const sentPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!measurementId || !ready || !window.gtag) return;

    const pagePath = `${window.location.pathname}${window.location.search}`;
    if (sentPathRef.current === pagePath) return;

    sentPathRef.current = pagePath;

    window.gtag("config", measurementId, {
      page_location: window.location.href,
      page_path: pagePath,
    });
  }, [measurementId, pathname, ready]);

  if (!measurementId) return null;

  const initScript = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
  `;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      >
        {initScript}
      </Script>
    </>
  );
}
