# Onchain Pulse

Onchain Pulse is an independent, unofficial interface for exploring public wallet portfolios, displayed DeFi rates, curated ecosystem updates, and Telegram alerts relating to Monad.

It is not associated with, endorsed by, sponsored by, maintained by, or affiliated with Monad Foundation.

## What It Does

- **Portfolio Tracker** - paste a public wallet address and view token holdings, staking positions, lending, vaults, liquidity positions, MON price context, and CSV export.
- **DeFi Rates** - compare displayed lending, staking-rate, LP, borrow, and vault opportunities using data from Merkl, DefiLlama, and protocol/source metadata.
- **Latest News** - curated updates with an admin review flow, X post ingestion, and optional Telegram distribution.
- **Ecosystem / Startups** - browse curated DeltaV startup listings and continue to DeltaV to leave feedback.
- **Telegram Alerts** - create APR threshold, displayed-rate-change, new-market, and brief alerts through Telegram.

The app does not require wallet connection for the core experience. Users can paste public wallet addresses and opt into Telegram alerts separately.

## Live App

Production: [https://onchainpulse.app](https://onchainpulse.app)

Main routes:

- `/` - product home
- `/app` - portfolio tracker
- `/defi-rates` - DeFi rates
- `/news` - latest news
- `/news/admin` - protected news admin
- `/startups` - DeltaV startup directory
- `/alerts` - Telegram alert setup and management
- `/api/health` - source and cache health check

## Data Sources

| Area | Sources |
| --- | --- |
| Portfolio balances | Monad RPC, token registry, protocol readers |
| Token prices and MON chart | DefiLlama / configured market sources |
| DeFi rates | Merkl, DefiLlama rate data, protocol/source metadata |
| Startup listings | Curated DeltaV data |
| Latest news | Manual admin entries, submitted tips, tracked X accounts |
| Alerts | Onchain Pulse rate/news data plus Telegram Bot API |
| Cache and rate limits | Upstash Redis with in-memory local fallback |

Source data can be incomplete, delayed, or changed by upstream providers. Displayed rates and portfolio values are snapshots, not recommendations.

## Tech Stack

| Layer | Tool |
| --- | --- |
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4 |
| Chain reads | viem |
| Data fetching | TanStack Query |
| Cache | Upstash Redis |
| Alerts | Telegram Bot API |
| News ingest | X API v2 |
| Tests | Vitest, Testing Library |
| Hosting | Vercel |

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Common commands:

```bash
npm run dev        # Start local dev server
npm run dev:fresh  # Clear .next and start dev server
npm run build      # Production build
npm run lint       # ESLint
npm test           # Vitest
npm run clean      # Remove .next
```

## Environment Variables

Core:

```bash
NEXT_PUBLIC_SITE_URL=https://onchainpulse.app
MONAD_RPC_URL=
NEXT_PUBLIC_MONAD_RPC_URL=
```

Redis cache:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Telegram alerts:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_CHANNEL_ID=@your_channel_username
NEXT_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/your_channel_username
```

News admin and cron:

```bash
NEWS_ADMIN_USERNAME=OPbolte
NEWS_ADMIN_PASSWORD=
NEWS_INGEST_TOKEN=
CRON_SECRET=
```

X ingest:

```bash
X_BEARER_TOKEN=
X_TRACKED_ACCOUNTS=account1:5,account2:3
```

Optional enrichments:

```bash
BLOCKVISION_API_KEY=
DEBANK_API_KEY=
```

Never commit real API keys or secrets.

## Scheduled Jobs

GitHub Actions runs `.github/workflows/x-ingest.yml` every 30 minutes.

The workflow:

1. Calls `/api/cron/x-ingest` to fetch and score posts from tracked X accounts.
2. Adds high-signal posts to Latest News, capped by run and daily limits.
3. Sends only higher-priority updates to Telegram, also capped by run and daily limits.
4. Calls `/api/alerts/check` to process Telegram alerts and daily briefs.

Current safety limits in code:

- X accounts processed per run: max 15
- X posts fetched per account per run: max 5
- Latest news from X: max 4 per run, max 10 per UTC day
- Telegram broadcasts from X: max 2 per run, max 3 per UTC day

## Project Structure

```txt
src/
  app/                  Next.js routes and API routes
  components/           Portfolio, DeFi rates, news, alerts, and shared UI
  config/               Chain, token, and protocol configuration
  data/                 Curated static datasets
  hooks/                Client data hooks
  lib/                  Formatting, logging, cache, auth, logos, helpers
  services/             Portfolio, rate, Telegram, X, and protocol services
test/                   Unit and regression tests
.github/workflows/      Scheduled ingest and alert checks
```

## Important Notes

- Onchain Pulse is informational software, not financial, investment, tax, or legal advice.
- Inclusion of an asset, protocol, vault, startup, news item, or data source is not an endorsement.
- The interface does not custody assets or execute transactions.
- Keep Monad Foundation language precise: this project is independent and unaffiliated.
