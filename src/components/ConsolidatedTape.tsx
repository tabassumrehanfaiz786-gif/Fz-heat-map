import { useEffect, useRef, useState } from "react";
import { computeNbbo, type VenueQuote } from "@/lib/nbbo";

type Trade = { venue: string; p: number; q: number; side: "buy" | "sell"; ts: number };
type Venue = { name: string; url: string; sub?: unknown; parse: (d: any, push: (q: Partial<VenueQuote>) => void, trade: (t: Omit<Trade, "venue">) => void) => void };

const VENUES: Venue[] = [
  {
    name: "Binance", url: "wss://data-stream.binance.vision/stream?streams=btcusdt@bookTicker/btcusdt@aggTrade",
    parse: (m, push, trade) => {
      const d = m.data; if (!d) return;
      if (m.stream?.endsWith("bookTicker")) push({ bid: +d.b, ask: +d.a, bidQty: +d.B, askQty: +d.A });
      else trade({ p: +d.p, q: +d.q, side: d.m ? "sell" : "buy", ts: d.T });
    },
  },
  {
    name: "Coinbase", url: "wss://ws-feed.exchange.coinbase.com",
    sub: { type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] },
    parse: (d, push, trade) => {
      if (d.type !== "ticker") return;
      push({ bid: +d.best_bid, ask: +d.best_ask, bidQty: +d.best_bid_size, askQty: +d.best_ask_size });
      if (d.last_size) trade({ p: +d.price, q: +d.last_size, side: d.side === "buy" ? "buy" : "sell", ts: Date.parse(d.time) || Date.now() });
    },
  },
  {
    name: "OKX", url: "wss://ws.okx.com:8443/ws/v5/public",
    sub: { op: "subscribe", args: [{ channel: "bbo-tbt", instId: "BTC-USDT" }, { channel: "trades", instId: "BTC-USDT" }] },
    parse: (d, push, trade) => {
      const ch = d.arg?.channel, x = d.data?.[0]; if (!x) return;
      if (ch === "bbo-tbt") push({ bid: +x.bids[0][0], ask: +x.asks[0][0], bidQty: +x.bids[0][1], askQty: +x.asks[0][1] });
      else if (ch === "trades") for (const t of d.data) trade({ p: +t.px, q: +t.sz, side: t.side, ts: +t.ts });
    },
  },
  {
    name: "Kraken", url: "wss://ws.kraken.com/v2",
    sub: { method: "subscribe", params: { channel: "ticker", symbol: ["BTC/USD"], event_trigger: "bbo" } },
    parse: (d, push) => {
      const x = d.channel === "ticker" ? d.data?.[0] : null; if (!x) return;
      push({ bid: +x.bid, ask: +x.ask, bidQty: +x.bid_qty, askQty: +x.ask_qty });
    },
  },
];

const fmt = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));

export function ConsolidatedTape() {
  const quotes = useRef(new Map<string, VenueQuote>());
  const tape = useRef<Trade[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [, tick] = useState(0);
  const [minBtc, setMinBtc] = useState(0.5);
  const [crossings, setCrossings] = useState(0);

  useEffect(() => {
    let alive = true;
    const sockets: WebSocket[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const open = (v: Venue, attempt = 0) => {
      if (!alive) return;
      const ws = new WebSocket(v.url);
      sockets.push(ws);
      setStatus((s) => ({ ...s, [v.name]: "connecting" }));
      ws.onopen = () => { setStatus((s) => ({ ...s, [v.name]: "live" })); if (v.sub) ws.send(JSON.stringify(v.sub)); attempt = 0; };
      ws.onmessage = (ev) => {
        try {
          v.parse(JSON.parse(ev.data),
            (q) => quotes.current.set(v.name, { ...(quotes.current.get(v.name) ?? { bid: 0, ask: 0 }), ...q, venue: v.name, ts: Date.now() } as VenueQuote),
            (t) => { tape.current.unshift({ ...t, venue: v.name }); if (tape.current.length > 400) tape.current.length = 400; });
        } catch { /* ignore malformed */ }
      };
      ws.onclose = () => {
        if (!alive) return;
        setStatus((s) => ({ ...s, [v.name]: "reconnecting" }));
        timers.push(setTimeout(() => open(v, attempt + 1), Math.min(15000, 1000 * 2 ** attempt)));
      };
    };
    VENUES.forEach((v) => open(v));
    const iv = setInterval(() => {
      const n = computeNbbo([...quotes.current.values()], Date.now());
      if (n.state === "crossed") setCrossings((c) => c + 1);
      tick((x) => x + 1);
    }, 500);
    return () => { alive = false; clearInterval(iv); timers.forEach(clearTimeout); sockets.forEach((s) => s.close()); };
  }, []);

  const n = computeNbbo([...quotes.current.values()], Date.now());
  const trades = tape.current.filter((t) => t.q >= minBtc).slice(0, 40);
  const stateCls = n.state === "crossed" ? "text-bear" : n.state === "locked" ? "text-wall" : "text-bull";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 text-xs">
      <div className="font-semibold">Consolidated tape · synthetic NBBO</div>
      <div className="grid grid-cols-3 gap-2 rounded border border-border p-2 font-mono">
        <div><div className="text-muted-foreground">Best bid</div><div className="text-bull text-sm">{fmt(n.bestBid?.bid)}</div><div className="text-muted-foreground">{n.bestBid?.venue ?? "—"}</div></div>
        <div className="text-center"><div className="text-muted-foreground">Spread</div><div className={`text-sm ${stateCls}`}>{fmt(n.spread, 2)}</div><div className={`uppercase ${stateCls}`}>{n.state}</div></div>
        <div className="text-right"><div className="text-muted-foreground">Best ask</div><div className="text-bear text-sm">{fmt(n.bestAsk?.ask)}</div><div className="text-muted-foreground">{n.bestAsk?.venue ?? "—"}</div></div>
      </div>
      <div className="text-muted-foreground">Mid {fmt(n.mid, 2)} · crossed snapshots this session: {crossings}</div>

      <table className="w-full font-mono">
        <thead className="text-muted-foreground"><tr className="text-left"><th>Venue</th><th className="text-right">Bid</th><th className="text-right">Ask</th><th className="text-right">Spr</th><th className="text-right">Status</th></tr></thead>
        <tbody>
          {VENUES.map((v) => {
            const q = quotes.current.get(v.name);
            const stale = n.stale.includes(v.name);
            return (
              <tr key={v.name} className="border-t border-border">
                <td className="py-1">{v.name}<div className="text-[10px] text-muted-foreground">{v.name === "Coinbase" || v.name === "Kraken" ? "BTC-USD" : "BTC-USDT"}</div></td>
                <td className={`text-right ${n.bestBid?.venue === v.name ? "text-bull font-semibold" : ""}`}>{fmt(q?.bid)}</td>
                <td className={`text-right ${n.bestAsk?.venue === v.name ? "text-bear font-semibold" : ""}`}>{fmt(q?.ask)}</td>
                <td className="text-right">{q ? fmt(q.ask - q.bid, 2) : "—"}</td>
                <td className={`text-right ${status[v.name] === "live" && !stale ? "text-bull" : "text-bear"}`}>{stale && q ? "stale" : status[v.name] ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between pt-1">
        <span className="font-semibold">Merged trade tape</span>
        <label className="flex items-center gap-1 text-muted-foreground">min BTC
          <select value={minBtc} onChange={(e) => setMinBtc(+e.target.value)} className="rounded border border-border bg-background px-1">
            {[0, 0.1, 0.5, 1, 5, 10].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="font-mono">
        {trades.length === 0 && <div className="text-muted-foreground">Waiting for trades ≥ {minBtc} BTC…</div>}
        {trades.map((t, i) => (
          <div key={i} className={`flex justify-between border-t border-border py-0.5 ${t.side === "buy" ? "text-bull" : "text-bear"}`}>
            <span className="w-16 text-muted-foreground">{new Date(t.ts).toLocaleTimeString()}</span>
            <span className="w-16">{t.venue}</span>
            <span>{fmt(t.p)}</span>
            <span className="w-14 text-right">{t.q.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Synthetic, not a regulated NBBO. Top-of-book quotes from public feeds of Binance and OKX (USDT) and Coinbase and Kraken (USD) are compared as-is; USDT/USD basis, fees and network latency mean small "crossed" readings are often not executable arbitrage. Quotes older than 5 seconds are excluded. Kraken trades are not included in the tape. Timestamps use your device clock.
      </p>
    </div>
  );
}
