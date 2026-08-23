"""Loopback-only MetaTrader 5 bridge for CryptoV2.

The bridge exposes read APIs by default. Demo order routing is available only when
MT5_DEMO_ORDER_ROUTING=true and both the MT5 trade-mode enum and server name prove
that the connected account is a demo account. Real-account routing is not present.
"""

from __future__ import annotations

import json
import math
import os
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import MetaTrader5 as mt5


HOST = "127.0.0.1"
PORT = int(os.environ.get("MT5_BRIDGE_PORT", "8765"))
DEFAULT_TERMINAL = r"D:\MT5IntelliTrade\terminal64.exe"
TERMINAL_PATH = str(Path(os.environ.get("MT5_TERMINAL_PATH", DEFAULT_TERMINAL)).resolve())
DEMO_ROUTING_ENABLED = os.environ.get("MT5_DEMO_ORDER_ROUTING", "false").lower() == "true"
MAX_MARGIN_FRACTION = float(os.environ.get("MT5_MAX_MARGIN_FRACTION", "0.10"))
MAGIC = int(os.environ.get("MT5_MAGIC", "260823"))
COMMENT = "CryptoV2-DEMO"


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    if hasattr(value, "_asdict"):
        return {key: json_safe(item) for key, item in value._asdict().items()}
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if hasattr(value, "item"):
        return json_safe(value.item())
    return str(value)


class BridgeError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400, details: Any = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.details = details


class MT5Gateway:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.started_at = time.time()
        self.idempotency: dict[str, dict[str, Any]] = {}

    def ensure_connected(self) -> tuple[Any, Any]:
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        if terminal is None or account is None or not terminal.connected:
            mt5.shutdown()
            if not Path(TERMINAL_PATH).is_file():
                raise BridgeError("TERMINAL_NOT_FOUND", f"MT5 terminal not found: {TERMINAL_PATH}", 503)
            if not mt5.initialize(path=TERMINAL_PATH, timeout=15_000):
                raise BridgeError("MT5_INITIALIZE_FAILED", "Unable to initialize MT5", 503, mt5.last_error())
            terminal = mt5.terminal_info()
            account = mt5.account_info()
        if terminal is None or account is None:
            raise BridgeError("MT5_ACCOUNT_UNAVAILABLE", "MT5 account information is unavailable", 503, mt5.last_error())
        return terminal, account

    @staticmethod
    def is_demo(account: Any) -> bool:
        return account.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO and "demo" in account.server.lower()

    def health(self) -> dict[str, Any]:
        with self.lock:
            terminal, account = self.ensure_connected()
            demo = self.is_demo(account)
            return {
                "status": "connected" if terminal.connected else "disconnected",
                "bridge": {"uptimeSeconds": round(time.time() - self.started_at), "version": "1.0.0"},
                "terminal": {
                    "path": TERMINAL_PATH,
                    "connected": bool(terminal.connected),
                    "tradeAllowed": bool(terminal.trade_allowed),
                    "build": terminal.build,
                    "company": terminal.company,
                },
                "account": {
                    "loginMasked": f"***{str(account.login)[-4:]}",
                    "server": account.server,
                    "company": account.company,
                    "tradeMode": account.trade_mode,
                    "mode": "DEMO" if demo else "REAL_OR_CONTEST",
                    "tradeAllowed": bool(account.trade_allowed),
                    "expertAllowed": bool(account.trade_expert),
                },
                "safety": {
                    "demoVerified": demo,
                    "demoOrderRoutingEnabled": DEMO_ROUTING_ENABLED and demo,
                    "realOrderRoutingAvailable": False,
                },
                "asOf": datetime.now(timezone.utc).isoformat(),
            }

    def snapshot(self, days: int = 30) -> dict[str, Any]:
        days = max(1, min(days, 365))
        with self.lock:
            terminal, account = self.ensure_connected()
            positions = mt5.positions_get()
            orders = mt5.orders_get()
            if positions is None:
                raise BridgeError("POSITIONS_UNAVAILABLE", "MT5 positions are unavailable", 503, mt5.last_error())
            if orders is None:
                orders = []
            return {
                "connection": self.health(),
                "account": {
                    "currency": account.currency,
                    "balance": account.balance,
                    "equity": account.equity,
                    "profit": account.profit,
                    "credit": account.credit,
                    "margin": account.margin,
                    "marginFree": account.margin_free,
                    "marginLevel": account.margin_level,
                    "leverage": account.leverage,
                },
                "positions": [self.position_to_json(position) for position in positions],
                "orders": [self.order_to_json(order) for order in orders],
                "equityCurve": self.equity_curve(account.balance, days),
                "asOf": datetime.now(timezone.utc).isoformat(),
            }

    @staticmethod
    def position_to_json(position: Any) -> dict[str, Any]:
        return {
            "ticket": str(position.ticket),
            "symbol": position.symbol,
            "side": "BUY" if position.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": position.volume,
            "priceOpen": position.price_open,
            "priceCurrent": position.price_current,
            "stopLoss": position.sl,
            "takeProfit": position.tp,
            "profit": position.profit,
            "swap": position.swap,
            "magic": position.magic,
            "comment": position.comment,
            "openedAt": datetime.fromtimestamp(position.time, timezone.utc).isoformat(),
        }

    @staticmethod
    def order_to_json(order: Any) -> dict[str, Any]:
        return {
            "ticket": str(order.ticket),
            "symbol": order.symbol,
            "type": order.type,
            "volumeInitial": order.volume_initial,
            "volumeCurrent": order.volume_current,
            "priceOpen": order.price_open,
            "stopLoss": order.sl,
            "takeProfit": order.tp,
            "comment": order.comment,
        }

    @staticmethod
    def equity_curve(current_balance: float, days: int) -> list[dict[str, Any]]:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        deals = mt5.history_deals_get(start, end)
        if deals is None:
            return []
        exits = [
            deal for deal in deals
            if deal.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT, mt5.DEAL_ENTRY_OUT_BY)
        ]
        changes = [float(deal.profit + deal.commission + deal.swap + deal.fee) for deal in exits]
        running = float(current_balance) - sum(changes)
        curve = [{"time": start.isoformat(), "equity": round(running, 2)}]
        for deal, change in zip(exits, changes):
            running += change
            curve.append({"time": datetime.fromtimestamp(deal.time, timezone.utc).isoformat(), "equity": round(running, 2)})
        curve.append({"time": end.isoformat(), "equity": round(float(current_balance), 2)})
        return curve

    def symbols(self, query: str = "", limit: int = 100) -> list[dict[str, Any]]:
        with self.lock:
            self.ensure_connected()
            values = mt5.symbols_get()
            if values is None:
                raise BridgeError("SYMBOLS_UNAVAILABLE", "MT5 symbols are unavailable", 503, mt5.last_error())
            needle = query.upper().strip()
            result = []
            for symbol in values:
                if needle and needle not in symbol.name.upper() and needle not in symbol.description.upper():
                    continue
                result.append({
                    "symbol": symbol.name,
                    "description": symbol.description,
                    "path": symbol.path,
                    "visible": bool(symbol.visible),
                    "tradeMode": symbol.trade_mode,
                    "digits": symbol.digits,
                    "volumeMin": symbol.volume_min,
                    "volumeMax": symbol.volume_max,
                    "volumeStep": symbol.volume_step,
                })
                if len(result) >= max(1, min(limit, 500)):
                    break
            return result

    def resolve_symbol(self, requested: str) -> str:
        exact = mt5.symbol_info(requested)
        if exact is not None:
            return exact.name
        normalized = requested.upper().replace("/", "").replace("USDT", "USD")
        candidates = self.symbols(normalized, 30)
        preferred = [item["symbol"] for item in candidates if item["symbol"].upper() == normalized]
        if preferred:
            return preferred[0]
        starts = [item["symbol"] for item in candidates if item["symbol"].upper().startswith(normalized)]
        if starts:
            return starts[0]
        raise BridgeError("SYMBOL_NOT_FOUND", f"No MT5 symbol matches {requested}", 404)

    def tick(self, requested: str) -> dict[str, Any]:
        with self.lock:
            self.ensure_connected()
            symbol = self.resolve_symbol(requested)
            if not mt5.symbol_select(symbol, True):
                raise BridgeError("SYMBOL_SELECT_FAILED", f"Unable to select {symbol}", 503, mt5.last_error())
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                raise BridgeError("TICK_UNAVAILABLE", f"No tick is available for {symbol}", 503, mt5.last_error())
            return {"symbol": symbol, "bid": tick.bid, "ask": tick.ask, "last": tick.last, "volume": tick.volume_real, "time": datetime.fromtimestamp(tick.time, timezone.utc).isoformat()}

    def rates(self, requested: str, timeframe: str, count: int) -> dict[str, Any]:
        frames = {
            "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
        }
        if timeframe not in frames:
            raise BridgeError("INVALID_TIMEFRAME", f"Unsupported timeframe: {timeframe}")
        with self.lock:
            self.ensure_connected()
            symbol = self.resolve_symbol(requested)
            mt5.symbol_select(symbol, True)
            values = mt5.copy_rates_from_pos(symbol, frames[timeframe], 0, max(1, min(count, 2000)))
            if values is None:
                raise BridgeError("RATES_UNAVAILABLE", f"Rates unavailable for {symbol}", 503, mt5.last_error())
            return {"symbol": symbol, "timeframe": timeframe, "bars": [
                {"time": datetime.fromtimestamp(int(row["time"]), timezone.utc).isoformat(), "open": row["open"], "high": row["high"], "low": row["low"], "close": row["close"], "tickVolume": int(row["tick_volume"]), "spread": int(row["spread"]), "realVolume": int(row["real_volume"])}
                for row in values
            ]}

    def order(self, payload: dict[str, Any], execute: bool) -> dict[str, Any]:
        with self.lock:
            terminal, account = self.ensure_connected()
            if not self.is_demo(account):
                raise BridgeError("REAL_ACCOUNT_LOCKED", "Order routing is permanently unavailable for non-demo accounts", 403)
            if execute and not DEMO_ROUTING_ENABLED:
                raise BridgeError("DEMO_ROUTING_DISABLED", "Set MT5_DEMO_ORDER_ROUTING=true to enable demo orders", 403)
            if not terminal.trade_allowed or not account.trade_allowed or not account.trade_expert:
                raise BridgeError("MT5_TRADING_DISABLED", "MT5 terminal/account trading permissions are disabled", 403)
            key = str(payload.get("idempotencyKey", ""))
            try:
                uuid.UUID(key)
            except ValueError as error:
                raise BridgeError("INVALID_IDEMPOTENCY_KEY", "A UUID idempotencyKey is required") from error
            if execute and key in self.idempotency:
                return self.idempotency[key]
            side = str(payload.get("side", "")).upper()
            order_type = str(payload.get("type", "MARKET")).upper()
            volume = float(payload.get("volume", 0))
            stop_loss = float(payload.get("stopLoss", 0))
            take_profit = float(payload.get("takeProfit", 0) or 0)
            if side not in ("BUY", "SELL") or order_type not in ("MARKET", "LIMIT"):
                raise BridgeError("INVALID_ORDER", "side must be BUY/SELL and type must be MARKET/LIMIT")
            if stop_loss <= 0:
                raise BridgeError("STOP_LOSS_REQUIRED", "A positive stop loss is required")
            symbol = self.resolve_symbol(str(payload.get("symbol", "")))
            info = mt5.symbol_info(symbol)
            if info is None or not mt5.symbol_select(symbol, True):
                raise BridgeError("SYMBOL_UNAVAILABLE", f"MT5 symbol is unavailable: {symbol}", 503)
            tick = mt5.symbol_info_tick(symbol)
            if tick is None or time.time() - tick.time > 30:
                raise BridgeError("STALE_TICK", f"A fresh MT5 tick is required for {symbol}", 503)
            steps = round(volume / info.volume_step) if info.volume_step else 0
            normalized_volume = steps * info.volume_step
            if volume <= 0 or volume < info.volume_min or volume > info.volume_max or abs(normalized_volume - volume) > 1e-9:
                raise BridgeError("INVALID_VOLUME", f"Volume must be {info.volume_min} to {info.volume_max} in steps of {info.volume_step}")
            market_price = tick.ask if side == "BUY" else tick.bid
            requested_price = float(payload.get("limitPrice", 0) or 0)
            price = market_price if order_type == "MARKET" else requested_price
            if price <= 0:
                raise BridgeError("LIMIT_PRICE_REQUIRED", "A positive limit price is required")
            if side == "BUY" and stop_loss >= price or side == "SELL" and stop_loss <= price:
                raise BridgeError("INVALID_STOP_LOSS", "Stop loss is on the wrong side of the order price")
            if take_profit and (side == "BUY" and take_profit <= price or side == "SELL" and take_profit >= price):
                raise BridgeError("INVALID_TAKE_PROFIT", "Take profit is on the wrong side of the order price")
            mt5_type = (
                mt5.ORDER_TYPE_BUY if side == "BUY" and order_type == "MARKET" else
                mt5.ORDER_TYPE_SELL if side == "SELL" and order_type == "MARKET" else
                mt5.ORDER_TYPE_BUY_LIMIT if side == "BUY" else mt5.ORDER_TYPE_SELL_LIMIT
            )
            margin = mt5.order_calc_margin(mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL, symbol, volume, price)
            if margin is None:
                raise BridgeError("MARGIN_UNAVAILABLE", "MT5 could not calculate order margin", 503, mt5.last_error())
            margin_limit = account.margin_free * MAX_MARGIN_FRACTION
            if margin > margin_limit:
                raise BridgeError("MARGIN_LIMIT", f"Required margin {margin:.2f} exceeds demo risk limit {margin_limit:.2f}", 403)
            request = {
                "action": mt5.TRADE_ACTION_DEAL if order_type == "MARKET" else mt5.TRADE_ACTION_PENDING,
                "symbol": symbol,
                "volume": volume,
                "type": mt5_type,
                "price": price,
                "sl": stop_loss,
                "tp": take_profit,
                "deviation": 20,
                "magic": MAGIC,
                "comment": COMMENT,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            check = mt5.order_check(request)
            if check is None:
                raise BridgeError("ORDER_CHECK_FAILED", "MT5 order validation failed", 422, mt5.last_error())
            preview = {"status": "VALIDATED" if check.retcode == 0 else "REJECTED", "symbol": symbol, "margin": margin, "marginLimit": margin_limit, "check": json_safe(check)}
            if not execute:
                return preview
            if check.retcode != 0:
                raise BridgeError("ORDER_CHECK_REJECTED", check.comment, 422, json_safe(check))
            result = mt5.order_send(request)
            if result is None:
                raise BridgeError("ORDER_SEND_FAILED", "MT5 returned no order result", 502, mt5.last_error())
            response = {"status": "ACCEPTED" if result.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED, mt5.TRADE_RETCODE_DONE_PARTIAL) else "REJECTED", "demo": True, "result": json_safe(result)}
            self.idempotency[key] = response
            return response


gateway = MT5Gateway()


class Handler(BaseHTTPRequestHandler):
    server_version = "CryptoV2-MT5/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write(f"{self.log_date_time_string()} {fmt % args}\n")
        sys.stdout.flush()

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(json_safe(payload), separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self) -> tuple[int, Any]:
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if self.command == "GET" and parsed.path == "/health":
            return 200, gateway.health()
        if self.command == "GET" and parsed.path == "/snapshot":
            return 200, gateway.snapshot(int(query.get("days", ["30"])[0]))
        if self.command == "GET" and parsed.path == "/symbols":
            return 200, {"symbols": gateway.symbols(query.get("query", [""])[0], int(query.get("limit", ["100"])[0]))}
        if self.command == "GET" and parsed.path == "/tick":
            return 200, gateway.tick(query.get("symbol", [""])[0])
        if self.command == "GET" and parsed.path == "/rates":
            return 200, gateway.rates(query.get("symbol", [""])[0], query.get("timeframe", ["H1"])[0].upper(), int(query.get("count", ["300"])[0]))
        if self.command == "POST" and parsed.path in ("/orders/preview", "/orders"):
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 32_768:
                raise BridgeError("INVALID_BODY", "A JSON body is required")
            payload = json.loads(self.rfile.read(length))
            return 200 if parsed.path.endswith("preview") else 202, gateway.order(payload, execute=parsed.path == "/orders")
        raise BridgeError("NOT_FOUND", "Endpoint not found", 404)

    def do_GET(self) -> None:  # noqa: N802
        self.handle_request()

    def do_POST(self) -> None:  # noqa: N802
        self.handle_request()

    def handle_request(self) -> None:
        try:
            status, payload = self.dispatch()
            self.send_json(status, {"data": payload})
        except BridgeError as error:
            self.send_json(error.status, {"error": error.code, "message": str(error), "details": error.details})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": "INVALID_REQUEST", "message": str(error)})
        except Exception as error:  # pragma: no cover - last-resort process boundary
            self.send_json(500, {"error": "INTERNAL_ERROR", "message": str(error)})


def shutdown(*_: Any) -> None:
    mt5.shutdown()
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(json.dumps({"event": "bridge_started", "host": HOST, "port": PORT, "terminal": TERMINAL_PATH, "demoOrderRoutingEnabled": DEMO_ROUTING_ENABLED}))
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        mt5.shutdown()
