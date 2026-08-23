import unittest
from types import SimpleNamespace

import MetaTrader5 as mt5

from server import MT5Gateway


class DemoAccountSafetyTests(unittest.TestCase):
    def test_requires_demo_enum_and_demo_server(self) -> None:
        account = SimpleNamespace(trade_mode=mt5.ACCOUNT_TRADE_MODE_DEMO, server="VantageMarkets-Demo")
        self.assertTrue(MT5Gateway.is_demo(account))

    def test_rejects_real_server_even_with_demo_enum(self) -> None:
        account = SimpleNamespace(trade_mode=mt5.ACCOUNT_TRADE_MODE_DEMO, server="Broker-Live")
        self.assertFalse(MT5Gateway.is_demo(account))

    def test_rejects_real_enum_even_with_demo_server_name(self) -> None:
        account = SimpleNamespace(trade_mode=mt5.ACCOUNT_TRADE_MODE_REAL, server="Broker-Demo")
        self.assertFalse(MT5Gateway.is_demo(account))


if __name__ == "__main__":
    unittest.main()
