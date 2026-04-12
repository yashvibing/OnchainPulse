# MonFolio

**Community-made Monad Portfolio Dashboard. Not affiliated with Monad Foundation.**

Track your DeFi positions across the entire Monad ecosystem in one place: liquid staking, LP positions, lending vaults, yield vaults, token holdings, and recent transfer history.

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and configure RPC (optional — defaults work for dev)
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter any Monad wallet address or click "Load demo wallet" to explore.

---

## What's Tracked

### Liquid Staking (4 protocols)
- **aPriori** (aprMON), **FastLane** (shMON), **Magma** (gMON) — standard ERC-4626
- **Kintsu** (sMON) — non-standard `convertToAssets(uint96)`, handled with a dedicated ABI

### Lending (Morpho, dynamic)
- **MetaMorpho vaults** — top vaults discovered live from Morpho's GraphQL API at runtime. APYs fetched live. Static fallback list for when the API is down.
- Covers steakETH, hyperUSDCa, augustUSDC, bbqUSDT0, and more as they launch.

### LP Positions
- **Uniswap V3** — NFT-based positions with proper tick-range amount math (sqrtPrice calculations, 4-round multicall). Shows In Range / Out of Range badge, composition, and unclaimed fees.
- **Curve** — Factory-enumerated LP positions across StableSwap (20 pools) and Twocrypto (11 pools). Computes user share of underlying tokens via pool balances.

### Yield Vaults
- **Upshift earnAUSD** — Custom vault (not standard ERC-4626). Valued at 1:1 with AUSD. 8% APY from DefiLlama.

### Token Holdings
- 15 known tokens with real-time prices and 24h change from DefiLlama
- MON, WMON, USDC, USDT0, AUSD, USD1, cbBTC, WBTC, WETH, aprMON, shMON, sMON, gMON

### Transaction History
- Recent token transfers (in/out) via `eth_getLogs` on drpc.org
- ~70 minutes of lookback, all tracked tokens, both directions
- Upgrade path to BlockVision API for full coverage (see `.env.example`)

### LST Double-Count Protection
LST tokens (shMON, aprMON, sMON, gMON) appear in the Tokens table for visibility but are excluded from the Total Value sum — the staking position already accounts for their value. Regression-tested in `test/hooks/usePortfolio.regression-001.test.tsx`.

---

## Commands

```bash
npm run dev        # Start dev server
npm run dev:fresh  # Clean .next/ first — use after running next build
npm run build      # Production build (includes type check)
npm run lint       # ESLint
npm test           # Run vitest suite (20 tests, ~1.5s)
npm run test:watch # Vitest in watch mode
npm run clean      # Wipe .next/ cache
```

**Gotcha:** Don't run `npm run build` while `npm run dev` is running — both write into `.next/` and the dev server will crash. Use `npm run dev:fresh` to recover.

---

## Project Structure

```
monfolio/
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind + design tokens
│   │   ├── layout.tsx               # Root layout with providers
│   │   ├── page.tsx                 # Main dashboard (7 tabs)
│   │   └── providers.tsx            # React Query provider
│   ├── components/
│   │   ├── Header.tsx               # App header
│   │   ├── AddressInput.tsx         # Wallet address input + demo button
│   │   ├── StatCards.tsx            # Total value, daily yield, position count
│   │   ├── TabBar.tsx               # Tab navigation
│   │   ├── TokenTable.tsx           # Token holdings with 24h change
│   │   ├── StakingCards.tsx         # Staking position cards
│   │   ├── LiquidityCards.tsx       # Uniswap V3 + Curve LP cards
│   │   ├── LendingCards.tsx         # Morpho lending cards
│   │   ├── VaultCards.tsx           # Yield vault cards
│   │   ├── TransactionList.tsx      # Transfer history list
│   │   └── EmptyState.tsx           # Empty + loading states
│   ├── config/
│   │   ├── chain.ts                 # Monad chain (ID 143)
│   │   ├── tokens.ts                # Token address registry (15 tokens)
│   │   └── protocols.ts             # Protocol addresses + vault configs
│   ├── hooks/
│   │   └── usePortfolio.ts          # React Query hooks (8 hooks)
│   ├── lib/
│   │   ├── abis.ts                  # Contract ABIs
│   │   ├── client.ts                # viem PublicClient singleton
│   │   └── format.ts                # Display formatting
│   └── services/
│       ├── tokens.ts                # Token balances + prices + 24h change
│       ├── staking.ts               # 4 LST protocols
│       ├── lending.ts               # Morpho dynamic vault discovery
│       ├── liquidity.ts             # Uniswap V3 + Curve LP
│       ├── vaults.ts                # Upshift yield vaults
│       ├── transactions.ts          # Transfer history via eth_getLogs
│       └── yields.ts                # DefiLlama yields API
├── test/
│   ├── setup.ts
│   ├── lib/format.test.ts           # 16 unit tests
│   └── hooks/usePortfolio.regression-001.test.tsx  # LST double-count regression
├── vitest.config.ts
├── CLAUDE.md                        # Project context for Claude Code
├── TESTING.md                       # Test conventions and workflow
├── .env.example
├── package.json
└── next.config.mjs
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict, ES2020 target) |
| Styling | Tailwind CSS v4 |
| Chain SDK | viem |
| Data fetching | @tanstack/react-query |
| Prices + 24h | DefiLlama (coins + percentage endpoints) |
| APYs | DefiLlama Yields + Morpho GraphQL API |
| RPC | rpc.monad.xyz (default) + monad-mainnet.drpc.org (tx history) |
| Testing | vitest + @testing-library/react + jsdom |

---

## Still TODO

1. Replace manual address input with wagmi wallet connect
2. 30-day portfolio value sparkline chart
3. Upgrade transaction history to BlockVision (full coverage, requires API key)
4. Balancer V3 LP positions (contracts deployed but non-functional, needs investigation)
5. Kuru DEX positions (CLOB+AMM hybrid, needs their SDK)

See [CLAUDE.md](CLAUDE.md) for the full prioritized TODO list with investigation notes.

---

## Configuration

### RPC Endpoint

Default uses `rpc.monad.xyz` (public, rate-limited). For production, get a paid key from Alchemy, QuickNode, or Chainstack and set `NEXT_PUBLIC_MONAD_RPC_URL` in `.env.local`.

### Adding New Tokens

Edit `src/config/tokens.ts`. Add address, symbol, decimals, and category. Tokens with `category: "lst"` are automatically excluded from the Total Value sum (the staking position handles their value).

### Adding New Protocols

Edit `src/config/protocols.ts`. For staking: add to `STAKING_PROTOCOLS`. For Morpho vaults: they're discovered automatically from the API. For Curve: pools are discovered via factory enumeration. For custom protocols: create a service in `src/services/` and wire it into `usePortfolio`.

---

*MonFolio — Built for the Monad community.*
