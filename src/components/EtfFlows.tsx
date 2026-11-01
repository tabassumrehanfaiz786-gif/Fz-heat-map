import { useQuery } from "@tanstack/react-query";
import { getEtfFlows, getEtfHistory } from "@/lib/etf.functions";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";

function TenDayChart({ provider }: { provider: string }) {
  const q = useQuery({ queryKey: ["etf-history-10d", provider], queryFn: () => getEtfHistory({ data: { provider } }), refetchInterval: 300_000 });
  const days = (q.data?.days ?? []).slice(-10);
  if (q.isPending) return <p className="mt-3 text-[10px] text-muted-foreground">Loading 10-day net flows…</p>;
  if (!days.length) return null;
  const max = Math.max(1, ...days.map((d) => Math.abs(d.total)));
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Net flows · last {days.length} days ($M)</span>
        <span className="text-[9px] text-muted-foreground"><span className="text-bull">■</span> inflow <span className="text-bear">■</span> outflow</span>
      </div>
      <div className="flex items-end gap-1">
        {days.map((d) => {
          const h = Math.max(2, (Math.abs(d.total) / max) * 72);
          return (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-0.5" title={`${d.date}: ${d.total >= 0 ? "+" : ""}$${d.total.toFixed(1)}M`}>
              <span className={`font-mono text-[8px] leading-none ${d.total >= 0 ? "text-bull" : "text-bear"}`}>{d.total >= 0 ? "+" : ""}{d.total.toFixed(0)}</span>
              <div className={`w-full rounded-sm ${d.total >= 0 ? "bg-bull" : "bg-bear"}`} style={{ height: `${h}px` }} />
              <span className="font-mono text-[8px] leading-none text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EtfFlows({ onConfigure }: { onConfigure: () => void }) {
  const { etfProvider } = useSettings();
  const q = useQuery({ queryKey: ["etf", etfProvider], queryFn: () => getEtfFlows({ data: { provider: etfProvider } }), refetchInterval: 300_000 });
  const live = q.data?.configured && !q.data.error && q.data.rows.length > 0;
  const rows = live ? (q.data?.rows ?? []) : [];
  const net = q.data?.total !== undefined ? q.data.total : rows.every((row) => row.today !== null) ? rows.reduce((a, e) => a + (e.today ?? 0), 0) : null;
  const max = Math.max(1, ...rows.map((e) => Math.abs(e.week)));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">Spot BTC ETF flows</h2>
        <span className={`font-mono text-sm ${net !== null && net >= 0 ? "text-bull" : "text-bear"}`}>{live && net !== null ? `${net >= 0 ? "+" : ""}$${net.toFixed(1)}M` : "—"}</span>
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {rows.map((e) => (
          <li key={e.ticker} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2">
            <div>
              <div className="font-mono text-xs font-semibold text-foreground">{e.ticker}</div>
              <div className="truncate text-[10px] text-muted-foreground" title={e.issuer}>{e.issuer}</div>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${e.week >= 0 ? "bg-bull" : "bg-bear"}`} style={{ width: `${(Math.abs(e.week) / max) * 100}%` }} />
            </div>
            <div className={`text-right font-mono text-xs ${e.today === null ? "text-muted-foreground" : e.today >= 0 ? "text-bull" : "text-bear"}`}>{e.today === null ? "Missing" : `${e.today >= 0 ? "+" : ""}${e.today.toFixed(1)}M`}{!!e.missingDays && <span className="block text-[9px] text-conflict">Partial bar</span>}</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {live ? (
           <>Source: {q.data?.sourceUrl ? <a href={q.data.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">{q.data.provider}</a> : q.data?.provider} · Reported day: {q.data?.date ?? "missing"}. Bar = last 5 available reports.
             {q.data?.fetchedAt && <span className="block">Checked: {new Date(q.data.fetchedAt).toLocaleString()} · Source update time: not published.</span>}
             {etfProvider === "public" && <span className="block">Holdings-change estimates, not execution records. {q.data?.coverageDays} reported days available; missing weekdays (holidays or pending reports included): {q.data?.missingDates?.join(", ") || "none"}. Missing figures are not zero.</span>}
           </>
        ) : (
          <>
             {q.isPending ? "Checking ETF provider… " : q.data?.error ? `${q.data.error}. ` : "ETF flows unavailable without provider access. No sample figures shown. "}
             <a href="https://farside.co.uk/btc/" target="_blank" rel="noreferrer" className="text-primary underline">View free public ETF table</a>
             <Button onClick={onConfigure} variant="link" size="sm" className="h-auto px-0 text-[10px]">Provider settings</Button>
          </>
        )}
      </p>
    </div>
  );
}
