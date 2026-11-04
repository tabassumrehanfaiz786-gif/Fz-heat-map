// Pure helpers for the Candles tab: ETF flow markers and Coinbase L2 passive-wall tracking.

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type FlowDay = { date: string; total: number; flows: Record<string, number> };
export type FlowMarker = { date: string; candleTime: number; value: number; issuer: string; side: "in" | "out" };

/** Daily ETF flows ($M) whose magnitude meets the threshold, snapped to the candle containing that UTC day. */
export function flowMarkers(days: FlowDay[], candles: Candle[], issuer: string, thresholdM: number): FlowMarker[] {
  if (!candles.length) return [];
  const out: FlowMarker[] = [];
  for (const d of days) {
    const value = issuer === "TOTAL" ? d.total : d.flows[issuer];
    if (value === undefined || !Number.isFinite(value) || Math.abs(value) < thresholdM) continue;
    const ts = Date.parse(`${d.date}T00:00:00Z`);
    let idx = -1;
    for (let i = candles.length - 1; i >= 0; i--) if (candles[i]!.t <= ts + 86_399_999) { idx = i; break; }
    if (idx < 0) continue;
    const c = candles[idx]!;
    // intraday candles: only mark if the candle is on that day
    if (candles.length > 1 && idx === candles.length - 1 && ts > c.t + 86_400_000) continue;
    out.push({ date: d.date, candleTime: c.t, value, issuer, side: value > 0 ? "in" : "out" });
  }
  return out;
}

export type Side = "bid" | "ask";
export type WallEvent = { id: number; time: number; side: Side; price: number; size: number; kind: "emerged" | "pulled" };

/** Tracks Coinbase L2 levels and reports walls ≥ min BTC that emerge or disappear. */
export class WallTracker {
  bids = new Map<number, number>();
  asks = new Map<number, number>();
  private seq = 0;
  constructor(public minBtc: number, public maxBtc = 100_000) {}

  private inRange(s: number) { return s >= this.minBtc && s <= this.maxBtc; }

  apply(side: Side, price: number, size: number, time: number, snapshot = false): WallEvent | null {
    const book = side === "bid" ? this.bids : this.asks;
    const prev = book.get(price) ?? 0;
    if (size <= 0) book.delete(price); else book.set(price, size);
    if (snapshot) return null;
    const was = this.inRange(prev), now = size > 0 && this.inRange(size);
    if (!was && now) return { id: ++this.seq, time, side, price, size, kind: "emerged" };
    if (was && !now && size < prev) return { id: ++this.seq, time, side, price, size: prev, kind: "pulled" };
    return null;
  }

  walls(): { side: Side; price: number; size: number }[] {
    const res: { side: Side; price: number; size: number }[] = [];
    for (const [price, size] of this.bids) if (this.inRange(size)) res.push({ side: "bid", price, size });
    for (const [price, size] of this.asks) if (this.inRange(size)) res.push({ side: "ask", price, size });
    return res.sort((a, b) => b.size - a.size);
  }
}
