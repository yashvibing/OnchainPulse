# Scaling Notes

Onchain Pulse is designed to stay read-only: users can paste a wallet address and browse displayed DeFi rates without connecting a wallet or sending transactions. The main scaling risk is repeated reads against third-party APIs and RPC endpoints.

## Current Data Flow

- Portfolio pages call `/api/portfolio/:address`, which loads tokens, staking, vaults, lending, and liquidity in one server-side request.
- Token-only views call `/api/token-balances/:address`.
- DeFi Rates call `/api/yield-opportunities`.
- The MON chart calls `/api/mon-price-history`.
- `/api/health` checks source reachability and returns cache stats for debugging.

## Caching And Request Dedupe

- Address-specific portfolio data is cached server-side for 60 seconds, with stale fallback for 10 minutes.
- DeFi Rates and MON price history are cached server-side for 5 minutes.
- Concurrent requests for the same cache key share one in-flight promise, so a traffic burst does not fan out into identical upstream calls.
- Responses include cache headers and lightweight `X-Cache-*` headers so the UI and operators can tell whether data was fresh, cached, or served from stale fallback.
- Production uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured. Local/dev falls back to in-memory cache automatically.

## Rate Limit Strategy

- Client components no longer auto-refetch on window focus.
- Third-party source calls use timeout, retry, and small backoff helpers.
- If an upstream source fails and cached data is still valid, the app serves the cached response instead of failing the user experience.
- No wallet connection is required, so there are no user signature prompts, approvals, or transaction flows to scale.

## 200 User Readiness

For roughly 200 users per day, this setup should be fine if traffic is normal browsing traffic:

- DeFi Rates are shared globally across users through Redis.
- MON price history is shared globally across users through Redis.
- Portfolio data is cached per pasted address, which helps if users refresh, share the same demo wallet, or move between tabs.

The remaining bottleneck is unique wallet lookups. If many users paste different addresses at the same time, RPC reads still scale with address uniqueness.

## Next Production Steps

- Add a paid or higher-limit Monad RPC provider.
- Add low-cardinality server logs for source failures, latency, and cache hit rates.
- Add a small admin-only debug page that reads `/api/health`.
- Add synthetic canary checks for the home page, portfolio page, DeFi Rates page, and startups page.

## Privacy

The app does not need user accounts or wallet connections. Avoid logging full wallet addresses in production logs unless needed for short-term debugging. Prefer truncated addresses or hashed cache keys.
