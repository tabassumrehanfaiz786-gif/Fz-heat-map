import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findEvents, summarize, type FlowDay } from "@/lib/event-study";
import { issuerName } from "@/lib/etf.functions";

const H = [1, 3, 7];
const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

export function EventStudy({ days, excluded, onPick }: { days: FlowDay[]; excluded: string[]; onPick: (d: string) => void }) {
  const [issuer, setIssuer] = useState("IBIT");
  const [min, setMin] = useState(25);
  const closes = useQuery({
    queryKey: ["btc-daily-close"],
    queryFn: async () => {
      const k: (string | number)[][] = await fetch("https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=60").then((r) => r.json());
      const m: Record<string, number> = {};
      k.forEach((x) => { m[new Date(+x[0]!).toISOString().slice(0, 10)] = +x[4]!; });
      return m;
    },
    refetchInterval: 300_000,
  });
  const tickers = useMemo(() => ["TOTAL", ...new Set(days.flatMap((d) => Object.keys(d.flows)))], [days]);
  const events = useMemo(() => findEvents(days.filter((d) => !excluded.includes(d.date)), closes.data ?? {}, issuer, min, H), [days, excluded, closes.data, issuer, min]);
  const stats = summarize(events, H);

  // weekly-style price line with buy/sell pins
  const series = Object.entries(closes.data ?? {}).filter(([d]) => days.length && d >= days[0]!.date).sort();
  const W = 320, CH = 90;
  const vals = series.map(([, v]) => v), lo = Math.min(...vals), hi = Math.max(...vals);
  const x = (i: number) => (i / Math.max(1, series.length - 1)) * (W - 8) + 4;
  const y = (v: number) => CH - 6 - ((v - lo) / Math.max(1, hi - lo)) * (CH - 16);

  return (
    <div className="mb-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Event study · pinpoint issuer flow days</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <select aria-label="Issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} className="rounded border border-border bg-background px-1 py-0.5 text-foreground">
          {tickers.map((t) => <option key={t} value={t}>{t === "TOTAL" ? "All ETFs (total)" : `${t} · ${issuerName(t)}`}</option>)}
        </select>
        <label className="flex items-center gap-1 text-muted-foreground">Min |flow| ${min}M
          <input aria-label="Minimum flow" type="range" min={0} max={300} step={5} value={min} onChange={(e) => setMin(+e.target.value)} />
        </label>
      </div>
      {series.length > 1 && (
        <svg viewBox={`0 0 ${W} ${CH}`} className="mb-1 w-full">
          <polyline fill="none" strokeWidth="1.5" className="stroke-foreground" points={series.map(([, v], i) => `${x(i)},${y(v)}`).join(" ")} />
          {events.map((e) => {
            const i = series.findIndex(([d]) => d === e.date);
            if (i < 0) return null;
            const py = y(series[i]![1]);
            return (
              <g key={e.date} className="cursor-pointer" onClick={() => onPick(e.date)}>
                <line x1={x(i)} x2={x(i)} y1={py} y2={e.side === "buy" ? py + 10 : py - 10} className={e.side === "buy" ? "stroke-bull" : "stroke-bear"} />
                <path d={e.side === "buy" ? `M${x(i)},${py + 7} l-4,7 h8z` : `M${x(i)},${py - 7} l-4,-7 h8z`} className={e.side === "buy" ? "fill-bull" : "fill-bear"} />
              </g>
            );
          })}
        </svg>
      )}
      <p className="mb-2 text-[9px] text-muted-foreground">Line = BTC daily close · ▲ green = reported net inflow day · ▼ red = reported net outflow day. Tap a marker or row to open that day.</p>
      <div className="mb-2 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.horizon} className="rounded-md border border-border bg-muted/40 p-2">
            <div className="font-mono text-[9px] uppercase text-muted-foreground">+{s.horizon}d · n={s.n}</div>
            <div className="mt-1 font-mono text-[11px] text-foreground">Followed flow {s.hitRate == null ? "—" : `${Math.round(s.hitRate * 100)}%`}</div>
            <div className={`font-mono text-[11px] ${(s.avg ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>Avg {pct(s.avg)}</div>
          </div>
        ))}
      </div>
      {closes.isError && <p className="text-[10px] text-bear">BTC price data unavailable.</p>}
      {events.length === 0 ? <p className="text-[10px] text-muted-foreground">No reported days meet this filter.</p> : (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="text-muted-foreground"><tr><th className="text-left">Date</th><th className="text-right">Flow</th><th className="text-right">Close</th>{H.map((h) => <th key={h} className="text-right">+{h}d</th>)}</tr></thead>
            <tbody>
              {[...events].reverse().map((e) => (
                <tr key={e.date} className="cursor-pointer hover:bg-muted/50" onClick={() => onPick(e.date)}>
                  <td>{e.date}</td>
                  <td className={`text-right ${e.side === "buy" ? "text-bull" : "text-bear"}`}>{e.flow > 0 ? "+" : ""}{e.flow.toFixed(0)}M</td>
                  <td className="text-right text-foreground">{e.close ? `$${Math.round(e.close).toLocaleString()}` : "—"}</td>
                  {H.map((h) => <td key={h} className={`text-right ${(e.fwd[h] ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>{pct(e.fwd[h] ?? null)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[9px] text-muted-foreground">Flow days are holdings-based daily estimates, not exact execution times; returns run from that day's UTC close. Small sample, incomplete days excluded; descriptive only, not trading advice or causal evidence.</p>
    </div>
  );
}
