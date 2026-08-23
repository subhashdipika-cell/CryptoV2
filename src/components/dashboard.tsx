"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Layers3,
  LockKeyhole,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Badge, Change } from "./ui";
import { cn } from "@/lib/utils";

const ranges = ["7D", "30D", "90D", "6M", "YTD", "ALL"] as const;
type Range = (typeof ranges)[number];

const rangeDays: Record<Range, number> = { "7D": 7, "30D": 30, "90D": 90, "6M": 180, YTD: 240, ALL: 365 };

const positions = [
  { symbol: "SOLUSDT", side: "LONG", exchange: "PAPER · Binance", size: "$1,250.00", entry: 168.42, mark: 176.44, pnl: 59.52, change: 4.76, strategy: "Momentum Reversal" },
  { symbol: "ETHUSDT", side: "SHORT", exchange: "PAPER · Bybit", size: "$820.00", entry: 3688.2, mark: 3641.82, pnl: 10.31, change: 1.26, strategy: "Funding Fade" },
];

const strategies = [
  { name: "Momentum Reversal", market: "SOLUSDT · 1H", trades: 18, pnl: 412.84, returnPct: 8.26 },
  { name: "Funding Fade", market: "ETHUSDT · 4H", trades: 11, pnl: 186.2, returnPct: 3.72 },
  { name: "Volatility Breakout", market: "BTCUSDT · 15M", trades: 24, pnl: -74.6, returnPct: -1.49 },
];

function createEquity(days: number) {
  return Array.from({ length: Math.min(days, 90) }, (_, index) => {
    const scale = days / Math.min(days, 90);
    const drift = index * 29 * scale;
    const cycle = Math.sin(index / 3.2) * 180 + Math.cos(index / 7.5) * 95;
    const drawdown = index > 48 && index < 60 ? -(index - 48) * 42 : index >= 60 ? -504 + (index - 60) * 28 : 0;
    return { day: index + 1, equity: Math.round((12500 + drift + cycle + drawdown) * 100) / 100 };
  });
}

export function PortfolioDashboard({ onOpenStrategy }: { onOpenStrategy: () => void }) {
  const [range, setRange] = useState<Range>("30D");
  const equity = useMemo(() => createEquity(rangeDays[range]), [range]);
  const startEquity = equity[0]?.equity ?? 12500;
  const currentEquity = equity.at(-1)?.equity ?? 13298.87;
  const pnl = currentEquity - startEquity;
  const pnlPct = (pnl / startEquity) * 100;

  return <div className="space-y-5">
    <section className="flex flex-col justify-between gap-5 border-b border-line/60 pb-5 xl:flex-row xl:items-end">
      <div>
        <div className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[.22em] text-mint">Portfolio overview · All paper exchanges</div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good evening, Subhash</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="pulse-dot size-1.5 rounded-full bg-mint"/>2 simulated feeds connected</span>
          <span>3 paper strategies</span><span>2 open positions</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-line bg-black/20 p-1">{ranges.map((item) => <button key={item} onClick={() => setRange(item)} className={cn("rounded px-3 py-1.5 font-mono text-[9px] transition", range === item ? "bg-white/[.09] text-white shadow" : "text-slate-600 hover:text-slate-300")}>{item}</button>)}</div>
        <button onClick={onOpenStrategy} className="flex items-center gap-2 rounded-md bg-mint px-4 py-2.5 text-[11px] font-bold text-black transition hover:bg-[#5bffd0]"><Plus className="size-3.5"/>New paper strategy</button>
      </div>
    </section>

    <section className="panel overflow-hidden rounded-lg">
      <div className="grid xl:grid-cols-[.86fr_1.25fr]">
        <div className="border-b border-line/60 p-5 sm:p-7 xl:border-b-0 xl:border-r">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><span className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-mint">Unrealized P&amp;L</span><Info className="size-3 text-slate-600"/></div>
            <div className="flex rounded border border-line bg-black/30 p-0.5"><button className="rounded bg-mint/[.12] px-2.5 py-1 font-mono text-[8px] font-semibold text-mint">PAPER</button><button disabled className="flex cursor-not-allowed items-center gap-1 px-2.5 py-1 font-mono text-[8px] text-slate-700"><LockKeyhole className="size-2.5"/>LIVE LOCKED</button></div>
          </div>
          <div className="number font-mono text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(2)}</div>
          <div className="mt-3 flex items-center gap-3"><Badge tone={pnlPct >= 0 ? "positive" : "negative"}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</Badge><span className="text-[10px] text-slate-600">vs starting equity · {range}</span></div>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line/60 pt-5">
            <AccountValue label="Running · paper" value={`$${pnl.toFixed(2)}`} tone={pnl >= 0 ? "text-mint" : "text-coral"}/>
            <AccountValue label="Available" value="$11,228.87"/>
            <AccountValue label="Equity" value={`$${currentEquity.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}/>
          </div>
        </div>
        <div className="relative min-h-[320px] bg-black/10 p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between"><div><div className="text-xs font-semibold">Paper equity curve</div><div className="mt-1 text-[9px] text-slate-600">Closed-trade equity · illustrative simulation</div></div><Badge tone="positive"><Radio className="mr-1 size-2.5"/>Updated</Badge></div>
          <div className="h-[235px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equity}><defs><linearGradient id="dashboardEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#23f7b6" stopOpacity=".24"/><stop offset="1" stopColor="#23f7b6" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="#1b242c" strokeDasharray="3 3"/><XAxis dataKey="day" tick={false} axisLine={false}/><YAxis domain={["dataMin - 250", "dataMax + 180"]} orientation="right" tickFormatter={(value) => `$${(value/1000).toFixed(1)}k`} stroke="#35404a" fontSize={9} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Paper equity"]} labelFormatter={(value) => `Observation ${value}`} contentStyle={{ background: "#0d1217", border: "1px solid #26313a", borderRadius: 6, fontSize: 10 }}/><ReferenceLine y={startEquity} stroke="#586572" strokeDasharray="4 4"/><Area type="monotone" dataKey="equity" stroke="#23f7b6" fill="url(#dashboardEquity)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
        </div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardMetric icon={Layers3} label="Open positions" value="2" meta="0 spot holdings"/>
      <DashboardMetric icon={WalletCards} label="Capital utilised" value="$2,070" meta="15.56% of equity"/>
      <DashboardMetric icon={Bot} label="Paper strategies" value="3" meta="2 evaluating now" positive/>
      <DashboardMetric icon={ShieldCheck} label="Healthy data feeds" value="2 / 2" meta="No sequence gaps" positive/>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
      <section className="panel overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4"><div><h3 className="text-sm font-semibold">Open paper positions</h3><div className="mt-1 text-[9px] text-slate-600">Mark-to-market simulation</div></div><Badge tone="positive">2 positions</Badge></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead><tr className="border-b border-line/50 font-mono text-[8px] uppercase tracking-wider text-slate-700"><th className="px-5 py-3 font-medium">Market</th><th className="py-3 font-medium">Side</th><th className="py-3 font-medium">Exchange</th><th className="py-3 font-medium">Notional</th><th className="py-3 font-medium">Entry</th><th className="py-3 font-medium">Mark</th><th className="py-3 font-medium">Unrealized</th><th className="pr-5 py-3 font-medium">Strategy</th></tr></thead><tbody>{positions.map((position) => <tr key={position.symbol} className="border-b border-line/40 last:border-0"><td className="px-5 py-4"><div className="text-xs font-semibold">{position.symbol}</div><div className="mt-0.5 font-mono text-[8px] text-slate-700">PERPETUAL</div></td><td><Badge tone={position.side === "LONG" ? "positive" : "negative"}>{position.side}</Badge></td><td className="text-[10px] text-slate-500">{position.exchange}</td><td className="font-mono text-[10px]">{position.size}</td><td className="font-mono text-[10px]">${position.entry.toLocaleString()}</td><td className="font-mono text-[10px]">${position.mark.toLocaleString()}</td><td><div className="font-mono text-[10px] text-mint">+${position.pnl.toFixed(2)}</div><div className="mt-0.5"><Change value={position.change}/></div></td><td className="pr-5 text-[10px] text-slate-500">{position.strategy}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4"><div><h3 className="text-sm font-semibold">Top strategies · {range}</h3><div className="mt-1 text-[9px] text-slate-600">Ranked by net simulated P&amp;L</div></div><button onClick={onOpenStrategy} className="flex items-center gap-1 text-[9px] text-mint">View cockpit <ArrowUpRight className="size-3"/></button></div>
        <div className="divide-y divide-line/40">{strategies.map((strategy, index) => <div key={strategy.name} className="flex items-center gap-3 px-5 py-4"><div className="grid size-7 shrink-0 place-items-center rounded border border-line bg-white/[.02] font-mono text-[9px] text-slate-500">0{index + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{strategy.name}</div><div className="mt-1 font-mono text-[8px] text-slate-700">{strategy.market} · {strategy.trades} trades</div></div><div className="text-right"><div className={cn("font-mono text-xs font-semibold", strategy.pnl >= 0 ? "text-mint" : "text-coral")}>{strategy.pnl >= 0 ? "+" : "−"}${Math.abs(strategy.pnl).toFixed(2)}</div><div className={cn("mt-1 font-mono text-[8px]", strategy.returnPct >= 0 ? "text-mint/70" : "text-coral/70")}>{strategy.returnPct >= 0 ? "+" : ""}{strategy.returnPct}%</div></div></div>)}</div>
      </section>
    </div>

    <section className="grid gap-3 md:grid-cols-3">
      <QuickInsight icon={Activity} label="Risk state" value="Within envelope" detail="0.50% maximum risk per position"/>
      <QuickInsight icon={CircleDollarSign} label="Funding next" value="02:14:38" detail="ETH funding estimate +0.0114%"/>
      <QuickInsight icon={Sparkles} label="Best opportunity" value="SOL momentum" detail="70% composite confidence · paper only"/>
    </section>
  </div>;
}

function AccountValue({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0"><div className="truncate font-mono text-[8px] uppercase tracking-wider text-slate-700">{label}</div><div className={cn("number mt-2 truncate font-mono text-xs font-semibold sm:text-sm", tone)}>{value}</div></div>;
}

function DashboardMetric({ icon: Icon, label, value, meta, positive }: { icon: typeof Layers3; label: string; value: string; meta: string; positive?: boolean }) {
  return <div className="panel rounded-lg p-4"><div className="mb-5 flex items-start justify-between"><span className="text-[10px] text-slate-500">{label}</span><Icon className={cn("size-4", positive ? "text-mint" : "text-slate-600")} strokeWidth={1.5}/></div><div className="flex items-end justify-between gap-2"><span className="number font-mono text-xl font-semibold">{value}</span><span className={cn("text-right font-mono text-[8px]", positive ? "text-mint" : "text-slate-700")}>{meta}</span></div></div>;
}

function QuickInsight({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-line/60 bg-white/[.012] p-4"><div className="grid size-9 shrink-0 place-items-center rounded-md border border-mint/10 bg-mint/[.04]"><Icon className="size-4 text-mint"/></div><div><div className="font-mono text-[8px] uppercase tracking-wider text-slate-700">{label}</div><div className="mt-1 text-xs font-semibold">{value}</div><div className="mt-0.5 text-[9px] text-slate-600">{detail}</div></div><CheckCircle2 className="ml-auto size-3.5 text-mint/60"/></div>;
}
