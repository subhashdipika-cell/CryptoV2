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
- Read-only Deribit Testnet option snapshot archive for real bid/ask, IV, OI, Greeks, and liquidity replay evidence
- Guarded autonomous options allocator for iron condors, event/squeeze straddles, and directional debit spreads using atomic Testnet combo books
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
node scripts/run-regime-walkforward.mjs --days=730 --summary
```

The strategy is deliberately separate from the autonomous worker and has no routing path. The committed report is visible on the Strategy page. It must clear sample, expectancy, profit-factor, and drawdown gates before Testnet forward testing can be considered; even a passing directional proxy would still require an option-premium replay including IV, delta, theta, spreads, and strike liquidity.

The regime walk-forward report selects from 24 predeclared policies using only the prior 365-day training window, then evaluates the selected policy on the following 91 days. Its options proxy reprices ATM 45-DTE contracts using rolling realized-volatility IV, Black-Scholes theta decay, modeled bid/ask spreads, a liquidity gate, and Deribit's standard option fee cap. Because historical expired-option books and mark-IV surfaces were not recorded, this remains model evidence and cannot authorize routing.

### Read-only option snapshot archive

`Start-CryptoV2.bat` also starts a hidden, supervised market-data recorder. Every five minutes it samples paired calls and puts around the BTC and ETH at-the-money strikes for the two nearest expiries between 7 and 60 days. It records actual Testnet bid/ask prices and sizes, marks, IV, open interest, volume, interest rates, and ticker Greeks under `work\option-snapshots\YYYY-MM-DD.jsonl`.

The recorder calls public Deribit Testnet methods only. It never reads credentials and has no private API or order-routing method. Runtime health and archive coverage are available at `GET /api/v1/autobot/option-snapshots` and on the Strategy page. Set `DERIBIT_OPTION_SNAPSHOT_INTERVAL_MS` to change the interval; values below 60 seconds are rejected.

## Autonomous options strategy allocator

The Autonomous Bot page contains six selectable strategy families. The original Trend–Momentum strategy remains the only enabled strategy after upgrade, so installing this code does not silently change the running portfolio. Pause new entries before changing the enabled set, save the policy, and explicitly re-arm Deribit Testnet.

- `IRON_CONDOR` selects approximately 0.15–0.20 delta short wings, buys farther wings, requires a range regime and IV percentile of at least 70, caps projected loss, takes 50% of maximum profit, and exits on a short-strike breach.
- `LONG_STRADDLE` buys the ATM call and put only for an authenticated scheduled event or low-IV squeeze. It manages both legs with a portfolio-level trailing exit and time stop.
- `VERTICAL_DEBIT_SPREAD` buys an approximately 0.50-delta option and sells an approximately 0.30-delta option in the confirmed direction, targeting 80% of modeled maximum profit.
- `SHORT_STRADDLE_HEDGED` and `COLLATERAL_CALL` are implemented as live planners but intentionally monitor-only. Naked short volatility cannot route until an independently reconciled perpetual hedge executor exists. Deribit options are cash-settled, so a conventional physically covered call cannot be proven from a coin balance.

All routable multi-leg entries use a Deribit combo book and fill-or-kill order, and are preceded by fresh-data, IV-history, delta, spread, open-interest, maximum-loss, daily-cap, cooldown, position, open-order, and portfolio-margin gates. The default archive requirement is 288 prior observations (about 24 hours at five-minute cadence). This evidence requirement is availability gating, not profitability evidence.

### Authenticated event webhook

Set a high-entropy `CRYPTOV2_EVENT_WEBHOOK_SECRET` in `.env.local`, restart the application, and submit high-impact future events to `POST /api/v1/autobot/events` with that value in the `x-cryptov2-event-secret` header. Events must start in the future, be no more than 30 days away, identify BTC and/or ETH, and include an expiry after the start. Without the server-side secret, event submission and event-driven entries stay unavailable.

## Deribit Testnet options

The Options tab reads live public BTC and ETH options data exclusively from `test.deribit.com`. No API key is required for chains, expiries, bids/asks, OI, IV, or ticker Greeks.

Private account data and the Submit TESTNET buttons stay locked until a Deribit Testnet key is configured. Create `.env.local` beside `package.json` and add:

```dotenv
DERIBIT_TESTNET_CLIENT_ID=your_testnet_client_id
DERIBIT_TESTNET_CLIENT_SECRET=your_testnet_client_secret
DERIBIT_TESTNET_MAX_OPTION_AMOUNT=10
```

Restart `Start-CryptoV2.bat` after changing `.env.local`. The credentials remain server-side, `.env.local` is ignored by Git, the API base URL is hard-coded to Testnet, orders are limit-only, instruments are revalidated before routing, and every submission requires a fresh TESTNET acknowledgement. Preview never creates a combo or sends an order. Multi-leg submissions use Deribit's native option combo route so the legs are sent atomically.
