"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export default function AccessPage() {
  return (
    <Suspense>
      <AccessForm />
    </Suspense>
  );
}

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/access/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, next: nextPath }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; next?: string };

      if (!response.ok || !data.ok) {
        setMessage(data.message || "Access code could not be redeemed.");
        return;
      }

      router.replace(data.next || "/");
      router.refresh();
    } catch {
      setMessage("Could not verify the code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)]">
            <Image
              src="/onchainpulse-mark.png"
              alt=""
              width={30}
              height={30}
              priority
              style={{ width: 30, height: 30 }}
            />
          </span>
          <div>
            <div className="text-[18px] font-black text-[var(--color-accent-primary)]">
              Onchain Pulse
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)]">
              Private access
            </div>
          </div>
        </div>

        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Enter your access code.
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Each invite code can be redeemed once. After redemption, this browser
          will stay signed in for Onchain Pulse.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label
            htmlFor="access-code"
            className="label-caps text-[var(--color-accent-primary)]"
          >
            Access code
          </label>
          <input
            id="access-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="OP-XXXX-XXXX"
            autoComplete="one-time-code"
            className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface-solid)] px-4 py-3 font-mono text-[15px] uppercase text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent-primary)]"
          />
          <button
            type="submit"
            disabled={isSubmitting || code.trim().length === 0}
            className="btn-primary mt-4 w-full px-5 py-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Checking..." : "Unlock app"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[rgba(255,180,171,0.35)] bg-[rgba(255,180,171,0.08)] px-3 py-2 text-[12px] text-[var(--color-negative)]">
            {message}
          </p>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
          Onchain Pulse is an independent, unofficial interface. It is not
          associated with, endorsed by, or affiliated with Monad Foundation.
        </p>
      </section>
    </main>
  );
}
