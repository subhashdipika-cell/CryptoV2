import { cn } from "@/lib/utils";

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "positive" | "negative" | "warning"; className?: string }) {
  const tones = {
    default: "border-line bg-white/[.03] text-slate-300",
    positive: "border-mint/20 bg-mint/[.08] text-mint",
    negative: "border-coral/20 bg-coral/[.08] text-coral",
    warning: "border-amber/20 bg-amber/[.08] text-amber",
  };
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider", tones[tone], className)}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3">
    <div>{eyebrow && <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[.24em] text-mint/70">{eyebrow}</div>}<h2 className="text-[15px] font-semibold tracking-tight text-slate-100">{title}</h2></div>
    {action}
  </div>;
}

export function Change({ value }: { value: number }) {
  return <span className={cn("number font-mono text-xs font-semibold", value >= 0 ? "text-mint" : "text-coral")}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

export function Progress({ value, tone = "mint" }: { value: number; tone?: "mint" | "coral" | "amber" }) {
  const color = tone === "mint" ? "bg-mint" : tone === "coral" ? "bg-coral" : "bg-amber";
  return <div className="h-1 overflow-hidden rounded-full bg-white/[.06]"><div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} /></div>;
}
