import { marketTickSchema, type MarketTick } from "./schemas";

type StreamOptions = { url: string; onFrame: (ticks: MarketTick[]) => void; onState?: (connected: boolean) => void; frameMs?: number };

export class BufferedMarketStream {
  private socket?: WebSocket;
  private buffer = new Map<string, MarketTick>();
  private timer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private attempt = 0;

  constructor(private readonly options: StreamOptions) {}

  connect() {
    this.closed = false;
    this.socket = new WebSocket(this.options.url);
    this.socket.onopen = () => { this.attempt = 0; this.options.onState?.(true); };
    this.socket.onmessage = (event) => {
      const parsed = marketTickSchema.safeParse(JSON.parse(String(event.data)));
      if (parsed.success) this.buffer.set(parsed.data.symbol, parsed.data);
    };
    this.socket.onclose = () => { this.options.onState?.(false); this.reconnect(); };
    this.timer ??= setInterval(() => this.flush(), this.options.frameMs ?? 100);
  }

  close() {
    this.closed = true;
    this.socket?.close();
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private flush() {
    if (!this.buffer.size) return;
    this.options.onFrame([...this.buffer.values()]);
    this.buffer.clear();
  }

  private reconnect() {
    if (this.closed) return;
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++) + Math.random() * 250;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
