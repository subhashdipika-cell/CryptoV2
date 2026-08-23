"use client";

import { Bell, Blocks, Bot, ChartCandlestick, ChevronDown, Gauge, Hexagon, LayoutDashboard, Menu, Radar, Search, Settings2, Shapes, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const tabs = [
  { id: "autobot", label: "Autonomous Bot", icon: Bot },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "overview", label: "Market overview", icon: TrendingUp },
  { id: "markets", label: "Markets", icon: Gauge },
  { id: "insights", label: "Intelligence", icon: Radar },
  { id: "patterns", label: "Patterns", icon: Shapes },
  { id: "options", label: "Options", icon: ChartCandlestick },
  { id: "cockpit", label: "Strategy", icon: Blocks },
] as const;
export type TabId = (typeof tabs)[number]["id"];

export function Sidebar({ active, onChange, open, onClose }: { active: TabId; onChange: (id: TabId) => void; open: boolean; onClose: () => void }) {
  return <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col border-r border-line/80 bg-[#080c10]/95 backdrop-blur-xl transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="flex h-[68px] items-center justify-between border-b border-line/70 px-5">
      <div className="flex items-center gap-2.5"><div className="relative grid size-8 place-items-center"><Hexagon className="absolute size-8 text-mint" strokeWidth={1.4}/><span className="font-mono text-xs font-black text-mint">K</span></div><div><div className="text-sm font-bold tracking-[.16em]">KRYPTO</div><div className="font-mono text-[8px] uppercase tracking-[.28em] text-slate-500">Autonomous AI</div></div></div>
      <button className="text-slate-500 lg:hidden" onClick={onClose}><X className="size-5"/></button>
    </div>
    <nav className="flex-1 space-y-1 px-3 py-5">
      <div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.22em] text-slate-600">Workspace</div>
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { onChange(id); onClose(); }} className={cn("group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] transition", active === id ? "bg-mint/[.09] text-mint" : "text-slate-500 hover:bg-white/[.03] hover:text-slate-200")}><Icon className="size-4" strokeWidth={1.7}/><span className="flex-1">{label}</span>{active === id && <span className="h-3 w-0.5 rounded-full bg-mint"/>}</button>)}
    </nav>
    <div className="border-t border-line/70 p-3"><div className="mb-2 rounded-md border border-mint/10 bg-mint/[.035] p-3"><div className="mb-2 flex items-center gap-2"><span className="pulse-dot size-1.5 rounded-full bg-mint"/><span className="font-mono text-[9px] uppercase tracking-wider text-mint">AI worker installed</span></div><div className="text-[10px] leading-relaxed text-slate-600">Deribit Testnet<br/>Fail-closed monitoring</div></div><button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs text-slate-500 hover:text-slate-200"><Settings2 className="size-4"/>Settings</button></div>
  </aside>;
}

export function Header({ onMenu, title }: { onMenu: () => void; title: string }) {
  return <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-line/70 bg-ink/85 px-4 backdrop-blur-xl sm:px-6">
    <div className="flex items-center gap-3"><button onClick={onMenu} className="text-slate-400 lg:hidden"><Menu className="size-5"/></button><div><div className="text-[11px] text-slate-500">AI Bot / <span className="text-slate-300">{title}</span></div><h1 className="text-lg font-semibold tracking-tight">Autonomous Trading System</h1></div></div>
    <div className="flex items-center gap-2 sm:gap-3"><label className="hidden h-9 w-56 items-center gap-2 rounded-md border border-line bg-white/[.02] px-3 md:flex"><Search className="size-3.5 text-slate-600"/><input placeholder="Search markets..." className="w-full bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600"/><kbd className="font-mono text-[9px] text-slate-600">⌘K</kbd></label><button className="relative grid size-9 place-items-center rounded-md border border-line text-slate-500 hover:text-slate-200"><Bell className="size-4"/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-coral"/></button><button className="hidden h-9 items-center gap-2 rounded-md border border-line px-2.5 sm:flex"><div className="grid size-5 place-items-center rounded bg-gradient-to-br from-mint to-cyan-500 text-[9px] font-black text-black">ST</div><span className="text-[11px]">Subhash</span><ChevronDown className="size-3 text-slate-600"/></button></div>
  </header>;
}
