"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getAddress } from "viem";
import { type TokenApproval } from "@/services/approvals";
import { ERC20_ABI } from "@/lib/abis";
import { shortenAddress } from "@/lib/format";

interface ApprovalManagerProps {
  approvals: TokenApproval[];
  isLoading: boolean;
  isConnected: boolean;
  onRevoked: () => void;
}

function RiskBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-[rgba(239,68,68,0.1)] text-[var(--color-negative)]",
    medium: "bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)]",
    low: "bg-[rgba(20,184,166,0.1)] text-[var(--color-positive)]",
  };
  const labels = { high: "High Risk", medium: "Medium", low: "Low" };

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

function RevokeButton({
  token,
  spender,
  onSuccess,
}: {
  token: { address: `0x${string}` };
  spender: `0x${string}`;
  onSuccess: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess && !confirmed) {
    setConfirmed(true);
    onSuccess();
  }

  if (confirmed) {
    return (
      <span className="text-[11px] font-medium text-[var(--color-positive)]">
        Revoked
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        writeContract({
          address: getAddress(token.address),
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, 0n],
        });
      }}
      disabled={isPending || isConfirming}
      className="rounded-lg border border-[var(--color-negative)] bg-transparent px-3 py-1.5 text-[11px] font-semibold text-[var(--color-negative)] transition-all hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50"
    >
      {isPending ? "Confirm in wallet..." : isConfirming ? "Revoking..." : "Revoke"}
    </button>
  );
}

export function ApprovalManager({ approvals, isLoading, isConnected, onRevoked }: ApprovalManagerProps) {
  if (isLoading) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
        Scanning approval history...
      </p>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="mb-2 text-[20px]">&#x2705;</div>
        <p className="text-sm text-[var(--color-text-muted)]">
          No active token approvals found.
        </p>
        <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
          This wallet has no ERC-20 spending approvals for tracked tokens.
        </p>
      </div>
    );
  }

  const highCount = approvals.filter((a) => a.riskLevel === "high").length;

  return (
    <div>
      {/* Summary bar */}
      <div className="card mb-4 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {approvals.length} active approval{approvals.length !== 1 ? "s" : ""}
          </span>
          {highCount > 0 && (
            <span className="text-[12px] font-semibold text-[var(--color-negative)]">
              {highCount} unlimited
            </span>
          )}
        </div>
        {!isConnected && (
          <span className="text-[11px] text-[var(--color-warning)]">
            Connect wallet to revoke
          </span>
        )}
      </div>

      {/* Approval list */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_80px_90px] border-b border-[rgba(255,255,255,0.04)] px-5 py-2.5 text-[11px] text-[var(--color-text-dim)]">
          <span>Token</span>
          <span>Spender</span>
          <span>Allowance</span>
          <span>Risk</span>
          <span className="text-right">Action</span>
        </div>

        {/* Rows */}
        {approvals.map((a, i) => (
          <div
            key={`${a.token.address}-${a.spender}`}
            className={`animate-fade-up grid grid-cols-[1.5fr_1.5fr_1fr_80px_90px] items-center px-5 py-3.5 ${
              i < approvals.length - 1 ? "border-b border-[rgba(255,255,255,0.025)]" : ""
            }`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {/* Token */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${a.token.logoColor || "#5A5A74"}, ${a.token.logoColor || "#5A5A74"}88)` }}
              >
                {a.token.symbol.slice(0, 2)}
              </div>
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {a.token.symbol}
              </span>
            </div>

            {/* Spender */}
            <div>
              <div className="text-[12px] text-[var(--color-text-secondary)]">
                {a.spenderLabel}
              </div>
              {a.spenderLabel !== shortenAddress(a.spender) && (
                <div className="font-mono text-[10px] text-[var(--color-text-dim)]">
                  {shortenAddress(a.spender)}
                </div>
              )}
            </div>

            {/* Allowance */}
            <div className={`text-[12px] font-mono ${a.isUnlimited ? "text-[var(--color-negative)]" : "text-[var(--color-text-secondary)]"}`}>
              {a.isUnlimited ? "Unlimited" : a.allowanceFormatted.length > 12 ? a.allowanceFormatted.slice(0, 10) + "..." : a.allowanceFormatted}
            </div>

            {/* Risk */}
            <RiskBadge level={a.riskLevel} />

            {/* Action */}
            <div className="text-right">
              {isConnected ? (
                <RevokeButton
                  token={a.token}
                  spender={a.spender}
                  onSuccess={onRevoked}
                />
              ) : (
                <span className="text-[11px] text-[var(--color-text-dim)]">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
