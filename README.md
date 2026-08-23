# Krypto Terminal

A dark, high-density cryptocurrency analytics terminal inspired by professional derivatives workstations. The current release is a runnable frontend and API vertical slice with deterministic market data. Exchange order routing is deliberately restricted to `PAPER` mode.

## Run locally

On Windows, double-click `Start-CryptoV2.bat`. The launcher checks Node.js, installs missing dependencies, prevents duplicate servers, and opens the application at `http://127.0.0.1:3000`.

Or run it manually:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Included modules

- Executive market dashboard with bubble map and breadth metrics
- Intelligence leaderboard and composable multi-variable screener
- Automated pattern-scanner presentation with reusable detection primitives
- Cross-asset correlation matrix and normalized divergence view
- Options OI, IV skew, four-leg strategy builder, and payoff chart
- Strategy cockpit with risk and execution workflow
- Buffered 100 ms WebSocket client and Web Worker boundary
- Versioned market and paper-order endpoints with Zod validation
- Paper-only order ticket and fail-closed API schema
- Local MT5 bridge for verified DEMO account data, positions, ticks, candles, and guarded order validation

## Important boundary

All displayed prices, scores, patterns, simulations, and performance values are illustrative deterministic data. They are not profitability evidence or financial advice. Live exchange execution is not implemented and the order schema rejects any execution mode other than `PAPER`.

## MT5 connection

`Start-CryptoV2.bat` starts a loopback-only Python bridge at `127.0.0.1:8765` and connects to `D:\MT5IntelliTrade\terminal64.exe` by default. The dashboard then refreshes MT5 balance, equity, floating P&L, margin, positions, pending orders, and closed-deal balance history every five seconds.

The bridge requires the official `MetaTrader5` Python package. The launcher creates `.venv` when a working Python runtime is available and installs the pinned package automatically. Override the terminal with `MT5_TERMINAL_PATH` when needed.

The Windows launcher deliberately enables `MT5_DEMO_ORDER_ROUTING=true` for this project. Submission still requires both MT5 `ACCOUNT_TRADE_MODE_DEMO` and a server name containing `demo`, terminal/account/expert permissions, fresh ticks, valid symbol volume steps, a mandatory stop loss, valid TP/SL direction, an idempotency UUID, and margin below the configured limit. The code has no real-account execution path. Set `MT5_DEMO_ORDER_ROUTING=false` before launching to return to validation-only mode.

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the production decomposition and API contracts.
