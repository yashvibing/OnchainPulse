# Scaling Notes

Onchain Pulse is designed to stay read-only: users can paste a wallet address and browse displayed DeFi rates without connecting a wallet or sending transactions. The main scaling risk is repeated reads against third-party APIs and RPC endpoints.

## Current Data Flow

- Portfolio pages call `/api/portfolio/:address`, which loads tokens, staking, vaults, lending, and liquidity in one server-side request.
- Token-only views call `/api/token-balances/:address`.
- DeFi Rates call `/api/yield-opportunities`.
- The MON chart calls `/api/mon-price-history`.
- `/api/health` checks source reachability and returns cache stats for debugging.
- Server-side Monad reads use `MONAD_RPC_URL` when configured. Keep keyed RPC URLs in this private env var rather than `NEXT_PUBLIC_MONAD_RPC_URL`.
- Token balance reads use BlockVision's indexed account-token API first when `BLOCKVISION_API_KEY` is configured, then fall back to RPC balance reads.

## Caching And Request Dedupe

- Address-specific portfolio data is cached server-side for 60 seconds, with stale fallback for 10 minutes.
- DeFi Rates and MON price history are cached server-side for 5 minutes.
- Concurrent requests for the same cache key share one in-flight promise, so a traffic burst does not fan out into identical upstream calls.
- Responses include cache headers and lightweight `X-Cache-*` headers so the UI and operators can tell whether data was fresh, cached, or served from stale fallback.
- Production uses Upstash Redis when Redis REST env vars are configured. The app accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, Vercel integration names like `UPSTASH_REDIS_REST_KV_REST_API_URL` / `UPSTASH_REDIS_REST_KV_REST_API_TOKEN`, or `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Local/dev falls back to in-memory cache automatically.

## Rate Limit Strategy

- Client components no longer auto-refetch on window focus.
- Third-party source calls use timeout, retry, and small backoff helpers.
- If an upstream source fails and cached data is still valid, the app serves the cached response instead of failing the user experience.
- No wallet connection is required, so there are no user signature prompts, approvals, or transaction flows to scale.
- API routes use a light fixed-window limiter keyed by a hashed client fingerprint. Redis is used in production, with memory fallback locally.
- Current limits:
  - `/api/portfolio/:address`: 60 requests per minute.
  - `/api/token-balances/:address`: 60 requests per minute.
  - `/api/yield-opportunities`: 180 requests per minute.
  - `/api/mon-price-history`: 180 requests per minute.
  - `/api/health`: 10 requests per minute.

## 200 User Readiness

For roughly 200 users per day, this setup should be fine if traffic is normal browsing traffic:

- DeFi Rates are shared globally across users through Redis.
- MON price history is shared globally across users through Redis.
- Portfolio data is cached per pasted address, which helps if users refresh, share the same demo wallet, or move between tabs.

The remaining bottleneck is unique wallet lookups. If many users paste different addresses at the same time, RPC reads still scale with address uniqueness.

## Next Production Steps

- Add a paid or higher-limit Monad RPC provider.
- Add a small admin-only debug page that reads `/api/health`.
- Add synthetic canary checks for the home page, portfolio page, DeFi Rates page, and startups page.

## Production Logs

Server routes emit structured JSON logs to the hosting runtime logs. The logged events are intentionally low-cardinality and avoid raw wallet addresses, IP addresses, and secrets.

Current events:

- `api.slow`: API route response exceeded the slow threshold.
- `api.failed`: API route returned a server failure.
- `source.slow`: third-party source request exceeded the slow threshold.
- `source.http_error` / `source.fetch_failed`: third-party source failures.
- `rpc.health_failed`: health check RPC failure.
- `indexer.token_balances_used`: BlockVision indexed token balances were used.
- `indexer.token_balances_failed`: BlockVision indexed token balances failed and the app fell back to RPC.
- `cache.miss`: cache miss triggered an upstream reload.
- `cache.stale_fallback`: stale cached data was served after refresh failure.
- `cache.redis_read_failed` / `cache.redis_write_failed`: Redis cache operation failed.
- `rate_limit.blocked`: request was blocked by rate limiting.
- `rate_limit.redis_failed`: rate limiter fell back open because Redis failed.

## Privacy

The app does not need user accounts or wallet connections. Avoid logging full wallet addresses in production logs unless needed for short-term debugging. Prefer truncated addresses or hashed cache keys.
