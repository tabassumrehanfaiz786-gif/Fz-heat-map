// Pure synthetic NBBO aggregation across venues.
export type VenueQuote = { venue: string; bid: number; ask: number; bidQty?: number; askQty?: number; ts: number };
export type Nbbo = {
  bestBid: VenueQuote | null; bestAsk: VenueQuote | null;
  spread: number | null; mid: number | null; state: "normal" | "locked" | "crossed" | "empty";
  fresh: VenueQuote[]; stale: string[];
};

/** Combine quotes, ignoring any older than maxAgeMs or invalid. */
export function computeNbbo(quotes: VenueQuote[], now: number, maxAgeMs = 5000): Nbbo {
  const fresh: VenueQuote[] = [], stale: string[] = [];
  for (const q of quotes) {
    if (now - q.ts > maxAgeMs || !(q.bid > 0) || !(q.ask > 0) || q.bid > q.ask) stale.push(q.venue);
    else fresh.push(q);
  }
  if (!fresh.length) return { bestBid: null, bestAsk: null, spread: null, mid: null, state: "empty", fresh, stale };
  const bestBid = fresh.reduce((a, b) => (b.bid > a.bid ? b : a));
  const bestAsk = fresh.reduce((a, b) => (b.ask < a.ask ? b : a));
  const spread = bestAsk.ask - bestBid.bid;
  const state = spread < 0 ? "crossed" : spread === 0 ? "locked" : "normal";
  return { bestBid, bestAsk, spread, mid: (bestAsk.ask + bestBid.bid) / 2, state, fresh, stale };
}
