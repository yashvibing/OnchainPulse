import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
    <Header />
    <main className="mx-auto flex min-h-[70vh] max-w-[1280px] flex-col items-center justify-center px-5 py-16 text-center">
      <div className="font-mono text-[12px] uppercase tracking-[1.5px] text-[var(--color-accent-primary)]">
        404
      </div>
      <h1 className="mt-3 text-[28px] font-black tracking-[-0.02em] text-[var(--color-text-primary)]">
        Page not found
      </h1>
      <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-5 text-[13px] font-bold text-[#08100d] transition-opacity hover:opacity-90"
        >
          Open portfolio tracker
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 text-[13px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Go to home
        </Link>
      </div>
    </main>
    </>
  );
}
