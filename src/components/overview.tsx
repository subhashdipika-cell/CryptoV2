"use client";

import { ArrowDownRight, ArrowUpRight, BarChart3, Clock3, ExternalLink, Flame, Globe2, ScanLine, TrendingUp, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { markets, sparkline } from "@/lib/mock-data";
import type { Market, Timeframe } from "@/lib/types";
import { formatCompact, formatPrice, cn } from "@/lib/utils";
import { scoreMarket } from "@/lib/scoring";
import { Badge, Change, Progress, SectionTitle } from "./ui";
import { MiniChart } from "./mini-chart";

const metricCards = [
  { label: "Markets tracked", value: "824", meta: "+12 this week", icon: Globe2 },
  { label: "24h volume", value: "$186.4B", meta: "+14.2%", icon: BarChart3 },
  { label: "Market cap", value: "$3.76T", meta: "+2.8%", icon: Waves },
  { label: "Open interest", value: "$91.2B", meta: "+6.1%", icon: TrendingUp },
];

export function Overview({ onOpenOrder }: { onOpenOrder: (market: Market) => void }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("24H");
  const [selected, setSelected] = useState<Market | null>(null);
  const ranked = useMemo(() => [...markets].sort((a, b) => scoreMarket(b).score - scoreMarket(a).score), []);

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label, value, meta, icon: Icon }) => <div key={label} className="panel group rounded-lg p-4 transition hover:border-slate-600/70"><div className="mb-4 flex items-start justify-between"><span className="text-[11px] text-slate-500">{label}</span><Icon className="size-4 text-slate-600 transition group-hover:text-mint" strokeWidth={1.5}/></div><div className="flex items-end justify-between"><span className="number font-mono text-xl font-semibold tracking-tight">{value}</span><span className="font-mono text-[10px] text-mint">{meta}</span></div></div>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <section className="panel overflow-hidden rounded-lg p-4 sm:p-5">
        <SectionTitle eyebrow="Live universe" title="Perpetual Market Map" action={<div className="flex rounded-md border border-line bg-black/20 p-0.5">{(["1H","4H","24H","7D","30D"] as Timeframe[]).map((item) => <button key={item} onClick={() => setTimeframe(item)} className={cn("rounded px-2 py-1 font-mono text-[9px] transition", timeframe === item ? "bg-white/[.08] text-white" : "text-slate-600 hover:text-slate-300")}>{item}</button>)}</div>}/>
        <BubbleMap onSelect={setSelected}/>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 font-mono text-[9px] text-slate-600"><span>SIZE = 24H VOLUME</span><div className="flex items-center gap-3"><span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-coral"/>-10%</span><span className="h-px w-16 bg-gradient-to-r from-coral via-slate-600 to-mint"/><span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-mint"/>+10%</span></div><span>CLICK TO INSPECT</span></div>
      </section>

      <section className="panel rounded-lg p-4 sm:p-5">
        <SectionTitle eyebrow="Momentum" title="Market Pulse" action={<Badge tone="positive">Live</Badge>}/>
        <div className="mb-5 grid grid-cols-[1fr_120px] items-center gap-3 border-b border-line/60 pb-5">
          <div><div className="mb-1 text-xs text-slate-500">Composite market breadth</div><div className="flex items-baseline gap-2"><span className="font-mono text-3xl font-semibold">+2.84%</span><Badge tone="positive"><ArrowUpRight className="mr-1 size-2.5"/>Risk on</Badge></div><div className="mt-3 flex gap-4 text-[10px] text-slate-500"><span><b className="text-mint">612</b> advancing</span><span><b className="text-coral">212</b> declining</span></div></div><div className="h-20"><MiniChart data={sparkline}/></div>
        </div>
        <div className="mb-4 flex items-center justify-between"><span className="text-xs text-slate-500">Trader fear & greed</span><span className="font-mono text-xs font-semibold text-coral">SELL ZONE</span></div>
        <FearGreed value={72}/>
        <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-md border border-line/70 bg-white/[.015] p-3"><div className="text-[10px] text-slate-600">Long liquidations</div><div className="mt-1 font-mono text-base font-semibold text-coral">$184.2M</div></div><div className="rounded-md border border-line/70 bg-white/[.015] p-3"><div className="text-[10px] text-slate-600">Short liquidations</div><div className="mt-1 font-mono text-base font-semibold text-mint">$92.8M</div></div></div>
      </section>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <section className="panel rounded-lg p-4 sm:p-5"><SectionTitle eyebrow="Signal engine" title="Highest Conviction Markets" action={<button className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-mint">View intelligence <ExternalLink className="size-3"/></button>}/><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead><tr className="border-b border-line/70 font-mono text-[9px] uppercase tracking-wider text-slate-600"><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Price</th><th className="pb-3 font-medium">24h</th><th className="pb-3 font-medium">Signal</th><th className="pb-3 font-medium">Confidence</th><th className="pb-3 text-right font-medium">Action</th></tr></thead><tbody>{ranked.slice(0,6).map((market) => { const score = scoreMarket(market); return <tr key={market.symbol} className="group border-b border-line/40 last:border-0"><td className="py-3"><div className="flex items-center gap-2.5"><div className="grid size-7 place-items-center rounded-full border border-white/10 text-[9px] font-bold" style={{ backgroundColor: market.color + "18", color: market.color }}>{market.symbol.slice(0,2)}</div><div><div className="text-xs font-semibold">{market.symbol}<span className="text-slate-600">/USDT</span></div><div className="text-[9px] text-slate-600">{market.name}</div></div></div></td><td className="number py-3 font-mono text-xs">${formatPrice(market.price)}</td><td className="py-3"><Change value={market.change}/></td><td className="py-3"><Badge tone={score.score > 61 ? "positive" : score.score < 43 ? "negative" : "default"}>{score.action}</Badge></td><td className="py-3"><div className="flex w-28 items-center gap-2"><div className="flex-1"><Progress value={score.score} tone={score.score > 60 ? "mint" : "coral"}/></div><span className="font-mono text-[10px]">{score.score}%</span></div></td><td className="py-3 text-right"><button onClick={() => onOpenOrder(market)} className="rounded border border-line px-2 py-1 font-mono text-[9px] text-slate-500 transition hover:border-mint/30 hover:text-mint">TRADE</button></td></tr>})}</tbody></table></div></section>

      <section className="panel rounded-lg p-4 sm:p-5"><SectionTitle eyebrow="Opportunity feed" title="Unusual Activity" action={<ScanLine className="size-4 text-mint"/>}/><div className="space-y-1">{[
        ["SUI", "OI expansion", "+17.3%", "2m", true], ["PEPE", "Funding flip", "-0.014%", "7m", false], ["LINK", "Volume surge", "3.8× avg", "12m", true], ["ETH", "Call wall moved", "$3,800", "18m", true], ["AVAX", "Demand breach", "$24.70", "31m", false]
      ].map(([asset, event, value, time, positive]) => <button key={`${asset}-${event}`} className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition hover:bg-white/[.025]"><div className={cn("grid size-7 place-items-center rounded border font-mono text-[9px] font-bold", positive ? "border-mint/15 bg-mint/[.05] text-mint" : "border-coral/15 bg-coral/[.05] text-coral")}>{positive ? <ArrowUpRight className="size-3.5"/> : <ArrowDownRight className="size-3.5"/>}</div><div className="flex-1"><div className="text-xs"><b>{asset}</b> <span className="text-slate-500">{event}</span></div><div className={cn("mt-0.5 font-mono text-[10px]", positive ? "text-mint" : "text-coral")}>{value}</div></div><span className="font-mono text-[9px] text-slate-700">{time}</span></button>)}</div></section>
    </div>
    {selected && <MarketDrawer market={selected} onClose={() => setSelected(null)} onTrade={() => { onOpenOrder(selected); setSelected(null); }}/>} 
  </div>;
}

function BubbleMap({ onSelect }: { onSelect: (market: Market) => void }) {
  const positions = [[25,32],[56,34],[76,63],[44,68],[85,27],[14,69],[66,15],[32,74],[92,72],[9,26],[48,14],[72,83]];
  return <div className="grid-bg scanline relative h-[380px] overflow-hidden rounded-md border border-line/50 bg-[#080c10]">{markets.map((market, index) => { const size = 50 + Math.sqrt(market.volume / 1e9) * 13; const positive = market.change >= 0; return <button key={market.symbol} onClick={() => onSelect(market)} className={cn("absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border transition duration-300 hover:z-20 hover:scale-110", positive ? "border-mint/40 bg-mint/[.08] shadow-[inset_0_0_30px_rgba(35,247,182,.08)]" : "border-coral/40 bg-coral/[.08] shadow-[inset_0_0_30px_rgba(255,93,114,.08)]")} style={{ left: `${positions[index][0]}%`, top: `${positions[index][1]}%`, width: Math.min(size, 138), height: Math.min(size,138) }}><span className="text-center"><b className="block text-[11px] tracking-wide">{market.symbol}</b><span className={cn("font-mono text-[9px]", positive ? "text-mint" : "text-coral")}>{positive ? "+" : ""}{market.change.toFixed(1)}%</span></span></button>})}<div className="absolute bottom-3 left-3 rounded border border-line bg-black/40 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">824 nodes · 100ms frame</div></div>;
}

function FearGreed({ value }: { value: number }) {
  return <div><div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-mint via-amber to-coral"><span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-lg" style={{ left: `${value}%` }}/></div><div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600"><span>0 · BUY</span><span className="text-xl font-semibold text-white">{value}</span><span>SELL · 100</span></div></div>;
}

function MarketDrawer({ market, onClose, onTrade }: { market: Market; onClose: () => void; onTrade: () => void }) {
  const score = scoreMarket(market);
  return <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-line bg-[#0a0e12] p-6 shadow-2xl"><div className="mb-8 flex items-start justify-between"><div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-mint">Market deep dive</div><h3 className="mt-1 text-xl font-semibold">{market.name} <span className="text-slate-600">{market.symbol}/USDT</span></h3></div><button onClick={onClose} className="text-slate-500 hover:text-white">×</button></div><div className="mb-6 flex items-end justify-between"><div><div className="font-mono text-3xl font-semibold">${formatPrice(market.price)}</div><Change value={market.change}/></div><Badge tone={score.score > 60 ? "positive" : "negative"}>{score.action} · {score.score}%</Badge></div><div className="mb-7 h-40 rounded border border-line bg-black/20 p-3"><MiniChart data={sparkline.map((v,i) => v + Math.sin(i)*8)} negative={market.change < 0} height={130}/></div><div className="grid grid-cols-2 gap-2">{[["24h volume", `$${formatCompact(market.volume)}`],["Open interest", `${market.oiChange > 0 ? "+" : ""}${market.oiChange}%`],["Funding / 8h", `${market.funding}%`],["Funding reset", "02:14:38"],["Support", `$${formatPrice(market.price*.946)}`],["Resistance", `$${formatPrice(market.price*1.084)}`]].map(([label,value]) => <div key={label} className="rounded border border-line/70 p-3"><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 font-mono text-xs">{value}</div></div>)}</div><div className="my-6 rounded border border-mint/10 bg-mint/[.035] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Flame className="size-4 text-mint"/>Bias summary</div><p className="text-[11px] leading-relaxed text-slate-500">OI expansion and positive volume delta support continuation. Price is {market.change >= 0 ? "holding above" : "testing"} intraday value area. Resistance move potential: <b className="text-slate-300">8.4%</b>.</p></div><button onClick={onTrade} className="w-full rounded-md bg-mint py-3 text-xs font-bold text-black transition hover:bg-[#5bffd0]">OPEN PAPER ORDER TICKET</button><div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[9px] text-slate-700"><Clock3 className="size-3"/>DATA UPDATED 240MS AGO</div></div></div>;
}
