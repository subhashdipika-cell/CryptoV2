import { create } from "zustand";
import type { MarketTick } from "@/lib/schemas";

interface MarketState {
  ticks: Record<string, MarketTick>;
  connected: boolean;
  lastFrameAt: number;
  applyFrame: (ticks: MarketTick[]) => void;
  setConnected: (connected: boolean) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  ticks: {},
  connected: false,
  lastFrameAt: 0,
  applyFrame: (frame) => set((state) => ({
    ticks: frame.reduce((all, tick) => ({ ...all, [tick.symbol]: tick }), state.ticks),
    lastFrameAt: Date.now(),
  })),
  setConnected: (connected) => set({ connected }),
}));
