import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { getPublicBitcoin } from "@/lib/public-bitcoin.functions";
import { largeTransactions } from "@/lib/public-bitcoin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MempoolRadar() {
  const [minimum, setMinimum] = useState(50);
  const query = useQuery({ queryKey: ["public-bitcoin"], queryFn: () => getPublicBitcoin(), refetchInterval: 30_000 });
  const data = query.data?.data;
  const transactions = largeTransactions(data?.transactions ?? [], minimum);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-xs">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold"><Activity className="h-4 w-4 text-primary" />Bitcoin mempool</h2>
        <Button size="icon" variant="ghost" title="Refresh Bitcoin data" aria-label="Refresh Bitcoin data" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button>
      </header>
      <p role="status" className="text-muted-foreground">
        {query.isPending ? "Connecting to mempool.space…" : query.isError || query.data?.error ? <span className="text-bear">{query.data?.error ?? "Bitcoin feed unavailable. Retry shortly."}</span> : data ? <><span className="text-bull">Public feed connected · no API key</span><br />mempool.space · fetched {new Date(data.fetchedAt).toLocaleTimeString()}</> : "No Bitcoin data returned."}
      </p>
      {data && <>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-border py-3 font-mono">
          <div><dt className="text-muted-foreground">Pending transactions</dt><dd className="mt-1 text-base">{data.count.toLocaleString()}</dd></div>
          <div><dt className="text-muted-foreground">Mempool size</dt><dd className="mt-1 text-base">{(data.vsize / 1e6).toFixed(2)} MvB</dd></div>
          <div><dt className="text-muted-foreground">Fastest fee</dt><dd className="mt-1 text-primary">{data.fees.fastestFee} sat/vB</dd></div>
          <div><dt className="text-muted-foreground">1-hour fee</dt><dd className="mt-1">{data.fees.hourFee} sat/vB</dd></div>
        </dl>
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Large-output radar</h3>
            <div className="flex items-center gap-2"><Label htmlFor="minimum-output" className="text-xs">Min BTC</Label><Input id="minimum-output" type="number" min={1} step={10} value={minimum} className="h-8 w-20" onChange={e => setMinimum(Math.max(1, Number(e.target.value) || 1))} /></div>
          </div>
          <p className="mb-2 text-[10px] text-muted-foreground">Latest {data.sampled} transactions only · output totals include change · not a complete whale feed.</p>
          <ul className="space-y-2">
            {transactions.map(t => <li key={t.txid} className="border-b border-border pb-2">
              <div className="flex justify-between gap-2"><span className="font-mono text-primary">{t.outputBtc.toLocaleString(undefined, { maximumFractionDigits: 4 })} BTC</span><span className="text-conflict">Unconfirmed</span></div>
              <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 font-mono text-muted-foreground">{t.txid.slice(0, 12)}…{t.txid.slice(-8)}<ExternalLink className="h-3 w-3" /></a>
              <p className="mt-1 text-[10px] text-muted-foreground">{(t.fee / Math.max(1, t.vsize)).toFixed(1)} sat/vB · owner unknown · buy/sell unknown</p>
            </li>)}
          </ul>
          {transactions.length === 0 && <p className="py-3 text-muted-foreground">No outputs ≥ {minimum} BTC in this recent sample. This does not mean no large transfers occurred.</p>}
        </section>
      </>}
      <section className="border-t border-border pt-3">
        <h3 className="mb-1 font-semibold">OTC desks & institutional attribution</h3>
        <p className="text-muted-foreground">Unavailable from this public feed. Bitcoin transactions do not identify BlackRock, Coinbase Prime, an OTC execution, or a trade direction.</p>
      </section>
      <p className="text-[10px] text-muted-foreground">ETF reports are daily USD flows; this is a recent network sample, not institutional net flow or 30-day wallet history. Comparing them cannot verify an issuer’s purchase or sale.</p>
    </div>
  );
}