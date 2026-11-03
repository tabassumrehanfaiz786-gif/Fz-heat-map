import { useEffect, useRef, useState } from "react";
import { IcebergDetector, detectTwap, liquidityAsymmetry, type IcebergEvent, type TwapEvent, type Trade } from "@/lib/surveillance-algo";

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const ago = (t: number) => `${Math.max(0, Math.round((Date.now() - t) / 1000))}s ago`;

type Status = "connecting" | "live" | "rest" | "reconnecting" | "offline";

export function Surveillance() {
  const [ice, setIce] = useState<IcebergEvent[]>([]);
  const [twap, setTwap] = useState<TwapEvent[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [blocked, setBlocked] = useState(false);
  const det = useRef(new IcebergDetector(1, 0.5));
  const trades = useRef<Trade[]>([]);
  const bids = useRef(new Map<number, number>());
  const asks = useRef(new Map<number, number>());
  const [, forceTick] = useState(0);

  useEffect(() => {
    const WS_URLS = [
      "wss://data-stream.binance.vision/stream?streams=btcusdt@aggTrade/btcusdt@depth20@100ms",
      "wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/btcusdt@depth20@100ms",
      "wss://stream.binance.com:443/stream?streams=btcusdt@aggTrade/btcusdt@depth20@100ms",
    ];
    const REST_BASES = ["https://data-api.binance.vision", "https://api.binance.com"];

    let ws: WebSocket | null = null;
    let alive = true;
    let attempt = 0;
    let restBase = 0;
    let lastAggId = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let restTimer: ReturnType<typeof setInterval> | undefined;

    const processTrade = (t: Trade) => {
      const book = t.side === "sell" ? bids.current : asks.current;
      const lvl = Math.round(t.price);
      let vis = 0;
      for (const [p, q] of book) if (Math.round(p) === lvl) vis += q;
      det.current.onTrade(t, vis);
      trades.current.push(t);
      const cut = Date.now() - 10 * 60_000;
      if (trades.current.length > 20000 || (trades.current[0] && trades.current[0].time < cut)) {
        trades.current = trades.current.filter((x) => x.time >= cut).slice(-20000);
      }
    };

    const aggRows = (rows: string[][]) => {
      const m = new Map<number, number>();
      for (const [p = "0", q = "0"] of rows) {
        const k = Math.round(+p);
        m.set(k, (m.get(k) ?? 0) + +q);
      }
      return m;
    };

    const processBook = (raw: { bids?: string[][]; asks?: string[][] }) => {
      bids.current = aggRows(raw.bids ?? []);
      asks.current = aggRows(raw.asks ?? []);
      det.current.onBook(bids.current, asks.current, Date.now());
    };

    // REST fallback: works when WebSocket connections are blocked by the network.
    const restPoll = async () => {
      if (!alive) return;
      try {
        const base = REST_BASES[restBase % REST_BASES.length]!;
        const [trRes, deRes] = await Promise.all([
          fetch(`${base}/api/v3/aggTrades?symbol=BTCUSDT&limit=100`),
          fetch(`${base}/api/v3/depth?symbol=BTCUSDT&limit=20`),
        ]);
        if (!trRes.ok || !deRes.ok) throw new Error(`http ${trRes.status}/${deRes.status}`);
        const td = (await trRes.json()) as Array<{ a: number; p: string; q: string; T: number; m: boolean }>;
        const dd = (await deRes.json()) as { bids: string[][]; asks: string[][] };
        for (const d of td) {
          if (d.a <= lastAggId) continue;
          lastAggId = d.a;
          processTrade({ price: +d.p, qty: +d.q, time: d.T, side: d.m ? "sell" : "buy" });
        }
        processBook(dd);
        setBlocked(false);
        setStatus((s) => (s === "live" ? s : "rest"));
      } catch {
        restBase++;
        setStatus((s) => (s === "live" ? s : "offline"));
        setBlocked(true);
      }
    };

    const startRest = () => {
      if (restTimer || !alive) return;
      void restPoll();
      restTimer = setInterval(() => void restPoll(), 3000);
    };
    const stopRest = () => {
      if (restTimer) clearInterval(restTimer);
      restTimer = undefined;
    };

    const connect = () => {
      if (!alive) return;
      const sock = new WebSocket(WS_URLS[attempt % WS_URLS.length]!);
      ws = sock;
      sock.onopen = () => {
        attempt = 0;
        stopRest();
        setStatus("live");
      };
      sock.onclose = () => {
        if (!alive) return;
        attempt++;
        setStatus((s) => (s === "live" ? "reconnecting" : s === "live" ? s : "reconnecting"));
        if (attempt >= 2) startRest();
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      };
      sock.onerror = () => sock.close();
      sock.onmessage = onMsg;
    };

    const onMsg = (m: MessageEvent) => {
      const { stream, data } = JSON.parse(m.data);
      if (stream.endsWith("aggTrade")) {
        processTrade({ price: +data.p, qty: +data.q, time: data.T, side: data.m ? "sell" : "buy" });
      } else {
        processBook(data);
      }
    };

    const id = setInterval(() => {
      setIce(det.current.events(Date.now()).slice(0, 20));
      setTwap(detectTwap(trades.current.filter((t) => t.qty >= 0.05)).slice(0, 10));
      forceTick((n) => n + 1);
    }, 2000);

    connect();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setBlocked(true);
      startRest();
    }

    const wake = () => {
      if (document.visibilityState === "visible" && ws && ws.readyState > 1) {
        clearTimeout(retry);
        attempt = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      alive = false;
      clearTimeout(retry);
      stopRest();
      clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      ws?.close();
    };
  }, []);

  const manualRetry = () => {
    setBlocked(false);
    forceTick((n) => n + 1);
    window.location.reload();
  };

  const asym = liquidityAsymmetry(ice);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Algo Surveillance</h2>
        <span className={status === "live" ? "text-bull" : status === "rest" ? "text-muted-foreground" : "text-bear"}>
          ● {status === "rest" ? "live (rest)" : status}
        </span>
      </div>

      {blocked && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <p className="font-semibold text-destructive">Live exchange data is blocked on this network</p>
          <p className="mt-1 text-muted-foreground">
            Exchange streams are unreachable from your connection, so detections cannot update. Try another network
            (mobile data), disable a VPN/ad-blocker for this site, or retry.
          </p>
          <button className="btn-chip mt-2" onClick={manualRetry}>Retry connection</button>
        </div>
      )}

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
