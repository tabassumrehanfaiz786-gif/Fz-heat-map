import { createServerFn } from "@tanstack/react-start";
import { INAV_TICKERS, computeInav, type BtcPoint, type EtfQuote, type InavRow } from "./etf-inav";

const UA = { "User-Agent": "Mozilla/5.0" };
async function chart(sym: string, range: string, interval: string) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}`, { headers: UA });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return j?.chart?.result?.[0];
}

export const getEtfInav = createServerFn({ method: "GET" }).handler(async (): Promise<{ rows: InavRow[]; missing: string[]; btcNow: number | null; checkedAt: number; error?: string }> => {
  const checkedAt = Date.now();
  try {
    const btc = await chart("BTC-USD", "5d", "5m");
    const ts: number[] = btc?.timestamp ?? [];
    const cl: (number | null)[] = btc?.indicators?.quote?.[0]?.close ?? [];
    const series: BtcPoint[] = ts.map((t, i) => ({ t, p: cl[i] as number })).filter((x) => Number.isFinite(x.p));
    const results = await Promise.all(INAV_TICKERS.map(async (tk) => {
      try {
        const c = await chart(tk, "5d", "1d");
        const m = c?.meta; const t: number[] = c?.timestamp ?? [];
        const closes: (number | null)[] = c?.indicators?.quote?.[0]?.close ?? [];
        // previous session close: last daily bar before the current session's day
        const curDay = new Date(m.regularMarketTime * 1000).toISOString().slice(0, 10);
        let idx = -1;
        for (let i = t.length - 1; i >= 0; i--) if (new Date(t[i]! * 1000).toISOString().slice(0, 10)! < curDay && closes[i]) { idx = i; break; }
        if (idx < 0) return null;
        const d = String(new Date((t[idx] ?? 0) * 1000).toISOString()).slice(0, 10);
        // 4pm ET close ≈ 21:00 UTC (20:00 in summer); use 20:55 UTC as compromise
        const prevCloseTime = Math.floor(Date.parse(`${d}T20:55:00Z`) / 1000);
        const q: EtfQuote = { ticker: tk, price: m.regularMarketPrice, time: m.regularMarketTime, prevClose: closes[idx] as number, prevCloseTime };
        return computeInav(q, series);
      } catch { return null; }
    }));
    const rows = results.filter((r): r is InavRow => !!r);
    const missing = INAV_TICKERS.filter((tk) => !rows.some((r) => r.ticker === tk));
    return { rows, missing, btcNow: series.at(-1)?.p ?? null, checkedAt };
  } catch {
    return { rows: [], missing: [...INAV_TICKERS], btcNow: null, checkedAt, error: "Public price source unavailable. No estimates shown." };
  }
});
