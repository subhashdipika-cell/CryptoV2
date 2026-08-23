/// <reference lib="webworker" />
import { marketTickSchema, type MarketTick } from "@/lib/schemas";

const buffer = new Map<string, MarketTick>();
self.onmessage = (event: MessageEvent<unknown>) => {
  const tick = marketTickSchema.safeParse(event.data);
  if (tick.success) buffer.set(tick.data.symbol, tick.data);
};
setInterval(() => {
  if (!buffer.size) return;
  self.postMessage([...buffer.values()]);
  buffer.clear();
}, 100);
