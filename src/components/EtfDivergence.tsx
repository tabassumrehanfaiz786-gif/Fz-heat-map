import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getEtfHistory, issuerName, type EtfDay } from "@/lib/etf.functions";
import { analyzeDivergence } from "@/lib/ai.functions";
import { newsQuery } from "@/components/NewsFeed";
import { useSettings } from "@/lib/settings";

const TOP = ["IBIT", "FBTC", "GBTC", "ARKB", "BITB", "BTC", "HODL", "BRRR", "EZBC", "BTCO"];
const BASE: Record<string, number> = { IBIT: 90, FBTC: 30, GBTC: -15, ARKB: 8, BITB: 6, BTC: 4, HODL: 2, BRRR: 1, EZBC: 0.8, BTCO: 0.5 };

// Deterministic illustrative history, used only until a provider key is added.
function sampleDays(): EtfDay[] {
  const out: EtfDay[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (out.length < 30) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const seed = d.getTime() / 86400000;
    const flows: Record<string, number> = {};
    TOP.forEach((t, i) => {
      const w = Math.sin(seed * (1.3 + i * 0.17)) + Math.cos(seed * 0.7 + i);
      flows[t] = +(BASE[t]! * (1 + w * 2.2)).toFixed(1);
    });
    out.unshift({ date: d.toISOString().slice(0, 10), total: Object.values(flows).reduce((a, b) => a + b, 0), flows });
  }
  return out;
}

export function EtfDivergence({ onConfigure }: { onConfigure: () => void }) {
  const { etfProvider } = useSettings();
  const hist = useQuery({ queryKey: ["etf-hist", etfProvider], queryFn: () => getEtfHistory({ data: { provider: etfProvider } }), refetchInterval: 600_000 });
  const price = useQuery({
    queryKey: ["btc-daily"],
    queryFn: async () => {
      const k: (string | number)[][] = await fetch("https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=45").then((r) => r.json());
      const m: Record<string, number> = {};
      k.forEach((x) => { m[new Date(+x[0]!).toISOString().slice(0, 10)] = ((+x[4]! - +x[1]!) / +x[1]!) * 100; });
      return m;
    },
    refetchInterval: 300_000,
  });
  const news = useQuery(newsQuery);
  const live = !!hist.data?.configured && !hist.data.error && hist.data.days.length > 0;
  const days = useMemo(() => (live ? hist.data!.days : sampleDays()), [live, hist.data]);

  const issuers = useMemo(() => {
    const m = new Map<string, { inflow: number; outflow: number }>();
    for (const d of days) for (const [t, v] of Object.entries(d.flows)) {
      const r = m.get(t) ?? { inflow: 0, outflow: 0 };
      if (v >= 0) r.inflow += v; else r.outflow += v;
      m.set(t, r);
    }
    return [...m.entries()].map(([t, r]) => ({ t, ...r, net: r.inflow + r.outflow })).sort((a, b) => b.inflow - b.outflow - (a.inflow - a.outflow)).slice(0, 10);
  }, [days]);
  const imax = Math.max(1, ...issuers.map((i) => Math.max(i.inflow, -i.outflow)));

  const rows = days.map((d) => {
    const p = price.data?.[d.date];
    return { ...d, priceChg: p ?? null, diverged: p != null && Math.abs(d.total) > 5 && Math.sign(p) !== Math.sign(d.total) };
  });
  const withPrice = rows.filter((r) => r.priceChg != null);
  const div = withPrice.filter((r) => r.diverged);
  const fmax = Math.max(1, ...rows.map((r) => Math.abs(r.total)));
  const pmax = Math.max(0.5, ...withPrice.map((r) => Math.abs(r.priceChg!)));
  const totalIn = rows.reduce((a, r) => a + Math.max(0, r.total), 0), totalOut = rows.reduce((a, r) => a + Math.min(0, r.total), 0);

  const ai = useMutation({
    mutationFn: () => analyzeDivergence({ data: { days: withPrice.map((r) => ({ date: r.date, flow: r.total, priceChg: r.priceChg! })), headlines: (news.data ?? []).slice(0, 25).map((n) => n.title) } }),
  });

  const W = 320, H = 120, bw = W / Math.max(1, rows.length);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">30-day ETF flows</h2>
        <span className="font-mono text-[11px]"><span className="text-bull">+{totalIn.toFixed(0)}M</span> / <span className="text-bear">{totalOut.toFixed(0)}M</span></span>
      </div>
      <p className="mb-3 text-[10px] text-muted-foreground">
        {live ? `Live from ${hist.data!.provider}.` : <>{hist.data?.error ? `${hist.data.error}. ` : "Sample figures. "}<button onClick={onConfigure} className="text-primary underline underline-offset-2">Configure provider</button></>}
      </p>

      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Top 10 issuers · inflow vs outflow</h3>
      {issuers.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">This provider only returns market totals, not per-issuer flows.</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {issuers.map((i) => (
            <li key={i.t} className="grid grid-cols-[4.5rem_1fr_1fr_3.5rem] items-center gap-1">
              <div className="truncate"><span className="font-mono text-[11px] font-semibold text-foreground">{i.t}</span> <span className="text-[9px] text-muted-foreground">{issuerName(i.t)}</span></div>
              <div className="flex h-2 justify-end rounded-l-full bg-muted"><div className="h-2 rounded-l-full bg-bear" style={{ width: `${(-i.outflow / imax) * 100}%` }} /></div>
              <div className="h-2 rounded-r-full bg-muted"><div className="h-2 rounded-r-full bg-bull" style={{ width: `${(i.inflow / imax) * 100}%` }} /></div>
              <div className={`text-right font-mono text-[10px] ${i.net >= 0 ? "text-bull" : "text-bear"}`}>{i.net >= 0 ? "+" : ""}{i.net.toFixed(0)}M</div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Daily net flow vs BTC price change</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="mb-1 w-full">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-border" />
        {rows.map((r, i) => {
          const h = (Math.abs(r.total) / fmax) * (H / 2 - 4);
          return (
            <g key={r.date}>
              {r.diverged && <rect x={i * bw} y="0" width={bw} height={H} className="fill-wall/15" />}
              <rect x={i * bw + 1} y={r.total >= 0 ? H / 2 - h : H / 2} width={Math.max(1, bw - 2)} height={h} className={r.total >= 0 ? "fill-bull" : "fill-bear"} opacity={0.8} />
            </g>
          );
        })}
        <polyline fill="none" strokeWidth="1.5" className="stroke-foreground"
          points={rows.map((r, i) => (r.priceChg == null ? null : `${i * bw + bw / 2},${H / 2 - (r.priceChg / pmax) * (H / 2 - 4)}`)).filter(Boolean).join(" ")} />
      </svg>
      <p className="mb-3 text-[10px] text-muted-foreground">Bars = ETF flow · line = BTC daily % · red shading = flow and price moved opposite.</p>

      <div className="mb-3 rounded-md bg-secondary p-3">
        <div className="font-mono text-xs text-foreground">
          {withPrice.length ? <>Price disagreed with flows on <b className="text-wall">{div.length} of {withPrice.length}</b> days ({Math.round((div.length / withPrice.length) * 100)}%)</> : "Loading price data…"}
        </div>
        <ul className="mt-2 space-y-1">
          {div.slice(-6).reverse().map((r) => (
            <li key={r.date} className="font-mono text-[10px] text-muted-foreground">
              {r.date}: <span className={r.total >= 0 ? "text-bull" : "text-bear"}>{r.total >= 0 ? "inflow +" : "outflow "}{r.total.toFixed(0)}M</span> but BTC{" "}
              <span className={r.priceChg! >= 0 ? "text-bull" : "text-bear"}>{r.priceChg! >= 0 ? "+" : ""}{r.priceChg!.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn-chip btn-chip-active mb-2 self-start" disabled={ai.isPending || !withPrice.length} onClick={() => ai.mutate()}>
        {ai.isPending ? "Analyzing…" : "AI: why flows & news didn't match"}
      </button>
      {ai.error && <p role="alert" className="text-xs text-bear">{(ai.error as Error).message}</p>}
      {ai.data && (
        <div className="space-y-2 text-xs text-foreground">
          <p>{ai.data.summary}</p>
          <p className="text-muted-foreground"><b className="text-foreground">News vs price:</b> {ai.data.newsTone}</p>
          <ul className="space-y-1.5">
            {ai.data.items.map((it) => (
              <li key={it.date} className="news-item news-negative"><span className="font-mono text-[10px]">{it.date}</span><span className="block text-foreground">{it.explanation}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
