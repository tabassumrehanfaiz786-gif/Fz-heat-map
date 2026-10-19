import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getVaultFlows } from "@/lib/arkham.functions";
import { getEtfHistory } from "@/lib/etf.functions";
import { analyzeTripleVerification, type TripleResult } from "@/lib/ai.functions";
import { getBtcNewsHistory } from "@/lib/news.functions";
import { entityName, type VaultTransfer } from "@/lib/arkham-data";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const fmtUsd = (n: number) => `${n < 0 ? "-" : "+"}$${fmt(Math.abs(n) / 1e6, 1)}M`;

const SIGNAL_STYLE: Record<string, string> = {
  confirmed: "text-bull",
  "paper-disconnect": "text-bear",
  noise: "text-amber-400",
  unclear: "text-muted-foreground",
};

function TransferRow({ t }: { t: VaultTransfer }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex justify-between gap-2">
        <span className="font-medium">{entityName(t.entityId)}</span>
        <span className={t.direction === "in" ? "text-bull" : "text-bear"}>{t.direction === "in" ? "+" : "-"}{fmt(t.direction === "in" ? t.btc : -t.btc)} BTC</span>
      </div>
      <div className="text-muted-foreground">
        {t.direction === "in" ? "from" : "to"} {t.counterparty} · {fmtUsd(t.direction === "in" ? t.usd : -t.usd)} · {new Date(t.time).toLocaleString()}
      </div>
    </div>
  );
}

export function VaultTracker({ onConfigure }: { onConfigure: () => void }) {
  const s = useSettings();
  const queryClient = useQueryClient();
  const [ai, setAi] = useState<TripleResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const vaults = useQuery({ queryKey: ["vaults"], queryFn: () => getVaultFlows(), staleTime: 10 * 60_000 });
  const etf = useQuery({ queryKey: ["etf-hist", s.etfProvider], queryFn: () => getEtfHistory({ data: { provider: s.etfProvider } }), staleTime: 30 * 60_000 });
  const news = useQuery({ queryKey: ["news-history"], queryFn: () => getBtcNewsHistory(), staleTime: 60 * 60_000 });

  const data = vaults.data;
  const runAnalysis = async () => {
    if (!data) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const etfDays = new Map((etf.data?.days ?? []).map((d) => [d.date, d.total]));
      const headlinesByDate = new Map<string, string[]>();
      for (const n of news.data ?? []) {
        const date = new Date(n.publishedAt).toISOString().slice(0, 10);
        const list = headlinesByDate.get(date) ?? [];
        if (list.length < 3) list.push(n.title);
        headlinesByDate.set(date, list);
      }
      const days = data.days.map((d) => ({
        date: d.date,
        etfFlow: etfDays.get(d.date) ?? 0,
        onChainUsd: d.netUsd / 1e6,
        priceChg: 0,
        headlines: headlinesByDate.get(d.date) ?? [],
      }));
      setAi(await analyzeTripleVerification({ data: { days } }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI analysis failed. Try again.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="panel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">On-Chain Vaults</h2>
        <button
          className="text-muted-foreground hover:text-foreground"
          aria-label="Refresh vault data"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["vaults"] })}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${vaults.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p role="status" className="text-muted-foreground">
        {vaults.isLoading ? "Loading on-chain transfers…"
          : data?.error ? <span className="text-bear">{data.error}</span>
          : data?.configured ? <span className="text-bull">Live Arkham data · {data.transfers.length} transfers · updated {data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : "—"}</span>
          : <span>Sample transfers shown — <button className="underline" onClick={onConfigure}>add an Arkham API key</button> in Settings for live institutional wallets.</span>}
      </p>

      {data && data.days.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">Daily net on-chain flow</h3>
          <div className="space-y-0.5">
            {data.days.slice(-10).map((d) => {
              const max = Math.max(...data.days.map((x) => Math.abs(x.netUsd)), 1);
              const w = Math.max(2, (Math.abs(d.netUsd) / max) * 100);
              return (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">{d.date.slice(5)}</span>
                  <div className="relative h-3 flex-1">
                    <div className={`absolute top-0 h-3 rounded-sm ${d.netUsd >= 0 ? "bg-bull/70 left-1/2" : "bg-bear/70 right-1/2"}`} style={{ width: `${w / 2}%` }} />
                  </div>
                  <span className={`w-16 shrink-0 text-right ${d.netUsd >= 0 ? "text-bull" : "text-bear"}`}>{fmtUsd(d.netUsd)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-1 font-semibold">Recent institutional transfers <span className="text-muted-foreground">({data?.transfers.length ?? 0})</span></h3>
        <div className="space-y-1">
          {(data?.transfers ?? []).slice(0, 12).map((t) => <TransferRow key={t.txHash} t={t} />)}
          {data && data.transfers.length === 0 && !data.error && <p className="text-muted-foreground">No transfers in the last 30 days.</p>}
        </div>
      </section>

      <section className="border-t border-border pt-2">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">AI cross-verification</h3>
          <Button size="sm" variant="outline" disabled={aiBusy || !data || data.days.length === 0} onClick={runAnalysis}>
            <Sparkles className={aiBusy ? "animate-pulse" : ""} />{aiBusy ? "Analyzing…" : "Verify news × ETF × chain"}
          </Button>
        </div>
        {aiError && <p className="text-bear">{aiError}</p>}
        {ai && (
          <div className="space-y-1">
            <p className="text-muted-foreground">{ai.verdict}</p>
            {ai.days.map((d) => (
              <div key={d.date} className="rounded-md border border-border p-2">
                <div className="flex justify-between">
                  <span>{d.date}</span>
                  <span className={SIGNAL_STYLE[d.signal] ?? "text-muted-foreground"}>{d.signal}</span>
                </div>
                <p className="text-muted-foreground">{d.explanation}</p>
              </div>
            ))}
          </div>
        )}
        {!ai && !aiError && <p className="text-muted-foreground">Compares reported ETF flows, on-chain custodian movements and headlines, and flags days where the layers disagree.</p>}
      </section>

      <p className="text-[10px] text-muted-foreground">
        On-chain transfers show labeled wallet movements, not proof of a specific issuer's trade — custodians net flows internally and settlement lags reported ETF flows.
      </p>
    </div>
  );
}
