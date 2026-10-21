# Ascend — launchpad frontend

React + Vite + Tailwind frontend for the bonding-curve launchpad, with wallet
connect via RainbowKit/wagmi/viem. Ships with mock data so every screen is
browsable before the indexer/backend exists.

## Pages

- `/` — Explore: token grid, sort/filter/search (sidebar on desktop, bottom tabs on mobile)
- `/launch` — Launch token form with a live preview card
- `/token/:symbol` — Trading page: chart, buy/sell panel, recent trades, holders
- `/forum`, `/analytics`, `/portfolio` — stubs, ready for wiring once the backend exists

## Setup

```bash
npm install
cp .env.example .env
# put a WalletConnect Cloud project id in .env (free, from cloud.walletconnect.com)
npm run dev
```

## Wiring this up to the real contracts

Everything in `src/data/mockData.js` is fake data generated deterministically
client-side — swap it for real API calls to your indexer once it's running
(see the architecture plan from earlier in this project).

1. **Deploy `LaunchpadFactory.sol`**, then fill in its address per chain in
   `src/config/contracts.js` → `LAUNCHPAD_FACTORY_ADDRESS`.
2. **`LaunchPage.jsx`** already calls `factory.launch()` via `useWriteContract`
   once an address is set — replace the placeholder pair-token address in the
   `submit()` function with the real WETH/USDC address for the selected chain.
3. **`TradePanel.jsx`** already reads `quoteBuy`/`quoteSell` and calls
   `buy`/`sell` on `token.curveAddress` via wagmi. Right now `curveAddress` is
   a fake mock address, so those calls fail and the panel silently falls back
   to a rough local price estimate (see `usingFallback` in that file) so the
   UI still feels alive. Once tokens come from your real indexer with real
   curve addresses, the fallback stops triggering automatically.
4. **Approvals**: for ERC20-paired tokens (e.g. USDC), `buy()` needs an
   `approve()` first. Add an allowance check + approve step in `TradePanel`
   before calling `writeContract` for `buy` — not included yet since the
   pair token in the mock data isn't a real deployed ERC20.
5. **Chart data**: `PriceChart.jsx` reads `token.priceHistory` — point this at
   your `/api/tokens/:curveAddress/candles` endpoint instead.
6. **Explore sorting**: `ExplorePage.jsx` sorts the in-memory mock array —
   swap for `GET /api/tokens?sort=...&range=...&version=...` from the
   indexer's `token_stats` table.

## Stack

- React 18 + Vite 5 + React Router 6
- Tailwind CSS 3 (design tokens in `tailwind.config.js`)
- wagmi 2 + viem 2 + RainbowKit 2
- Recharts for the price chart
- lucide-react for icons

## Notes

- No `localStorage`/`sessionStorage` used anywhere — wallet session persistence
  is handled by wagmi's own connectors.
- Chains configured in `src/config/wagmi.js`: Base, Base Sepolia, Ethereum
  mainnet. Add/remove chains there.
- Package versions in `package.json` were current as of early 2026 — run
  `npm outdated` after cloning and bump anything that's since moved,
  especially `@rainbow-me/rainbowkit` and `wagmi`, which ship frequently.
