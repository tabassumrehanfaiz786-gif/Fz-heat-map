// Pure helpers for estimated intraday ETF iNAV and premium/discount.
export const INAV_TICKERS = ["IBIT", "FBTC", "GBTC", "ARKB", "BITB", "HODL", "BTCO", "BRRR", "EZBC", "BTCW"] as const;

export type BtcPoint = { t: number; p: number };
export type EtfQuote = { ticker: string; price: number; time: number; prevClose: number; prevCloseTime: number };
export type InavRow = {
  ticker: string; price: number; time: number; btcPerShare: number; btcAtQuote: number;
  inav: number; premiumPct: number; signal: "creation" | "redemption" | "none";
};

/** Price of BTC at or just before time t (seconds). Null if no point within maxGap. */
export function btcAt(series: BtcPoint[], t: number, maxGap = 1800): number | null {
  let best: BtcPoint | null = null;
  for (const pt of series) if (pt.t <= t && (!best || pt.t > best.t)) best = pt;
  if (!best || t - best.t > maxGap) return null;
  return best.p;
}

/**
 * Estimate iNAV assuming the ETF's previous close ≈ its NAV, so
 * BTC/share = prevClose / BTC at prev close time; iNAV = BTC now × BTC/share.
 * Signal when |premium| exceeds threshold (percent).
 */
export function computeInav(q: EtfQuote, series: BtcPoint[], thresholdPct = 0.25): InavRow | null {
  const btcPrev = btcAt(series, q.prevCloseTime);
  const btcNow = btcAt(series, q.time);
  if (!btcPrev || !btcNow || !(q.prevClose > 0) || !(q.price > 0)) return null;
  const btcPerShare = q.prevClose / btcPrev;
  const inav = btcNow * btcPerShare;
  const premiumPct = (q.price / inav - 1) * 100;
  const signal = premiumPct > thresholdPct ? "creation" : premiumPct < -thresholdPct ? "redemption" : "none";
  return { ticker: q.ticker, price: q.price, time: q.time, btcPerShare, btcAtQuote: btcNow, inav, premiumPct, signal };
}
