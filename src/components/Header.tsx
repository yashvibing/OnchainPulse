"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="gradient-brand-animated flex h-9 w-9 items-center justify-center rounded-[10px] text-[11px] font-extrabold text-white">
          OP
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Onchain Pulse
          </div>
        </div>
      </div>
      <ConnectButton
        chainStatus="none"
        showBalance={false}
        accountStatus="avatar"
      />
    </header>
  );
}
