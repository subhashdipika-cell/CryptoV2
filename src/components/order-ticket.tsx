"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, ShieldAlert, X } from "lucide-react";
import type { Market } from "@/lib/types";
import type { MT5ApiEnvelope, MT5Connection } from "@/lib/mt5";
import { formatPrice } from "@/lib/utils";
import { Badge } from "./ui";

interface Tick { symbol: string; bid: number; ask: number; last: number; time: string }

export function OrderTicket({market,onClose}:{market:Market;onClose:()=>void}){
  const [side,setSide]=useState<"BUY"|"SELL">("BUY");
  const [orderType,setOrderType]=useState<"MARKET"|"LIMIT">("MARKET");
  const [symbol,setSymbol]=useState(`${market.symbol}USD`);
  const [volume,setVolume]=useState("0.01");
  const [limitPrice,setLimitPrice]=useState("");
  const [takeProfit,setTakeProfit]=useState("");
  const [stopLoss,setStopLoss]=useState("");
  const [reviewed,setReviewed]=useState(false);
  const [routingEnabled,setRoutingEnabled]=useState(false);
  const [connected,setConnected]=useState(false);
  const [validated,setValidated]=useState(false);
  const [idempotencyKey,setIdempotencyKey]=useState("");
  const [status,setStatus]=useState<string | null>(null);
  const [submitting,setSubmitting]=useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [healthResponse, tickResponse] = await Promise.all([
          fetch("/api/v1/mt5/health", { cache: "no-store" }),
          fetch(`/api/v1/mt5/tick?symbol=${encodeURIComponent(market.symbol + "USDT")}`, { cache: "no-store" }),
        ]);
        const health = await healthResponse.json() as MT5ApiEnvelope<MT5Connection>;
        const tick = await tickResponse.json() as MT5ApiEnvelope<Tick>;
        if (!healthResponse.ok || !health.data?.safety.demoVerified) throw new Error(health.message ?? "A verified MT5 demo account is required");
        if (!tickResponse.ok || !tick.data) throw new Error(tick.message ?? "MT5 symbol mapping failed");
        if (!active) return;
        setConnected(true);
        setRoutingEnabled(health.data.safety.demoOrderRoutingEnabled);
        setSymbol(tick.data.symbol);
        const mark = side === "BUY" ? tick.data.ask : tick.data.bid;
        setLimitPrice(mark.toFixed(2));
        setStopLoss((side === "BUY" ? mark * .98 : mark * 1.02).toFixed(2));
        setTakeProfit((side === "BUY" ? mark * 1.04 : mark * .96).toFixed(2));
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "MT5 connection failed");
      }
    };
    void load();
    return () => { active = false; };
  }, [market.symbol, side]);

  const submit = async (execute: boolean) => {
    setSubmitting(true);
    setStatus(null);
    try {
      const key = idempotencyKey || crypto.randomUUID();
      setIdempotencyKey(key);
      const response = await fetch(`/api/v1/mt5/orders${execute ? "" : "?preview=true"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key,
          symbol,
          side,
          type: orderType,
          volume: Number(volume),
          limitPrice: orderType === "LIMIT" ? Number(limitPrice) : undefined,
          stopLoss: Number(stopLoss),
          takeProfit: takeProfit ? Number(takeProfit) : undefined,
        }),
      });
      const payload = await response.json() as MT5ApiEnvelope<{ status: string }>;
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "MT5 rejected the request");
      if (execute) {
        setStatus(`MT5 demo order ${payload.data?.status?.toLowerCase() ?? "processed"}.`);
        setValidated(false);
        setIdempotencyKey("");
      } else {
        setValidated(payload.data?.status === "VALIDATED");
        setStatus(payload.data?.status === "VALIDATED" ? "MT5 validation passed. No order was sent." : "MT5 rejected the order preview.");
      }
    } catch (error) {
      setValidated(false);
      setStatus(error instanceof Error ? error.message : "MT5 request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}><div onMouseDown={event=>event.stopPropagation()} className="panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold">MT5 Quick Order</h3><Badge tone={connected?"positive":"warning"}>{connected?"Demo connected":"Connecting"}</Badge></div><div className="mt-1 font-mono text-[10px] text-slate-600">{symbol} · ANALYTICS MARK ${formatPrice(market.price)}</div></div><button onClick={onClose} aria-label="Close order ticket"><X className="size-4 text-slate-500"/></button></div>
    <div className="mb-4 grid grid-cols-2 rounded-md bg-black/30 p-1"><button onClick={()=>{setSide("BUY");setValidated(false)}} className={`rounded py-2 text-[11px] font-semibold ${side==="BUY"?"bg-mint text-black":"text-slate-600"}`}>BUY / LONG</button><button onClick={()=>{setSide("SELL");setValidated(false)}} className={`rounded py-2 text-[11px] font-semibold ${side==="SELL"?"bg-coral text-white":"text-slate-600"}`}>SELL / SHORT</button></div>
    <div className="mb-4 grid grid-cols-2 gap-2"><label className="text-[9px] text-slate-600">MT5 SYMBOL<input value={symbol} onChange={event=>{setSymbol(event.target.value.toUpperCase());setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-black/20 px-3 py-2 font-mono text-[10px] uppercase outline-none focus:border-mint/30"/></label><label className="text-[9px] text-slate-600">ORDER TYPE<select value={orderType} onChange={event=>{setOrderType(event.target.value as "MARKET"|"LIMIT");setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-[#0b1014] px-3 py-2 font-mono text-[10px] outline-none"><option value="MARKET">MARKET</option><option value="LIMIT">LIMIT</option></select></label></div>
    <div className="mb-4 grid grid-cols-2 gap-2"><label className="text-[9px] text-slate-600">VOLUME · LOTS<input value={volume} type="number" min="0.01" step="0.01" onChange={event=>{setVolume(event.target.value);setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-black/20 px-3 py-2 font-mono text-[10px] outline-none focus:border-mint/30"/></label><label className="text-[9px] text-slate-600">LIMIT PRICE<input value={limitPrice} disabled={orderType!=="LIMIT"} type="number" onChange={event=>{setLimitPrice(event.target.value);setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-black/20 px-3 py-2 font-mono text-[10px] outline-none disabled:opacity-30 focus:border-mint/30"/></label></div>
    <div className="mb-4 grid grid-cols-2 gap-2"><label className="text-[9px] text-slate-600">TAKE PROFIT<input value={takeProfit} type="number" onChange={event=>{setTakeProfit(event.target.value);setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-black/20 px-3 py-2 font-mono text-[10px] outline-none focus:border-mint/30"/></label><label className="text-[9px] text-slate-600">STOP LOSS · REQUIRED<input value={stopLoss} type="number" onChange={event=>{setStopLoss(event.target.value);setValidated(false)}} className="mt-1.5 w-full rounded border border-line bg-black/20 px-3 py-2 font-mono text-[10px] outline-none focus:border-coral/30"/></label></div>
    <div className="mb-4 rounded border border-amber/15 bg-amber/[.04] p-3"><div className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber"/><p className="text-[9px] leading-relaxed text-slate-500"><b className="text-amber">MT5 DEMO only.</b> Validation checks account mode, symbol, volume step, tick freshness, stop direction, and margin limit. Real-account routing is unavailable.</p></div></div>
    {status && <div className={`mb-4 flex items-start gap-2 rounded border p-3 text-[9px] ${validated?"border-mint/15 bg-mint/[.04] text-mint":"border-line bg-black/20 text-slate-400"}`}>{validated&&<CheckCircle2 className="size-3.5 shrink-0"/>}{status}</div>}
    <label className="mb-4 flex items-start gap-2 text-[9px] leading-relaxed text-slate-500"><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)} className="mt-0.5 accent-[#23f7b6]"/>I understand this can only validate or route an order to the connected MT5 DEMO account.</label>
    {!validated && <button disabled={!reviewed||!connected||submitting} onClick={()=>void submit(false)} className="flex w-full items-center justify-center gap-2 rounded-md bg-mint py-3 text-xs font-bold text-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600">{submitting?<LoaderCircle className="size-3.5 animate-spin"/>:<ShieldAlert className="size-3.5"/>}VALIDATE WITH MT5</button>}
    {validated && <button disabled={!reviewed||!routingEnabled||submitting} onClick={()=>void submit(true)} className="flex w-full items-center justify-center gap-2 rounded-md bg-amber py-3 text-xs font-bold text-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600">{submitting?<LoaderCircle className="size-3.5 animate-spin"/>:<LockKeyhole className="size-3.5"/>}{routingEnabled?"SEND TO MT5 DEMO":"DEMO ROUTING DISABLED"}</button>}
  </div></div>;
}
