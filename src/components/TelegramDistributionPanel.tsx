import Link from "next/link";

interface TelegramDistributionPanelProps {
  compact?: boolean;
}

function getTelegramChannelUrl() {
  const explicit = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL?.trim();
  if (explicit) return explicit;

  const username = process.env.TELEGRAM_CHANNEL_USERNAME?.trim().replace(/^@/u, "");
  return username ? `https://t.me/${username}` : "";
}

export function TelegramDistributionPanel({ compact = false }: TelegramDistributionPanelProps) {
  const channelUrl = getTelegramChannelUrl();

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5">
      <div className="label-caps text-[var(--color-accent-primary)]">
        Telegram distribution
      </div>
      <h2 className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">
        Channel for news. Bot for personal alerts.
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        Join the public channel for Monad news, daily recaps, and narrative updates.
        Connect the bot only for wallet, market, DeFi, and opt-in digest alerts.
      </p>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {channelUrl ? (
          <a
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-3 text-center text-[13px] font-bold text-[#07110C] transition-opacity hover:opacity-90"
          >
            Join Telegram channel
          </a>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-center text-[13px] font-bold text-[var(--color-text-muted)]">
            Channel link not configured
          </div>
        )}

        <Link
          href="/alerts#create-alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-center text-[13px] font-bold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Connect alert bot
        </Link>
      </div>
    </section>
  );
}
