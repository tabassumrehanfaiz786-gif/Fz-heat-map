import { useQuery } from "@tanstack/react-query";
import { getEtfFlows } from "@/lib/etf.functions";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";

export function EtfFlows({ onConfigure }: { onConfigure: () => void }) {
  const { etfProvider } = useSettings();
  const q = useQuery({ queryKey: ["etf", etfProvider], queryFn: () => getEtfFlows({ data: { provider: etfProvider } }), refetchInterval: 300_000 });
  const live = q.data?.configured && !q.data.error && q.data.rows.length > 0;
  const rows = live ? (q.data?.rows ?? []).slice(0, 10) : [];
  const net = rows.reduce((a, e) => a + e.today, 0);
  const max = Math.max(1, ...rows.map((e) => Math.abs(e.week)));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">Spot BTC ETF flows</h2>
        <span className={`font-mono text-sm ${net >= 0 ? "text-bull" : "text-bear"}`}>{live ? `${net >= 0 ? "+" : ""}$${net.toFixed(1)}M` : "—"}</span>
      </div>
      <ul className="space-y-2">
        {rows.map((e) => (
          <li key={e.ticker} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2">
            <div>
              <div className="font-mono text-xs font-semibold text-foreground">{e.ticker}</div>
              <div className="truncate text-[10px] text-muted-foreground">{e.issuer}</div>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${e.week >= 0 ? "bg-bull" : "bg-bear"}`} style={{ width: `${(Math.abs(e.week) / max) * 100}%` }} />
            </div>
            <div className={`text-right font-mono text-xs ${e.today >= 0 ? "text-bull" : "text-bear"}`}>{e.today >= 0 ? "+" : ""}{e.today.toFixed(1)}M</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {live ? (
           <>Daily reports from {q.data?.provider}{q.data?.date ? ` · ${q.data.date}` : ""}. Bar = 5-day net flow.</>
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
