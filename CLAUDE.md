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
- **RPC**: `https://monad-mainnet.drpc.org` (public, rate-limited) or configured via `NEXT_PUBLIC_MONAD_RPC_URL`
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
│   ├── abis.ts     # Contract ABIs (ERC20, ERC4626, Morpho, UniV3)
│   ├── client.ts   # viem PublicClient singleton
│   └── format.ts   # Display formatting helpers
├── services/       # Data fetching (pure functions, no React)
│   ├── tokens.ts   # Token balances + prices via multicall + DefiLlama
│   ├── staking.ts  # Staking positions via ERC-4626 reads
│   └── yields.ts   # APY data from DefiLlama
├── hooks/          # React Query wrappers
│   └── usePortfolio.ts
├── components/     # UI components
│   ├── Header.tsx, AddressInput.tsx, StatCards.tsx
│   ├── TabBar.tsx, TokenTable.tsx, StakingCards.tsx
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

### Liquid Staking (WORKING)
- **aPriori** — LST token: aprMON (`0xb2f82D0f38dc453D596Ad40A37799446Fae9b0CF`). Uses ERC-4626 `convertToAssets()`.
- **FastLane** — LST token: shMON (`0x3a98250F98Dd388C211206F907e4d85439900D7a`). Uses ERC-4626 `convertToAssets()`.
- **Kintsu** — LST token: kMON. Address TODO — look up in github.com/monad-crypto/protocols
- **Magma** — LST token: gMON. Address TODO — look up in github.com/monad-crypto/protocols

### DEXs / LP Positions (SCAFFOLDED — needs wiring)
- **Uniswap V3** — NFT-based positions. ABI in `abis.ts`. Need PositionManager address.
- **Kuru** — On-chain CLOB DEX. Hybrid CLOB+AMM model.
- **Curve** — Stableswap pools (AUSD/USDC etc). Standard LP tokens.
- **Balancer V3** — Weighted pools.

### Lending (SCAFFOLDED — needs wiring)
- **Morpho** — Market-based lending. ABI in `abis.ts`. Need Morpho Blue address.
- **Euler** — ERC-4626 vaults with debtOf(). ABI in `abis.ts`. Need vault addresses.

### Yield Vaults (SCAFFOLDED — needs wiring)
- **Upshift** — WMON and AUSD yield vaults. ERC-4626 pattern. Need vault addresses.

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
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

## TODO (priority order)

1. Look up real contract addresses from monad-crypto/protocols repo and fill in TODOs in `src/config/protocols.ts`
2. Wire up Uniswap V3 LP position reading (ABI ready in abis.ts)
3. Add Morpho lending positions (ABI ready)
4. Add Upshift yield vault positions (ERC-4626 pattern)
5. Add 30-day portfolio value sparkline chart
6. Add transaction history via BlockVision API or eth_getLogs
7. Replace manual address input with wagmi wallet connect
8. Add Kintsu and Magma staking protocols
