// Pure detection engine for iceberg replenishment and TWAP slicing.
export type Side = "buy" | "sell";
export interface Trade { price: number; qty: number; time: number; side: Side } // side = aggressor
export type Book = Map<number, number>; // price -> qty

export interface IcebergEvent {
  kind: "iceberg"; price: number; passiveSide: "bid" | "ask";
  executed: number; peakVisible: number; refills: number; ratio: number; firstSeen: number; lastSeen: number;
}
export interface TwapEvent {
  kind: "twap"; side: Side; slices: number; avgSize: number; intervalMs: number;
  totalQty: number; vwap: number; start: number; last: number; regularity: number;
}

export const ICEBERG_RATIO = 2.5;
export const ICEBERG_MIN_REFILLS = 2;

interface LevelState { executed: number; peakVisible: number; lastVisible: number; refills: number; first: number; last: number; side: "bid" | "ask" }

export class IcebergDetector {
  levels = new Map<string, LevelState>();
  constructor(private tick = 1, private minQty = 0.5) {}
  key(p: number, s: string) { return `${s}:${Math.round(p / this.tick) * this.tick}`; }

  onBook(bids: Book, asks: Book, now: number) {
    for (const [side, book] of [["bid", bids], ["ask", asks]] as const) {
      for (const [p, q] of book) {
        const k = this.key(p, side);
        const st = this.levels.get(k);
        if (!st) continue;
        if (q > st.lastVisible && st.executed > 0) { st.refills++; st.last = now; }
        st.lastVisible = q; st.peakVisible = Math.max(st.peakVisible, q);
      }
    }
  }

  onTrade(t: Trade, visibleAtLevel: number) {
    const side = t.side === "sell" ? "bid" : "ask"; // sell aggressor hits bids
    const k = this.key(t.price, side);
    let st = this.levels.get(k);
    if (!st) { st = { executed: 0, peakVisible: visibleAtLevel, lastVisible: visibleAtLevel, refills: 0, first: t.time, last: t.time, side }; this.levels.set(k, st); }
    st.executed += t.qty; st.last = t.time;
    st.peakVisible = Math.max(st.peakVisible, visibleAtLevel);
  }

  events(now: number, maxAgeMs = 5 * 60_000): IcebergEvent[] {
    const out: IcebergEvent[] = [];
    for (const [k, s] of this.levels) {
      if (now - s.last > maxAgeMs) { this.levels.delete(k); continue; }
      const ratio = s.peakVisible > 0 ? s.executed / s.peakVisible : 0;
      if (s.executed >= this.minQty && ratio >= ICEBERG_RATIO && s.refills >= ICEBERG_MIN_REFILLS)
        out.push({ kind: "iceberg", price: Number(k.split(":")[1]), passiveSide: s.side, executed: s.executed, peakVisible: s.peakVisible, refills: s.refills, ratio, firstSeen: s.first, lastSeen: s.last });
    }
    return out.sort((a, b) => b.executed - a.executed);
  }
}

/** Detect evenly-spaced, similar-size slices per side. */
export function detectTwap(trades: Trade[], opts = { minSlices: 5, sizeTol: 0.15, maxCv: 0.25, minSize: 0.05 }): TwapEvent[] {
  const out: TwapEvent[] = [];
  for (const side of ["buy", "sell"] as Side[]) {
    const ts = trades.filter((t) => t.side === side && t.qty >= opts.minSize).sort((a, b) => a.time - b.time);
    const used = new Set<number>();
    for (let i = 0; i < ts.length; i++) {
      if (used.has(i)) continue;
      const ref = ts[i]!.qty;
      const grp = [i];
      for (let j = i + 1; j < ts.length; j++) if (!used.has(j) && Math.abs(ts[j]!.qty - ref) / ref <= opts.sizeTol) grp.push(j);
      if (grp.length < opts.minSlices) continue;
      const g = grp.map((x) => ts[x]!);
      const iv = g.slice(1).map((t, k) => t.time - g[k]!.time);
      const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
      if (mean < 500) continue;
      const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length);
      const cv = sd / mean;
      if (cv > opts.maxCv) continue;
      grp.forEach((x) => used.add(x));
      const total = g.reduce((a, t) => a + t.qty, 0);
      out.push({ kind: "twap", side, slices: g.length, avgSize: total / g.length, intervalMs: mean, totalQty: total,
        vwap: g.reduce((a, t) => a + t.price * t.qty, 0) / total, start: g[0]!.time, last: g[g.length - 1]!.time, regularity: 1 - cv });
    }
  }
  return out.sort((a, b) => b.totalQty - a.totalQty);
}

/** -1 (sell-side hidden pressure) .. +1 (bid-side hidden absorption). */
export function liquidityAsymmetry(ev: IcebergEvent[]): number {
  let b = 0, a = 0;
  for (const e of ev) e.passiveSide === "bid" ? (b += e.executed) : (a += e.executed);
  return b + a === 0 ? 0 : (b - a) / (b + a);
}
