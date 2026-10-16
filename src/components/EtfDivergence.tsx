import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getEtfHistory, issuerName, type EtfDay } from "@/lib/etf.functions";
import { analyzeDivergence } from "@/lib/ai.functions";
import { newsQuery } from "@/components/NewsFeed";
import { getBtcNewsHistory } from "@/lib/news.functions";
import { normalizeHistoricalNews } from "@/lib/news-history";
import { useSettings } from "@/lib/settings";
import { exportDivergencePdf } from "@/lib/report-pdf";

const TOP = ["IBIT", "FBTC", "GBTC", "ARKB", "BITB", "BTC", "HODL", "BRRR", "EZBC", "BTCO"];
const BASE: Record<string, number> = { IBIT: 90, FBTC: 30, GBTC: -15, ARKB: 8, BITB: 6, BTC: 4, HODL: 2, BRRR: 1, EZBC: 0.8, BTCO: 0.5 };

// Deterministic illustrative history, used only until the CoinGlass key is added.
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

const bizDaysBetween = (a: string, b: string) => {
  let n = 0;
  const d = new Date(a + "T00:00:00Z"), e = new Date(b + "T00:00:00Z");
  while (d < e) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() % 6 !== 0) n++; }
  return n;
};

export function EtfDivergence({ onConfigure }: { onConfigure: () => void }) {
  const { etfProvider } = useSettings();
  const [sel, setSel] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
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
  const newsHistory = useQuery({ queryKey: ["btc-news-history", 30], queryFn: () => getBtcNewsHistory(), staleTime: 600_000, refetchInterval: 600_000 });
  const headlines = useMemo(() => normalizeHistoricalNews([...(newsHistory.data?.items ?? []), ...(news.data ?? [])], Date.now()), [newsHistory.data, news.data]);
  const live = !!hist.data?.configured && !hist.data.error && hist.data.days.length > 0;
  const days = useMemo(() => (live ? hist.data!.days : sampleDays()), [live, hist.data]);
  const source = live ? hist.data!.provider : "Sample data";
  const updated = live && hist.data!.fetchedAt ? new Date(hist.data!.fetchedAt).toLocaleString() : "—";
  const latestDate = days[days.length - 1]?.date ?? "";

  // news by day
  const newsByDay = useMemo(() => {
    const m = new Map<string, { score: number; items: { title: string; tone: string; url: string }[] }>();
    for (const n of headlines) {
      const d = new Date(n.publishedAt).toISOString().slice(0, 10);
      const r = m.get(d) ?? { score: 0, items: [] };
      r.score += n.sentiment === "positive" ? 1 : n.sentiment === "negative" ? -1 : 0;
      r.items.push({ title: n.title, tone: n.sentiment, url: n.url });
      m.set(d, r);
    }
    return m;
  }, [headlines]);

  const issuers = useMemo(() => {
    const m = new Map<string, { inflow: number; outflow: number; lastDate: string | null; missingLatest: boolean }>();
    for (const d of days) for (const [t, v] of Object.entries(d.flows)) {
      const r = m.get(t) ?? { inflow: 0, outflow: 0, lastDate: null, missingLatest: true };
      if (v >= 0) r.inflow += v; else r.outflow += v;
      if (v !== 0 || d.date === latestDate) r.lastDate = d.date;
      m.set(t, r);
    }
    const last = days[days.length - 1];
    return [...m.entries()].map(([t, r]) => {
      const has = last ? t in last.flows : false;
      const lag = r.lastDate ? bizDaysBetween(r.lastDate, latestDate) : 99;
      const status = !has ? "missing" : lag >= 3 ? "stale" : "ok";
      return { t, name: issuerName(t), inflow: r.inflow, outflow: r.outflow, net: r.inflow + r.outflow, lastDate: r.lastDate, status };
    }).sort((a, b) => b.inflow - b.outflow - (a.inflow - a.outflow)).slice(0, 10);
  }, [days, latestDate]);
  const imax = Math.max(1, ...issuers.map((i) => Math.max(i.inflow, -i.outflow)));
  const feedStale = latestDate ? bizDaysBetween(latestDate, new Date().toISOString().slice(0, 10)) > 2 : false;

  const rows = days.map((d) => {
    const p = price.data?.[d.date];
    const nd = newsByDay.get(d.date);
    const news = nd ? Math.sign(nd.score) : 0;
    return {
      ...d, priceChg: p ?? null, news,
      diverged: p != null && Math.abs(d.total) > 5 && Math.sign(p) !== Math.sign(d.total),
      conflict: news !== 0 && Math.abs(d.total) > 5 && news !== Math.sign(d.total),
    };
  });
  const withPrice = rows.filter((r) => r.priceChg != null);
  const div = withPrice.filter((r) => r.diverged);
  const fmax = Math.max(1, ...rows.map((r) => Math.abs(r.total)));
  const pmax = Math.max(0.5, ...withPrice.map((r) => Math.abs(r.priceChg!)));
  const totalIn = rows.reduce((a, r) => a + Math.max(0, r.total), 0), totalOut = rows.reduce((a, r) => a + Math.min(0, r.total), 0);

  const ai = useMutation({
    mutationFn: () => analyzeDivergence({ data: { days: withPrice.map((r) => ({ date: r.date, flow: r.total, priceChg: r.priceChg ?? 0 })), headlines: rows.flatMap((r) => (newsByDay.get(r.date)?.items ?? []).slice(0, 2).map((n) => `${r.date}: ${n.title}`)).slice(-60) } }),
  });

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportDivergencePdf({
        source, updated, rows, issuers, ai: ai.data,
        headlines: headlines.map((n) => ({ date: new Date(n.publishedAt).toISOString().slice(0, 10), title: n.title, tone: n.sentiment })),
      });
    } finally { setExporting(false); }
  };

  const W = 320, H = 150, TOPH = 18, CH = H - TOPH, bw = W / Math.max(1, rows.length), mid = TOPH + CH / 2;
  const selRow = rows.find((r) => r.date === sel);
  return (
    <div className="panel min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">30-day ETF flows</h2>
        <span className="font-mono text-[11px]"><span className="text-bull">+{totalIn.toFixed(0)}M</span> / <span className="text-bear">{totalOut.toFixed(0)}M</span></span>
      </div>
      <p className="mb-3 text-[10px] text-muted-foreground">
        Source: <b className="text-foreground">{source}</b> · updated {updated}
        {live && latestDate && <> · latest day {latestDate}{feedStale && <span className="flag flag-stale ml-1">stale</span>}</>}
        {!live && <> · {hist.data?.error ? `${hist.data.error}. ` : ""}<button onClick={onConfigure} className="text-primary underline underline-offset-2">Configure CoinGlass</button></>}
      </p>

      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Top 10 issuers · outflow | inflow</h3>
      {issuers.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">No per-issuer flows returned.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {issuers.map((i) => (
            <li key={i.t}>
              <div className="grid grid-cols-[4.5rem_1fr_1fr_3.5rem] items-center gap-1">
                <div className="truncate"><span className="font-mono text-[11px] font-semibold text-foreground">{i.t}</span> <span className="text-[9px] text-muted-foreground">{i.name}</span></div>
                <div className="flex h-2 justify-end rounded-l-full bg-muted"><div className="h-2 rounded-l-full bg-bear" style={{ width: `${(-i.outflow / imax) * 100}%` }} /></div>
                <div className="h-2 rounded-r-full bg-muted"><div className="h-2 rounded-r-full bg-bull" style={{ width: `${(i.inflow / imax) * 100}%` }} /></div>
                <div className={`text-right font-mono text-[10px] ${i.net >= 0 ? "text-bull" : "text-bear"}`}>{i.net >= 0 ? "+" : ""}{i.net.toFixed(0)}M</div>
              </div>
              <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                {live ? hist.data!.provider : "sample"} · last value {i.lastDate ?? "—"}
                {i.status !== "ok" && <span className={`flag flag-${i.status} ml-1`}>{i.status}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeline · flows, price & news</h3>
      <p className="mb-2 text-[10px] text-muted-foreground" aria-live="polite">
        {newsHistory.isPending ? "Loading 30-day news history…" : newsHistory.isError || newsHistory.data?.failedWindows === 5 ? "News archive unavailable · recent headlines only." : <>
          News archive: Google News · {newsHistory.data?.startDate}–{newsHistory.data?.endDate} (UTC) · {headlines.length} available headlines
          {(newsHistory.data?.failedWindows ?? 0) > 0 && <span className="text-conflict"> · partial coverage</span>}
        </>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mb-1 w-full cursor-pointer">
        <line x1="0" x2={W} y1={mid} y2={mid} className="stroke-border" />
        {rows.map((r, i) => {
          const h = (Math.abs(r.total) / fmax) * (CH / 2 - 4);
          return (
            <g key={r.date} onClick={() => setSel(r.date === sel ? null : r.date)}>
              <rect x={i * bw} y="0" width={bw} height={H} className={r.conflict ? "fill-conflict/25" : r.diverged ? "fill-wall/15" : "fill-transparent"} />
              {r.date === sel && <rect x={i * bw} y="0" width={bw} height={H} className="fill-foreground/10" />}
              <rect x={i * bw + 1} y={r.total >= 0 ? mid - h : mid} width={Math.max(1, bw - 2)} height={h} className={r.total >= 0 ? "fill-bull" : "fill-bear"} opacity={0.8} />
              {r.news !== 0 && <circle cx={i * bw + bw / 2} cy={8} r={3.5} className={r.news > 0 ? "fill-bull" : "fill-bear"} />}
              {r.conflict && <text x={i * bw + bw / 2} y={17} textAnchor="middle" className="fill-conflict text-[7px] font-bold">!</text>}
            </g>
          );
        })}
        <polyline fill="none" strokeWidth="1.5" className="pointer-events-none stroke-foreground"
          points={rows.map((r, i) => (r.priceChg == null ? null : `${i * bw + bw / 2},${mid - (r.priceChg / pmax) * (CH / 2 - 4)}`)).filter(Boolean).join(" ")} />
      </svg>
      <p className="mb-2 text-[10px] text-muted-foreground">
        Bars = ETF flow · line = BTC % · dots = news tone · <span className="text-conflict">amber ! = news and flows point opposite</span> · red shade = price vs flow. Tap a day.
      </p>
      {selRow && (
        <div className="mb-3 rounded-md bg-secondary p-2 text-[11px]">
          <div className="font-mono text-foreground">{selRow.date}: <span className={selRow.total >= 0 ? "text-bull" : "text-bear"}>{selRow.total >= 0 ? "+" : ""}{selRow.total.toFixed(0)}M</span>
            {selRow.priceChg != null && <> · BTC <span className={selRow.priceChg >= 0 ? "text-bull" : "text-bear"}>{selRow.priceChg.toFixed(2)}%</span></>}
            {selRow.conflict && <span className="flag flag-conflict ml-1">news ≠ flow</span>}
          </div>
          <ul className="mt-1 space-y-1">
            {(newsByDay.get(selRow.date)?.items ?? []).slice(0, 5).map((n) => (
              <li key={n.url}><a href={n.url} target="_blank" rel="noreferrer" className={n.tone === "positive" ? "text-bull" : n.tone === "negative" ? "text-bear" : "text-foreground"}>{n.title}</a></li>
            ))}
            {!newsByDay.get(selRow.date) && <li className="text-muted-foreground">{newsHistory.isPending ? "Loading historical headlines…" : newsHistory.isError || (newsHistory.data?.failedWindows ?? 0) > 0 ? "Headlines unavailable for this day; archive coverage is incomplete." : selRow.date < (newsHistory.data?.startDate ?? "") ? "This day is outside the 30-calendar-day news archive." : "No Bitcoin headlines returned for this day."}</li>}
          </ul>
        </div>
      )}

      <div className="mb-3 rounded-md bg-secondary p-3">
        <div className="font-mono text-xs text-foreground">
          {withPrice.length ? <>Price disagreed with flows on <b className="text-wall">{div.length} of {withPrice.length}</b> days · news conflicted on <b className="text-conflict">{rows.filter((r) => r.conflict).length}</b></> : "Loading price data…"}
        </div>
        <ul className="mt-2 space-y-1">
          {rows.filter((r) => r.diverged || r.conflict).slice(-6).reverse().map((r) => (
            <li key={r.date} className="font-mono text-[10px] text-muted-foreground">
              {r.date}: <span className={r.total >= 0 ? "text-bull" : "text-bear"}>{r.total >= 0 ? "inflow +" : "outflow "}{r.total.toFixed(0)}M</span>
              {r.priceChg != null && <> · BTC <span className={r.priceChg >= 0 ? "text-bull" : "text-bear"}>{r.priceChg >= 0 ? "+" : ""}{r.priceChg.toFixed(2)}%</span></>}
              {r.conflict && <span className="text-conflict"> · news {r.news > 0 ? "positive" : "negative"}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <button className="btn-chip btn-chip-active" disabled={ai.isPending || !withPrice.length} onClick={() => ai.mutate()}>
          {ai.isPending ? "Analyzing…" : "AI: why flows & news didn't match"}
        </button>
        <button className="btn-chip" disabled={exporting} onClick={exportPdf}>{exporting ? "Building PDF…" : "Export PDF"}</button>
      </div>
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
