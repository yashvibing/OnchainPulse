# CLAUDE.md — Project Context for Claude Code

## What is this project?

MonFolio is a community-made portfolio dashboard for the Monad blockchain ecosystem. It lets users enter a wallet address and see all their DeFi positions in one place — token holdings, staking, LP positions, lending, and yield vaults.

**Not affiliated with Monad Foundation.** This is a community tool. Avoid using Monad's exact branding (their specific purple, their logo). We use our own color palette (deep indigo #6D3BF5 + teal #0EA5A0).

## Tech Stack

- **Framework**: Next.js 15 (App Router, `src/` directory)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 (using `@theme` in globals.css for design tokens)
- **Chain SDK**: viem (NOT ethers.js — use viem for all on-chain reads)
- **State/Caching**: @tanstack/react-query
- **Blockchain**: Monad (EVM-compatible L1, Chain ID 143)
- **Price Data**: DefiLlama API (free, no API key needed)
- **APY Data**: DefiLlama Yields API (free)

## Monad Network Details

- **Chain ID**: 143 (mainnet), 10143 (testnet)
- **RPC**: `https://rpc.monad.xyz` (official Monad public endpoint, default in code) or configured via `NEXT_PUBLIC_MONAD_RPC_URL`. Alternative: `https://monad-mainnet.drpc.org` (third-party aggregator, also works).
- **Block Explorers**: monadvision.com, monadscan.com, monad.socialscan.io
- **Multicall3**: `0xcA11bde05977b3631167028862bE2a173976CA11`
- **WMON** (mainnet): `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` (verified on-chain: `symbol()` returns `"WMON"`, `name()` returns `"Wrapped MON"`). The earlier-documented `0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701` is the testnet address.
- Monad is fully EVM-compatible — standard eth_* JSON-RPC methods, Solidity contracts, same address format as Ethereum

## Project Architecture

```
src/
├── config/         # Chain, token, and protocol configuration
│   ├── chain.ts    # Monad chain definition for viem
│   ├── tokens.ts   # Token addresses + metadata registry
│   └── protocols.ts # DeFi protocol addresses (staking, lending, vaults)
├── lib/            # Shared utilities
│   ├── abis.ts     # Contract ABIs (ERC20, ERC4626, Kintsu, Morpho, UniV3, Curve)
│   ├── client.ts   # viem PublicClient singleton
│   └── format.ts   # Display formatting helpers
├── services/       # Data fetching (pure functions, no React)
│   ├── tokens.ts   # Token balances + prices + 24h change via multicall + DefiLlama
│   ├── staking.ts  # Liquid staking positions (aPriori, FastLane, Kintsu, Magma)
│   ├── lending.ts  # MetaMorpho vault positions + APYs from Morpho GraphQL
│   ├── liquidity.ts # LP positions (Uniswap V3 + Curve)
│   ├── vaults.ts   # Yield vault positions (Upshift earnAUSD)
│   ├── transactions.ts # Transfer history via eth_getLogs on drpc.org
│   └── yields.ts   # APY data from DefiLlama
├── hooks/          # React Query wrappers
│   └── usePortfolio.ts
├── components/     # UI components
│   ├── Header.tsx, AddressInput.tsx, StatCards.tsx
│   ├── TabBar.tsx, TokenTable.tsx, StakingCards.tsx
│   ├── LiquidityCards.tsx, LendingCards.tsx, VaultCards.tsx
│   ├── TransactionList.tsx
│   └── EmptyState.tsx
└── app/            # Next.js app router
    ├── layout.tsx, page.tsx, providers.tsx
    └── globals.css
```

**Pattern for adding new features:**
1. Add addresses/config in `src/config/`
2. Add ABI in `src/lib/abis.ts` if needed
3. Create a service function in `src/services/`
4. Add a React Query hook in `src/hooks/`
5. Build a component in `src/components/`
6. Wire it into `src/app/page.tsx`

## Key DeFi Protocols on Monad (what we track)

All addresses below verified on-chain. Source of truth: github.com/monad-crypto/protocols.

### Liquid Staking (WORKING)
- **aPriori** — aprMON (`0x0c65A0BC65a5D819235B71F554D210D3F80E0852`). ERC-4626 `convertToAssets(uint256)`. ~17.2% APY.
- **FastLane** — shMON (`0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c`). ERC-4626 `convertToAssets(uint256)`. ~15.8% APY.
- **Kintsu** — sMON (`0xA3227C5969757783154C60bF0bC1944180ed81B9`). Note: on-chain symbol is `sMON`, NOT `kMON` — older docs called it kMON. Uses non-standard `convertToAssets(uint96)` (selector `0xfb9848e4`), see [src/lib/abis.ts](src/lib/abis.ts) `KINTSU_LST_ABI`. ~11.1% APY.
- **Magma** — gMON (`0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081`). Standard ERC-4626. ~11.4% APY.

The LST exclusion rule lives in [src/hooks/usePortfolio.ts](src/hooks/usePortfolio.ts) — LST balances appear in the Tokens table for visibility but are NOT counted in `totalValue` (the staking position contributes the value). New LSTs MUST set `category: "lst"` in [src/config/tokens.ts](src/config/tokens.ts) or the regression test will catch the double-count.

### Lending (WORKING — MetaMorpho vaults)
- **Morpho Blue** core: `0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee`
- **MetaMorpho vaults** — top ~10 by TVL hardcoded in [src/config/protocols.ts](src/config/protocols.ts) `MORPHO_VAULTS` (steakETH, hyperUSDCa, augustUSDC, bbqUSDT0, etc.). Standard ERC-4626. APYs fetched live from `blue-api.morpho.org/graphql`. Refresh the list periodically by re-querying that endpoint with `chainId_in: [143]`.
- **Direct Morpho Blue positions** are NOT supported — they need bytes32 market IDs and per-market indexing. Most retail users hold MetaMorpho shares, not direct positions.
- **Euler** — disabled. The address listed in monad-crypto/protocols is the eVaultFactory, not a real vault.

### DEXs / LP Positions
- **Uniswap V3** (WORKING) — NFT-based positions with proper tick-range amount math (4-round multicall). Verified with real holder `0x9ed4...394c` (WMON/USDC 0.3% fee, $74.50 out-of-range).
- **Curve** (WORKING) — Factory-enumerated LP positions (StableSwap: 20 pools, Twocrypto: 11 pools). Computes user share of underlying via balanceOf/totalSupply × pool balances. Build-verified and empty-state-verified. Not verified with a real LP holder (Curve LP activity on Monad is very infrequent; holders deposited long ago and don't transfer, so they're outside the RPC log-scan window).
- **Balancer V3** (BLOCKED) — Contracts deployed (`Vault: 0xbA13...bA9`, factories at `0x7657...3a6` etc.) but all functions revert ("Not implemented" or "execution reverted"). Despite $8.3M TVL on DefiLlama, the deployed factory/vault contracts are non-functional via standard Balancer V3 ABI. Pools may have been deployed via a different mechanism or the interface differs from canonical docs. Needs deeper investigation.
- **Kuru** (BLOCKED) — CLOB+AMM hybrid with custom MarginAccount (`0x2A68...90c5`) + Vault contracts. No standard LP token pattern. Would need Kuru's SDK/API to read positions. Router at `0xd651...5CC`.

### Yield Vaults (WORKING)
- **Upshift earnAUSD** — `0x103222...7496`. Custom vault, NOT standard ERC-4626 (convertToAssets reverts). Valued at 1:1 with AUSD (under-reports accrued yield by ~5-10%). 8.0% APY from DefiLlama. Verified with real holder `0x7362...034f` ($236K position). EARNMON vault also exists on DefiLlama but address not yet published in monad-crypto/protocols.

## Contract Address Source of Truth

All live contract addresses for Monad protocols are maintained at:
**https://github.com/monad-crypto/protocols**

Each protocol has a JSON file at `mainnet/{protocol}.json` with all contract addresses.

The token list is at:
**https://github.com/monad-crypto/token-list**

## Important Conventions

- **No Monad Foundation branding** — we are community-made. Use our own gradient (indigo→teal), not their purple.
- **All on-chain reads use viem** — never import ethers. The client is at `src/lib/client.ts`.
- **Multicall for batch reads** — viem client has `batch: { multicall: true }` enabled. Use `client.multicall()` for multiple contract reads.
- **DefiLlama for prices** — `coins.llama.fi/prices/current/monad:{address}` for token prices, `yields.llama.fi/pools` for APYs. Both are free.
- **CSS uses design tokens** — all colors are CSS variables defined in `globals.css` under `@theme`. Use `var(--color-*)` or the Tailwind equivalents.
- **Components are self-contained** — each component file handles its own layout. No global state outside React Query.

## Commands

```bash
npm run dev        # Start dev server on localhost:3000
npm run dev:fresh  # Cleans .next first — use after running `next build`
npm run build      # Production build (also runs type check — must pass before deploy)
npm run start      # Run the production build (after `build`)
npm run lint       # Run ESLint
npm test           # Run vitest suite (should always be green on main)
npm run test:watch # Vitest in watch mode while developing
npm run clean      # Wipe .next/ — use when dev mode is acting weird
```

### Gotcha: don't run `next build` while `next dev` is running

Both write into `.next/`. The dev server holds dev artifacts (chunks, route
manifests) and `next build` overwrites them with production artifacts. After
that, dev's next request crashes with `ENOENT: routes-manifest.json` or
`Cannot find module './<chunk>.js'`. The fix is `npm run dev:fresh` (which
wipes `.next/` first).

If you only need to type-check, prefer `npx tsc --noEmit` — it doesn't touch
`.next/`. If you need a real production build, stop dev first.

## Testing

Tests live in `test/` mirroring the `src/` tree. Stack: vitest + jsdom + @testing-library/react. See [TESTING.md](TESTING.md) for the full guide.

Expectations when changing code:
- **New function** → add a test.
- **Bug fix** → add a regression test that fails on the old code and passes on the fix. Verify by temporarily reverting.
- **New conditional** (if/else, switch) → test BOTH branches.
- **Never commit code that makes existing tests fail.**
- **The LST exclusion rule in `usePortfolio.ts` is regression-tested** ([test/hooks/usePortfolio.regression-001.test.tsx](test/hooks/usePortfolio.regression-001.test.tsx)). When wiring new staking protocols (Kintsu, Magma) the new LSTs must follow the same `category: "lst"` rule or the regression test will catch the double-count.

## TODO (priority order)

1. Investigate Balancer V3 — contracts deployed but revert on standard calls. $8.3M TVL exists. May need Balancer team help or a subgraph.
2. Investigate Kuru — CLOB+AMM hybrid, need their SDK/API. No standard LP token pattern.
3. Add EARNMON to Upshift vaults when address surfaces in monad-crypto/protocols
4. Verify Curve LP end-to-end with a real holder (build-verified but not holder-verified)
5. One-click staking/unstaking actions via connected wallet
6. Wrap/unwrap MON via WMON contract

### Done
- ✅ Look up real addresses from `monad-crypto/protocols` for staking, Morpho, Curve, Upshift
- ✅ Add Kintsu and Magma staking (with Kintsu's uint96 quirk)
- ✅ Add Morpho lending via MetaMorpho vaults (dynamic discovery from API, static fallback)
- ✅ Wire 24h price change column from DefiLlama
- ✅ Stop double-counting LSTs in totalValue (regression-tested)
- ✅ Bootstrap vitest test suite + CI-ready scripts
- ✅ Wire Uniswap V3 LP positions with proper tick-range amount math
- ✅ Wire Curve LP positions via factory enumeration (StableSwap + Twocrypto)
- ✅ Wire Upshift earnAUSD yield vault (with 1:1 fallback for custom vault)
- ✅ Add `clean` / `dev:fresh` scripts to fix the dev/build cache collision
- ✅ Fix USDT → USDT0 mislabeling, add cbBTC + USD1 tokens
- ✅ Update EmptyState copy to reflect actual protocol coverage
- ✅ Add Neverland (Aave V3 fork) + Curvance (ERC-4626) lending
- ✅ Replace manual address input with wagmi wallet connect (RainbowKit)
- ✅ Add 7-day portfolio sparkline chart
- ✅ Dynamic token list from monad-crypto/token-list (72 tokens)
- ✅ Shareable portfolio URLs with OG image generation
- ✅ Token approval manager with revoke support
- ✅ 13 design polish improvements + premium design upgrade (Satoshi font)
- ✅ Push to GitHub (yashcrypto21/OnchainPulse)
