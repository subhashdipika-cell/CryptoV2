# CryptoV2 Autonomous Trading AI

A testnet-only autonomous crypto-options bot with a durable worker, explainable signal engine, risk governance, audit journal, and supporting analytics cockpit.

## Run locally

On Windows, double-click `Start-CryptoV2.bat`. The launcher checks Node.js, installs missing dependencies, prevents duplicate servers, and opens the application at `http://127.0.0.1:3000`.

Or run it manually:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Included modules

- Autonomous Deribit Testnet worker evaluating completed 15-minute BTC/ETH candles
- Explainable EMA, RSI, momentum, breakout, and ATR regime scoring
- Long-call/long-put entries with maximum-premium, daily-trade, cooldown, position, stop-loss, and take-profit gates
- Persistent decision/execution journal and emergency halt control
- Executive market dashboard with bubble map and breadth metrics
- Intelligence leaderboard and composable multi-variable screener
- Automated pattern-scanner presentation with reusable detection primitives
- Cross-asset correlation matrix and normalized divergence view
- Live Deribit Testnet BTC/ETH option chains, OI, IV skew, Greeks, guarded single-leg tickets, native atomic combo builder, and payoff chart
- Strategy cockpit with risk and execution workflow
- Non-routable 6-hour swing research engine with completed-candle signals, next-bar execution, cost-aware replay, recent-half validation, and explicit promotion blockers
- Buffered 100 ms WebSocket client and Web Worker boundary
- Versioned market and paper-order endpoints with Zod validation
- Paper-only order ticket and fail-closed API schema
- Local MT5 bridge for verified DEMO account data, positions, ticks, candles, and guarded order validation

## Important boundary

The autonomous worker is hard-coded to Deribit Testnet and has no production URL or real-money route. It starts disabled and requires both `DERIBIT_AUTOBOT_TESTNET_ROUTING=true` and an explicit cockpit activation phrase. Strategy signals are not profitability evidence or financial advice. Validate in monitoring and Testnet forward testing before changing any policy.

## MT5 connection

`Start-CryptoV2.bat` starts a loopback-only Python bridge at `127.0.0.1:8765` and connects to `D:\MT5IntelliTrade\terminal64.exe` by default. The dashboard then refreshes MT5 balance, equity, floating P&L, margin, positions, pending orders, and closed-deal balance history every five seconds.

The bridge requires the official `MetaTrader5` Python package. The launcher creates `.venv` when a working Python runtime is available and installs the pinned package automatically. Override the terminal with `MT5_TERMINAL_PATH` when needed.

The Windows launcher deliberately enables `MT5_DEMO_ORDER_ROUTING=true` for this project. Submission still requires both MT5 `ACCOUNT_TRADE_MODE_DEMO` and a server name containing `demo`, terminal/account/expert permissions, fresh ticks, valid symbol volume steps, a mandatory stop loss, valid TP/SL direction, an idempotency UUID, and margin below the configured limit. The code has no real-account execution path. Set `MT5_DEMO_ORDER_ROUTING=false` before launching to return to validation-only mode.

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the production decomposition and API contracts.

## Swing research backtest

Run the read-only directional proxy backtest with:

```powershell
node scripts/run-swing-backtest.mjs --days=730 --summary
```

The strategy is deliberately separate from the autonomous worker and has no routing path. The committed report is visible on the Strategy page. It must clear sample, expectancy, profit-factor, and drawdown gates before Testnet forward testing can be considered; even a passing directional proxy would still require an option-premium replay including IV, delta, theta, spreads, and strike liquidity.

## Deribit Testnet options

The Options tab reads live public BTC and ETH options data exclusively from `test.deribit.com`. No API key is required for chains, expiries, bids/asks, OI, IV, or ticker Greeks.

Private account data and the Submit TESTNET buttons stay locked until a Deribit Testnet key is configured. Create `.env.local` beside `package.json` and add:

```dotenv
DERIBIT_TESTNET_CLIENT_ID=your_testnet_client_id
DERIBIT_TESTNET_CLIENT_SECRET=your_testnet_client_secret
DERIBIT_TESTNET_MAX_OPTION_AMOUNT=10
```

Restart `Start-CryptoV2.bat` after changing `.env.local`. The credentials remain server-side, `.env.local` is ignored by Git, the API base URL is hard-coded to Testnet, orders are limit-only, instruments are revalidated before routing, and every submission requires a fresh TESTNET acknowledgement. Preview never creates a combo or sends an order. Multi-leg submissions use Deribit's native option combo route so the legs are sent atomically.
