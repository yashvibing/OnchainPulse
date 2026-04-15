"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="gradient-brand-animated flex h-8 w-8 items-center justify-center rounded-[8px] text-[10px] font-extrabold text-white">
          OP
        </div>
        <div className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Onchain Pulse
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
