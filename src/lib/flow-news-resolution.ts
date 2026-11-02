// Pure "who won?" resolution for days where ETF flow and news sentiment disagree.
export interface ResolutionRow { date: string; total: number; news: number; priceChg: number | null }
export interface HorizonResult { horizon: number; events: number; flowWins: number; newsWins: number; flat: number }

const MIN_FLOW = 5; // $M, same noise floor as the timeline

/** Compounded forward return over the next `h` reported days (excludes the event day). */
export function forwardReturn(rows: ResolutionRow[], i: number, h: number): number | null {
  if (i + h >= rows.length) return null;
  let g = 1;
  for (let k = i + 1; k <= i + h; k++) {
    const p = rows[k]?.priceChg;
    if (p == null) return null;
    g *= 1 + p / 100;
  }
  return (g - 1) * 100;
}

export function resolveConflicts(rows: ResolutionRow[], horizons = [1, 2, 3]): HorizonResult[] {
  return horizons.map((h) => {
    const r: HorizonResult = { horizon: h, events: 0, flowWins: 0, newsWins: 0, flat: 0 };
    rows.forEach((row, i) => {
      if (row.news === 0 || Math.abs(row.total) <= MIN_FLOW || row.news === Math.sign(row.total)) return;
      const fwd = forwardReturn(rows, i, h);
      if (fwd == null) return;
      r.events++;
      const dir = Math.sign(fwd);
      if (dir === 0) r.flat++;
      else if (dir === Math.sign(row.total)) r.flowWins++;
      else r.newsWins++;
    });
    return r;
  });
}
