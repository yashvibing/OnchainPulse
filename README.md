# MonFolio

**Community-made Monad Portfolio Dashboard. Not affiliated with Monad Foundation.**

Track your DeFi positions across the entire Monad ecosystem — staking, LP positions, lending, yield vaults, and token holdings — all in one place.

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and configure RPC
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
monfolio/
├── src/
│   ├── app/
│   │   ├── globals.css          # Tailwind + design tokens
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Main dashboard page
│   │   └── providers.tsx        # React Query provider
│   ├── components/
│   │   ├── Header.tsx           # App header with branding
│   │   ├── AddressInput.tsx     # Wallet address search
│   │   ├── StatCards.tsx        # Total value, daily yield, position count
│   │   ├── TabBar.tsx           # Navigation tabs
│   │   ├── TokenTable.tsx       # ERC-20 token holdings table
│   │   ├── StakingCards.tsx     # Staking position cards
│   │   └── EmptyState.tsx       # Empty + loading states
│   ├── config/
│   │   ├── chain.ts             # Monad chain definition (ID 143)
│   │   ├── tokens.ts            # Known token addresses
│   │   └── protocols.ts         # DeFi protocol registry
│   ├── hooks/
│   │   └── usePortfolio.ts      # React Query hooks
│   ├── lib/
│   │   ├── abis.ts              # Contract ABIs (ERC20, ERC4626, Morpho, UniV3)
│   │   ├── client.ts            # Viem public client singleton
│   │   └── format.ts            # Display formatting utils
│   └── services/
│       ├── tokens.ts            # Token balance + price fetching
│       ├── staking.ts           # Staking position fetching
│       └── yields.ts            # DefiLlama yields API
├── .env.example                 # Environment variables template
├── package.json
├── tsconfig.json
└── next.config.mjs
```

---

## What's Working

- **Token balances**: Native MON + all ERC-20s via Multicall3
- **Token prices**: DefiLlama API (free, no key)
- **Staking positions**: aPriori (aprMON) and FastLane (shMON) via ERC-4626 reads
- **Staking APYs**: DefiLlama Yields API with fallback values
- **UI**: Full dashboard with tabs, stat cards, token table, staking cards

## What Needs Wiring Up

These are scaffolded and ready — you just need the real contract addresses from
[monad-crypto/protocols](https://github.com/monad-crypto/protocols):

1. **LP Positions** — `src/lib/abis.ts` has `UNI_V3_NFT_ABI`. Add the Uniswap V3
   PositionManager address to `src/config/protocols.ts`
2. **Lending** — `src/lib/abis.ts` has `MORPHO_ABI` and `EULER_VAULT_ABI`. Add
   contract addresses to `src/config/protocols.ts`
3. **Yield Vaults** — Uses standard ERC-4626 pattern. Add Upshift vault addresses
4. **Transaction History** — Add BlockVision API integration
5. **Portfolio Chart** — Add 30-day value history (requires historical price data)

---

## Tech Stack

| Layer          | Tool                         |
|----------------|------------------------------|
| Framework      | Next.js 15 (App Router)      |
| Language       | TypeScript                   |
| Styling        | Tailwind CSS v4              |
| Chain SDK      | viem                         |
| Data fetching  | @tanstack/react-query        |
| Price data     | DefiLlama (free, no key)     |
| APY data       | DefiLlama Yields (free)      |
| RPC            | Monad public endpoints       |

---

## Configuration

### RPC Endpoint

The default uses a public endpoint (rate-limited). For production:

1. Get a paid key from [Alchemy](https://www.alchemy.com/), [QuickNode](https://www.quicknode.com/), or [Chainstack](https://chainstack.com/)
2. Set `NEXT_PUBLIC_MONAD_RPC_URL` in `.env.local`

### Adding New Tokens

Edit `src/config/tokens.ts` — add the contract address, symbol, decimals, and category.

### Adding New Protocols

Edit `src/config/protocols.ts` — add staking protocols, lending markets, or yield vaults.
Then create a corresponding service in `src/services/`.

---

## Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel (recommended)
npx vercel

# Or deploy to any Node.js host
npm start
```

---

## Claude Code Tips

When working on this in Claude Code, useful commands:

```
# "Add Kintsu staking to the protocol registry and staking service"
# "Wire up Uniswap V3 LP position reading using the UNI_V3_NFT_ABI"
# "Add a portfolio value chart component using the history data"
# "Fetch transaction history from BlockVision API"
# "Add wallet connect via wagmi instead of manual address input"
```

The codebase is structured so each feature is self-contained:
- **Config** → addresses and protocol metadata
- **ABIs** → contract interfaces
- **Services** → data fetching logic
- **Hooks** → React Query wrappers
- **Components** → UI rendering

---

*MonFolio — Built for the Monad community.*
