// Pure event study: issuer ETF flow days vs following BTC close-to-close returns.
export interface FlowDay { date: string; total: number; flows: Record<string, number> }
export interface StudyEvent { date: string; flow: number; side: "buy" | "sell"; close: number | null; fwd: Record<number, number | null> }
export interface StudySummary { horizon: number; n: number; avg: number | null; hitRate: number | null }

/** Forward % return from the close on `date` to the close `h` calendar days later. */
export function forwardFromCloses(closes: Record<string, number>, date: string, h: number): number | null {
  const c0 = closes[date];
  const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + h);
  const c1 = closes[d.toISOString().slice(0, 10)];
  return c0 && c1 ? ((c1 - c0) / c0) * 100 : null;
}

export function findEvents(days: FlowDay[], closes: Record<string, number>, issuer: string, minAbs: number, horizons = [1, 3, 7]): StudyEvent[] {
  const out: StudyEvent[] = [];
  for (const d of days) {
    const flow = issuer === "TOTAL" ? d.total : d.flows[issuer];
    if (flow == null || !Number.isFinite(flow) || Math.abs(flow) < minAbs || flow === 0) continue;
    const fwd: Record<number, number | null> = {};
    for (const h of horizons) fwd[h] = forwardFromCloses(closes, d.date, h);
    out.push({ date: d.date, flow, side: flow > 0 ? "buy" : "sell", close: closes[d.date] ?? null, fwd });
  }
  return out;
}

/** Hit = price moved in the flow's direction over the horizon. Avg return is signed by side (positive = followed the flow). */
export function summarize(events: StudyEvent[], horizons = [1, 3, 7]): StudySummary[] {
  return horizons.map((h) => {
    const v = events.filter((e) => e.fwd[h] != null).map((e) => (e.side === "buy" ? 1 : -1) * e.fwd[h]!);
    return { horizon: h, n: v.length, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, hitRate: v.length ? v.filter((x) => x > 0).length / v.length : null };
  });
}
