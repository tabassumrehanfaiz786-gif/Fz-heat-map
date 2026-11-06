import { useQuery } from "@tanstack/react-query";
import { getEtfInav } from "@/lib/etf-inav.functions";

export function EtfInav() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["etf-inav"], queryFn: () => getEtfInav(), refetchInterval: 60_000 });
  const rows = data?.rows ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Intraday iNAV & AP arbitrage</div>
          <div className="text-muted-foreground">BTC {data?.btcNow ? `$${data.btcNow.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} · checked {data ? new Date(data.checkedAt).toLocaleTimeString() : "—"} · refresh 60s</div>
        </div>
        <button onClick={() => refetch()} className="rounded border border-border px-2 py-1 hover:bg-muted">{isFetching ? "…" : "Refresh"}</button>
      </div>
      {isLoading && <div className="text-muted-foreground">Loading quotes…</div>}
      {data?.error && <div className="text-destructive">{data.error}</div>}
      <table className="w-full">
        <thead className="text-muted-foreground"><tr className="text-left"><th>ETF</th><th className="text-right">Price</th><th className="text-right">iNAV est.</th><th className="text-right">Prem/Disc</th><th className="text-right">AP signal</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-t border-border">
              <td className="py-1 font-medium">{r.ticker}<div className="text-[10px] text-muted-foreground">{new Date(r.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></td>
              <td className="text-right">${r.price.toFixed(2)}</td>
              <td className="text-right">${r.inav.toFixed(2)}</td>
              <td className={`text-right font-semibold ${r.premiumPct > 0 ? "text-bull" : r.premiumPct < 0 ? "text-bear" : ""}`}>{r.premiumPct > 0 ? "+" : ""}{r.premiumPct.toFixed(2)}%</td>
              <td className="text-right">{r.signal === "creation" ? <span className="text-bull">Create → buy BTC</span> : r.signal === "redemption" ? <span className="text-bear">Redeem → sell BTC</span> : <span className="text-muted-foreground">In band</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!!data?.missing.length && <div className="text-muted-foreground">Missing: {data.missing.join(", ")}</div>}
      <p className="text-[10px] leading-snug text-muted-foreground">
        Estimate only. iNAV = live BTC-USD × BTC per share, where BTC per share is inferred from the ETF's previous close (assumed ≈ NAV) divided by BTC near 4pm ET. Not the issuer's official iNAV or benchmark. Quotes from Yahoo Finance may be delayed; outside US market hours the price is stale while BTC moves, so the gap reflects that. The ±0.25% "AP signal" shows when creation/redemption arbitrage would be economically motivated — it does not show that any Authorized Participant traded.
      </p>
    </div>
  );
}
