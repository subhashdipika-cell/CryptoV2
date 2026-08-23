# Krypto Terminal Architecture

## 1. Runtime topology

```text
Exchange WS/REST ──> Feed adapters ──> Redis Streams ──> Market gateway (WS)
                                              │                  │
                                              ├──> ClickHouse    └──> Browser worker (100 ms frames)
                                              └──> Signal workers          │
                                                                         Zustand
Auth/API ──> PostgreSQL <── Strategy/Backtest service <── Historical bars     │
    │                                                                      React UI
    └──> KMS-backed API-key vault ──> PAPER execution adapters
```

This repository implements the browser application, reusable analytics primitives, and a Next.js BFF slice. At production scale, feed ingestion, pattern scanning, backtesting, and execution should run as isolated services so a slow analytical workload cannot delay risk checks or order acknowledgements.

## 2. Suggested modular repository

```text
apps/
  web/                 Next.js UI and BFF
services/
  feed-gateway/        Go exchange adapters, normalized ticks, sequence repair
  intelligence/        Python/FastAPI scoring and feature calculation
  pattern-scanner/     Python distributed chart scanning
  execution/           Go paper/testnet adapters and hard risk gateway
  backtest/            Python event-driven futures/options simulator
packages/
  contracts/           Versioned Protobuf/JSON Schema and generated clients
  quant-core/          Indicators, payoff, correlations and cost model
  ui/                  Shared visual primitives
infra/
  postgres/ redis/ clickhouse/ observability/
```

## 3. Data contracts

### WebSocket tick

```json
{"type":"tick","exchange":"binance","symbol":"BTCUSDT","price":114382.4,"size":0.08,"side":"buy","ts":1787477100000,"sequence":918244}
```

Ticks must be validated, sequence checked, and reduced to the most recent update per symbol in a Web Worker. React receives frames every 100 ms rather than every exchange message. Slow consumers drop superseded ticks, never the latest state.

### Create paper order

`POST /api/v1/orders`

```json
{
  "idempotencyKey":"8f9c2888-cc47-4bc9-b472-0151867be486",
  "executionMode":"PAPER",
  "exchange":"binance",
  "symbol":"BTCUSDT",
  "side":"BUY",
  "type":"LIMIT",
  "quantity":0.01,
  "limitPrice":113900,
  "leverage":2,
  "takeProfit":120000,
  "stopLoss":110000,
  "reduceOnly":false
}
```

The schema accepts only `PAPER`, requires an idempotency key and stop loss, caps leverage at 10×, and requires a price for limit orders. A production risk gateway must additionally verify account mode from the exchange, mark-price freshness, maximum daily loss, exposure, margin, tick/step sizes, liquidation distance, and kill-switch state before routing.

### Market snapshot

`GET /api/v1/markets` returns normalized market state plus composite intelligence score. Pagination, stable cursors, and `ETag` support should be added when backed by the full market universe.

## 4. Pattern recognition

The reference implementation in `src/lib/pattern-engine.ts` uses:

1. Local extrema extraction with a configurable pivot radius.
2. Least-squares support/resistance fitting and R² quality.
3. Geometry classification from slope direction and tolerance.
4. Confirmation requirements for breakout close, volume expansion, and retest.
5. Target projection from formation height and stop placement beyond invalidation.

Production detection should use completed candles only, record the observation timestamp, avoid look-ahead in pivot confirmation, and replay with the same cadence and transaction-cost model used in forward operation.

## 5. Storage

- PostgreSQL: users, encrypted credential envelopes, strategies, immutable order intentions, audit events.
- ClickHouse: raw trades, order-book deltas, funding, OI, liquidations, OHLCV aggregates.
- Redis: latest market state, pub/sub fanout, rate-limit counters, job queues.
- Object storage: backtest artifacts and model versions.

Secrets should use envelope encryption: a per-credential data key encrypted by KMS/HSM, never browser-visible, logged, or stored in plaintext.

## 6. Authentication and authorization

Use short-lived access tokens in secure HTTP-only cookies, rotating refresh sessions, Argon2id password hashes, MFA for execution access, CSRF protection, and scoped exchange connections. Keep analytics, strategy editing, and execution permissions separate. Audit every credential read and order-state transition.

## 7. Production milestones

1. Connect one read-only exchange feed and validate gap recovery.
2. Persist normalized ticks/bars and reconcile against exchange REST snapshots.
3. Run scanner and intelligence services in shadow mode with data-quality dashboards.
4. Enable paper execution with deterministic fills, fees, funding, slippage, and reconciliation.
5. Add exchange testnet routing behind explicit per-account approval and hard risk limits.
6. Consider live routing only after independent security review and sustained reconciliation evidence.
