import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEtfHistory, issuerName } from "@/lib/etf.functions";
import { useSettings } from "@/lib/settings";
import { flowMarkers, WallTracker, type Candle, type WallEvent, type Side } from "@/lib/candle-lab";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"] as const;
type Interval = (typeof INTERVALS)[number];
const ISSUERS = ["IBIT", "TOTAL", "FBTC", "GBTC", "ARKB", "BITB"];
const MIN_PRESETS = [1, 5, 10, 25, 50, 100];
const MAX_PRESETS = [100, 1000, 10_000, 100_000];

function useCandles(interval: Interval) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let dead = false;
    setCandles([]);
    const binance = async (host: string) => {
      const r = await fetch(`${host}/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=1000`);
      const rows: (string | number)[][] = await r.json();
      if (!Array.isArray(rows) || !rows.length) throw new Error("empty");
      return rows.map((k) => ({ t: Number(k[0]), o: +k[1]!, h: +k[2]!, l: +k[3]!, c: +k[4]!, v: +k[5]! }));
    };
    const coinbase = async () => {
      const g: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 };
      const gran = g[interval]; if (!gran) throw new Error("unsupported");
      const r = await fetch(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${gran}`);
      const rows: number[][] = await r.json();
      if (!Array.isArray(rows) || !rows.length) throw new Error("empty");
      return rows.map((k) => ({ t: k[0]! * 1000, l: k[1]!, h: k[2]!, o: k[3]!, c: k[4]!, v: k[5]! })).reverse();
    };
    (async () => {
      for (const src of [() => binance("https://data-api.binance.vision"), () => binance("https://api.binance.com"), () => binance("https://api.binance.us"), coinbase]) {
        try { const c = await src(); if (!dead) setCandles(c); return; } catch { /* try next */ }
      }
    })();
    let ws: WebSocket;
    let tries = 0; let retry: ReturnType<typeof setTimeout> | undefined;
    const hosts = ["wss://data-stream.binance.vision/ws", "wss://stream.binance.com:9443/ws"];
    const connect = () => {
      ws = new WebSocket(`${hosts[tries++ % hosts.length]}/btcusdt@kline_${interval}`);
      ws.onopen = () => setLive(true);
      ws.onclose = () => { setLive(false); if (!dead) retry = setTimeout(connect, 3000); };
      ws.onmessage = onMsg;
    };
    const onMsg = (e: MessageEvent) => {
      const k = JSON.parse(e.data).k;
      if (!k) return;
      const c: Candle = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1]!;
        if (last.t === c.t) return [...prev.slice(0, -1), c];
        if (c.t > last.t) return [...prev, c];
        return prev;
      });
    };
    connect();
    return () => { dead = true; clearTimeout(retry); ws.close(); };
  }, [interval]);
  return { candles, live };
}

function useCoinbaseWalls(minBtc: number, maxBtc: number) {
  const tracker = useRef(new WallTracker(minBtc, maxBtc));
  const [walls, setWalls] = useState<{ side: Side; price: number; size: number }[]>([]);
  const [events, setEvents] = useState<WallEvent[]>([]);
  const [status, setStatus] = useState("connecting");
  useEffect(() => { tracker.current.minBtc = minBtc; tracker.current.maxBtc = maxBtc; setWalls(tracker.current.walls()); }, [minBtc, maxBtc]);
  useEffect(() => {
    let ws: WebSocket | null = null; let retry: ReturnType<typeof setTimeout> | undefined; let dead = false;
    const pending: WallEvent[] = [];
    const connect = () => {
      ws = new WebSocket("wss://advanced-trade-ws.coinbase.com");
      ws.onopen = () => {
        setStatus("live");
        ws!.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channel: "level2" }));
        ws!.send(JSON.stringify({ type: "subscribe", channel: "heartbeats" }));
      };
      ws.onclose = () => { setStatus("reconnecting"); if (!dead) retry = setTimeout(connect, 3000); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.channel !== "l2_data") return;
        for (const ev of msg.events ?? []) {
          const snap = ev.type === "snapshot";
          if (snap) { tracker.current.bids.clear(); tracker.current.asks.clear(); }
          for (const u of ev.updates ?? []) {
            const r = tracker.current.apply(u.side === "bid" ? "bid" : "ask", +u.price_level, +u.new_quantity, Date.now(), snap);
            if (r) pending.push(r);
          }
        }
      };
    };
    connect();
    const tick = setInterval(() => {
      setWalls(tracker.current.walls().slice(0, 40));
      if (pending.length) { const add = pending.splice(0); setEvents((p) => [...add.reverse(), ...p].slice(0, 300)); }
    }, 500);
    return () => { dead = true; clearTimeout(retry); clearInterval(tick); ws?.close(); };
  }, []);
  return { walls, events, status };
}

export function CandleLab() {
  const [interval, setIntervalTf] = useState<Interval>("1d");
  const [issuer, setIssuer] = useState("IBIT");
  const [threshold, setThreshold] = useState(100);
  const [minBtc, setMinBtc] = useState(10);
  const [maxBtc, setMaxBtc] = useState(100_000);
  const { candles, live } = useCandles(interval);
  const { walls, events, status } = useCoinbaseWalls(minBtc, maxBtc);
  const { etfProvider } = useSettings();
  const etf = useQuery({ queryKey: ["etf-history-candles", etfProvider], queryFn: () => getEtfHistory({ data: { provider: etfProvider } }), refetchInterval: 300_000 });
  const days = etf.data?.days ?? [];
  const markers = useMemo(() => flowMarkers(days, candles, issuer, threshold), [days, candles, issuer, threshold]);
  const pulled = events.filter((e) => e.kind === "pulled");

  // view window as [start, end) candle indices (float)
  const [view, setView] = useState<{ s: number; e: number } | null>(null);
  useEffect(() => setView(null), [interval]);
  const n = candles.length;
  const v = view ?? { s: Math.max(0, n - 150), e: n };
  const viewRef = useRef(v); viewRef.current = v;
  const nRef = useRef(n); nRef.current = n;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const clampView = (s: number, e: number) => {
    const N = nRef.current; const span = Math.min(Math.max(e - s, 10), Math.max(N + 20, 10));
    let ns = s; if (ns < -10) ns = -10; if (ns + span > N + 20) ns = N + 20 - span;
    return { s: ns, e: ns + span };
  };

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1);
      const cur = viewRef.current; const rect = el.getBoundingClientRect();
      const frac = (ev.clientX - rect.left) / rect.width;
      const anchor = cur.s + frac * (cur.e - cur.s);
      const k = Math.exp(dy * 0.0015);
      const span = (cur.e - cur.s) * k;
      setView(clampView(anchor - frac * span, anchor - frac * span + span));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ x: number; s: number; e: number } | null>(null);

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const ctx = cv.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const col = (name: string) => `hsl(${css.getPropertyValue(name).trim()})`;
    const raw = (name: string) => css.getPropertyValue(name).trim();
    const pick = (name: string, fb: string) => { const r = raw(name); return r ? (r.startsWith("#") || r.startsWith("oklch") || r.startsWith("rgb") || r.startsWith("hsl") ? r : col(name)) : fb; };
    const bull = pick("--bull", "#22c55e"), bear = pick("--bear", "#ef4444"), fg = pick("--muted-foreground", "#888"), grid = pick("--border", "#333"), primary = pick("--primary", "#f59e0b");
    ctx.clearRect(0, 0, W, H);
    if (!n) return;
    const padR = 64, padB = 20, cw = W - padR, ch = H - padB;
    const s = Math.max(0, Math.floor(v.s)), e = Math.min(n, Math.ceil(v.e));
    const vis = candles.slice(s, e);
    if (!vis.length) return;
    let lo = Math.min(...vis.map((c) => c.l)), hi = Math.max(...vis.map((c) => c.h));
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const X = (i: number) => ((i - v.s) / (v.e - v.s)) * cw;
    const Y = (p: number) => ch - ((p - lo) / (hi - lo)) * ch;
    const bw = Math.max(1, (cw / (v.e - v.s)) * 0.7);
    ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = fg; ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let k = 0; k <= 6; k++) {
      const p = lo + ((hi - lo) * k) / 6, y = Y(p);
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(p.toFixed(0), cw + 4, y + 3);
    }
    // Coinbase passive walls currently resting in view
    const maxWall = Math.max(1, ...walls.map((w) => w.size));
    for (const w of walls) {
      if (w.price < lo || w.price > hi) continue;
      const y = Y(w.price);
      ctx.globalAlpha = 0.25 + 0.6 * (w.size / maxWall);
      ctx.strokeStyle = w.side === "bid" ? bull : bear; ctx.lineWidth = 1 + 2 * (w.size / maxWall);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = w.side === "bid" ? bull : bear;
      ctx.fillText(`${w.size.toFixed(1)}₿`, cw - 44, y - 2);
    }
    ctx.lineWidth = 1;
    vis.forEach((c, j) => {
      const i = s + j, x = X(i + 0.5), up = c.c >= c.o;
      ctx.strokeStyle = ctx.fillStyle = up ? bull : bear;
      ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
      ctx.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
    });
    // red marks for pulled passive walls on the latest candle
    const lastX = X(n - 0.5);
    for (const p of pulled.slice(0, 60)) {
      if (p.price < lo || p.price > hi) continue;
      ctx.fillStyle = bear; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(lastX + 6, Y(p.price), 3 + Math.min(6, p.size / maxWall * 6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ETF markers
    const idxByT = new Map(candles.map((c, i) => [c.t, i]));
    for (const m of markers) {
      const i = idxByT.get(m.candleTime); if (i === undefined || i < s || i >= e) continue;
      const c = candles[i]!, x = X(i + 0.5), inflow = m.side === "in";
      const y = inflow ? Y(c.l) + 14 : Y(c.h) - 14;
      ctx.fillStyle = inflow ? bull : bear;
      ctx.beginPath();
      if (inflow) { ctx.moveTo(x, y - 8); ctx.lineTo(x - 6, y + 2); ctx.lineTo(x + 6, y + 2); }
      else { ctx.moveTo(x, y + 8); ctx.lineTo(x - 6, y - 2); ctx.lineTo(x + 6, y - 2); }
      ctx.fill();
      ctx.fillText(`${inflow ? "+" : ""}${m.value.toFixed(0)}M`, x - 16, inflow ? y + 14 : y - 6);
    }
    // time axis
    ctx.fillStyle = fg;
    const step = Math.max(1, Math.round((e - s) / 6));
    for (let i = s; i < e; i += step) {
      const d = new Date(candles[i]!.t);
      const lbl = ["1m", "5m", "15m", "1h", "4h"].includes(interval) ? d.toISOString().slice(5, 16).replace("T", " ") : d.toISOString().slice(0, 10);
      ctx.fillText(lbl, X(i), H - 6);
    }
    const last = candles[n - 1]!;
    ctx.fillStyle = primary; ctx.fillRect(cw, Y(last.c) - 7, padR, 14);
    ctx.fillStyle = "#000"; ctx.fillText(last.c.toFixed(1), cw + 4, Y(last.c) + 3);
    if (hover) {
      ctx.strokeStyle = fg; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hover.x, 0); ctx.lineTo(hover.x, ch); ctx.moveTo(0, hover.y); ctx.lineTo(cw, hover.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [candles, v.s, v.e, markers, walls, pulled, hover, interval, n]);

  const hoverCandle = hover && wrapRef.current ? candles[Math.floor(v.s + (hover.x / (wrapRef.current.clientWidth - 64)) * (v.e - v.s))] : undefined;
  const hoverMarker = hoverCandle ? markers.find((m) => m.candleTime === hoverCandle.t) : undefined;

  const zoomBtn = (k: number) => { const mid = (v.s + v.e) / 2, span = (v.e - v.s) * k; setView(clampView(mid - span / 2, mid + span / 2)); };

  return (
    <div className="panel flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="font-display font-semibold">BTCUSDT candles</span>
        <span className={live ? "text-bull" : "text-muted-foreground"}>● {live ? "live" : "connecting"}</span>
        <div className="ml-2 flex flex-wrap gap-1">
          {INTERVALS.map((t) => <button key={t} className={`btn-chip ${interval === t ? "btn-chip-active" : ""}`} onClick={() => setIntervalTf(t)}>{t}</button>)}
        </div>
        <div className="ml-auto flex gap-1">
          <button className="btn-chip" onClick={() => zoomBtn(0.7)} aria-label="Zoom in">+</button>
          <button className="btn-chip" onClick={() => zoomBtn(1.4)} aria-label="Zoom out">−</button>
          <button className="btn-chip" onClick={() => setView({ s: 0, e: n })}>All</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">ETF marks:</span>
        <select className="rounded border border-border bg-background px-1 py-0.5" value={issuer} onChange={(e) => setIssuer(e.target.value)}>
          {ISSUERS.map((i) => <option key={i} value={i}>{i === "TOTAL" ? "All issuers (net)" : `${issuerName(i)} (${i})`}</option>)}
        </select>
        {[0, 50, 100, 300, 500].map((t) => <button key={t} className={`btn-chip ${threshold === t ? "btn-chip-active" : ""}`} onClick={() => setThreshold(t)}>{t === 0 ? "All" : `±$${t}M`}</button>)}
        {!["1d", "1w", "1M"].includes(interval) && <span className="text-muted-foreground">ETF flows are daily — use 1d/1w to see marks</span>}
        <span className="text-muted-foreground">{markers.length} marked · {etf.data?.coverageDays ?? days.length} reported days from {etf.data?.provider ?? "provider"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Coinbase passive orders <span className={status === "live" ? "text-bull" : ""}>● {status}</span> min:</span>
        {MIN_PRESETS.map((t) => <button key={t} className={`btn-chip ${minBtc === t ? "btn-chip-active" : ""}`} onClick={() => setMinBtc(t)}>{t}₿</button>)}
        <span className="text-muted-foreground">max:</span>
        {MAX_PRESETS.map((t) => <button key={t} className={`btn-chip ${maxBtc === t ? "btn-chip-active" : ""}`} onClick={() => setMaxBtc(t)}>{t.toLocaleString()}₿</button>)}
      </div>
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1fr_220px]">
        <div ref={wrapRef} className="relative min-h-[380px] cursor-crosshair touch-none select-none overflow-hidden rounded border border-border"
          onPointerDown={(e) => { drag.current = { x: e.clientX, s: v.s, e: v.e }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            const r = wrapRef.current!.getBoundingClientRect();
            setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
            if (drag.current) { const dx = (e.clientX - drag.current.x) / (r.width - 64) * (drag.current.e - drag.current.s); setView(clampView(drag.current.s - dx, drag.current.e - dx)); }
          }}
          onPointerUp={() => { drag.current = null; }} onPointerLeave={() => setHover(null)}>
          <canvas ref={canvasRef} className="absolute inset-0" />
          {!n && <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Loading candles…</p>}
          {hoverCandle && (
            <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/90 px-2 py-1 font-mono text-[10px]">
              {new Date(hoverCandle.t).toISOString().slice(0, 16).replace("T", " ")} O {hoverCandle.o.toFixed(1)} H {hoverCandle.h.toFixed(1)} L {hoverCandle.l.toFixed(1)} C {hoverCandle.c.toFixed(1)}
              {hoverMarker && <div className={hoverMarker.side === "in" ? "text-bull" : "text-bear"}>{hoverMarker.issuer === "TOTAL" ? "All issuers" : hoverMarker.issuer} {hoverMarker.date}: {hoverMarker.value > 0 ? "+" : ""}${hoverMarker.value.toFixed(1)}M</div>}
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded border border-border text-[11px]">
          <p className="border-b border-border px-2 py-1 font-semibold">Passive order log</p>
          <ul className="min-h-0 flex-1 overflow-auto">
            {events.length === 0 && <li className="px-2 py-1 text-muted-foreground">Waiting for walls in your size range…</li>}
            {events.map((ev) => (
              <li key={ev.id} className={`flex justify-between px-2 py-0.5 font-mono ${ev.kind === "pulled" ? "text-bear" : "text-muted-foreground"}`}>
                <span>{new Date(ev.time).toLocaleTimeString()}</span>
                <span>{ev.kind === "pulled" ? "gone" : "new"} {ev.side}</span>
                <span>{ev.price.toFixed(0)}</span>
                <span>{ev.size.toFixed(1)}₿</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Candles: Binance BTCUSDT (history starts Aug 2017, so up to ~8 years, not 10). ETF marks are daily holdings-based estimates placed on the reporting day — not exact trade times — and only cover the days your ETF source provides. Coinbase BTC-USD walls are resting limit orders; green/red lines = bids/asks, red dots and "gone" rows = walls that disappeared (cancelled or filled — the feed can't tell which).
      </p>
    </div>
  );
}
