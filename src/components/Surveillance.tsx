import { useEffect, useRef, useState } from "react";
import { IcebergDetector, detectTwap, liquidityAsymmetry, type IcebergEvent, type TwapEvent, type Trade } from "@/lib/surveillance-algo";

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const ago = (t: number) => `${Math.max(0, Math.round((Date.now() - t) / 1000))}s ago`;

export function Surveillance() {
  const [ice, setIce] = useState<IcebergEvent[]>([]);
  const [twap, setTwap] = useState<TwapEvent[]>([]);
  const [status, setStatus] = useState("connecting");
  const det = useRef(new IcebergDetector(1, 0.5));
  const trades = useRef<Trade[]>([]);
  const bids = useRef(new Map<number, number>());
  const asks = useRef(new Map<number, number>());

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/btcusdt@depth20@100ms");
    ws.onopen = () => setStatus("live");
    ws.onclose = () => setStatus("disconnected");
    ws.onmessage = (m) => {
      const { stream, data } = JSON.parse(m.data);
      if (stream.endsWith("aggTrade")) {
        const t: Trade = { price: +data.p, qty: +data.q, time: data.T, side: data.m ? "sell" : "buy" };
        const book = t.side === "sell" ? bids.current : asks.current;
        const lvl = Math.round(t.price);
        let vis = 0; for (const [p, q] of book) if (Math.round(p) === lvl) vis += q;
        det.current.onTrade(t, vis);
        trades.current.push(t);
        const cut = Date.now() - 10 * 60_000;
        if (trades.current.length > 20000 || trades.current[0]!.time < cut) trades.current = trades.current.filter((x) => x.time >= cut).slice(-20000);
      } else {
        const agg = (rows: string[][]) => { const m = new Map<number, number>(); for (const [p = "0", q = "0"] of rows) { const k = Math.round(+p); m.set(k, (m.get(k) ?? 0) + +q); } return m; };
        bids.current = agg(data.bids); asks.current = agg(data.asks);
        det.current.onBook(bids.current, asks.current, Date.now());
      }
    };
    const id = setInterval(() => {
      setIce(det.current.events(Date.now()).slice(0, 20));
      setTwap(detectTwap(trades.current.filter((t) => t.qty >= 0.05)).slice(0, 10));
    }, 2000);
    return () => { clearInterval(id); ws.close(); };
  }, []);

  const asym = liquidityAsymmetry(ice);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Algo Surveillance</h2>
        <span className={status === "live" ? "text-bull" : "text-bear"}>● {status}</span>
      </div>
      <div className="rounded-md border border-border p-2">
        <div className="mb-1 flex justify-between text-muted-foreground"><span>Hidden liquidity asymmetry</span><span className={asym >= 0 ? "text-bull" : "text-bear"}>{fmt(asym * 100, 0)}%</span></div>
        <div className="relative h-2 rounded bg-muted"><div className="absolute top-0 h-2 w-1 rounded bg-primary" style={{ left: `${(asym + 1) * 50}%` }} /></div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Ask icebergs (sell pressure)</span><span>Bid absorption</span></div>
      </div>

      <section>
        <h3 className="mb-1 font-semibold">Iceberg orders <span className="text-muted-foreground">({ice.length})</span></h3>
        {ice.length === 0 && <p className="text-muted-foreground">Watching for levels refilling after execution exceeds 2.5× visible size…</p>}
        {ice.map((e) => (
          <div key={e.passiveSide + e.price} className="mb-1 rounded-md border border-border p-2">
            <div className="flex justify-between"><span className={e.passiveSide === "bid" ? "text-bull" : "text-bear"}>{e.passiveSide === "bid" ? "BID" : "ASK"} ${fmt(e.price, 0)}</span><span className="text-muted-foreground">{ago(e.lastSeen)}</span></div>
            <div className="text-muted-foreground">Filled {fmt(e.executed)} BTC (${fmt(e.executed * e.price / 1e6)}M) · visible {fmt(e.peakVisible)} · {fmt(e.ratio, 1)}× · {e.refills} refills</div>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-1 font-semibold">TWAP slicing <span className="text-muted-foreground">({twap.length})</span></h3>
        {twap.length === 0 && <p className="text-muted-foreground">Watching for 5+ equal-size fills at regular intervals (last 10 min)…</p>}
        {twap.map((e) => (
          <div key={e.side + e.start} className="mb-1 rounded-md border border-border p-2">
            <div className="flex justify-between"><span className={e.side === "buy" ? "text-bull" : "text-bear"}>{e.side.toUpperCase()} TWAP · {e.slices} slices</span><span className="text-muted-foreground">{ago(e.last)}</span></div>
            <div className="text-muted-foreground">~{fmt(e.avgSize, 3)} BTC every {fmt(e.intervalMs / 1000, 1)}s · total {fmt(e.totalQty)} BTC · VWAP ${fmt(e.vwap, 0)} · regularity {fmt(e.regularity * 100, 0)}%</div>
          </div>
        ))}
      </section>
      <p className="text-[10px] text-muted-foreground">Heuristic detection from public Binance trades and top-20 depth. Signals indicate probable algorithmic execution, not confirmed orders.</p>
    </div>
  );
}
