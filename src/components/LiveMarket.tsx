import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getSettings, useSettings } from "@/lib/settings";

const STREAM = "wss://data-stream.binance.vision/stream?streams=btcusdt@depth@100ms/btcusdt@aggTrade/btcusdt@kline_1m";
const REST = "https://data-api.binance.vision/api/v3";
const BUCKET = 5;
const ROWS = 160;
const MAX_COLS = 1800; // 30 min of 1s snapshots
const SNAP_MS = 1000;

export type TF = "10m" | "15m" | "30m" | "1M" | "3M";
export const TFS: TF[] = ["10m", "15m", "30m", "1M", "3M"];
const LIVE_SEC: Partial<Record<TF, number>> = { "10m": 600, "15m": 900, "30m": 1800 };
const HIST: Partial<Record<TF, { interval: string; limit: number }>> = { "1M": { interval: "1h", limit: 720 }, "3M": { interval: "4h", limit: 540 } };

const STOPS: [number, number, number][] = [[6, 10, 14], [8, 60, 70], [10, 150, 140], [120, 220, 80], [250, 200, 40], [255, 250, 230]];
function heat(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = STOPS[i]!, b = STOPS[Math.min(i + 1, STOPS.length - 1)]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

type Col = { book: Map<number, number>; buy: number; sell: number; vwap: number; price: number };
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number; tb: number };
type Wall = { p: number; q: number; side: "bid" | "ask" };

const toCandle = (x: (string | number)[]): Candle => ({ t: +x[0]!, o: +x[1]!, h: +x[2]!, l: +x[3]!, c: +x[4]!, v: +x[5]!, tb: +x[9]! });

function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>) {
  const [s, setS] = useState({ w: 300, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => { const e = es[0]; if (e) setS({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

let audio: AudioContext | null = null;
function beep(up: boolean) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = up ? 880 : 330;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.35);
  } catch { /* ignore */ }
}

export function LiveMarket({ tf }: { tf: TF }) {
  const heatRef = useRef<HTMLCanvasElement>(null);
  const candleRef = useRef<HTMLCanvasElement>(null);
  const hs = useCanvasSize(heatRef);
  const cs = useCanvasSize(candleRef);
  const settings = useSettings();
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState(0);
  const [status, setStatus] = useState("connecting");
  const [walls, setWalls] = useState<Wall[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const st = useRef({
    bids: new Map<number, number>(), asks: new Map<number, number>(),
    cols: [] as Col[], cur: { buy: 0, sell: 0, pv: 0, last: 0 },
    candles: [] as Candle[], hist: [] as Candle[], walls: [] as Wall[], lastAlert: 0,
  });

  // live data
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;
    const s = st.current;
    (async () => {
      try {
        const [d, k, t] = await Promise.all([
          fetch(`${REST}/depth?symbol=BTCUSDT&limit=1000`).then((r) => r.json()),
          fetch(`${REST}/klines?symbol=BTCUSDT&interval=1m&limit=120`).then((r) => r.json()),
          fetch(`${REST}/ticker/24hr?symbol=BTCUSDT`).then((r) => r.json()),
        ]);
        d.bids.forEach(([p, q]: [string, string]) => s.bids.set(+p, +q));
        d.asks.forEach(([p, q]: [string, string]) => s.asks.set(+p, +q));
        s.candles = k.map(toCandle);
        setChange(+t.priceChangePercent);
        s.cur.last = s.candles[s.candles.length - 1]?.c ?? 0;
        setPrice(s.cur.last);
      } catch { setStatus("rest error"); }
      if (!alive) return;
      ws = new WebSocket(STREAM);
      ws.onopen = () => setStatus("live");
      ws.onclose = () => alive && setStatus("disconnected");
      ws.onmessage = (ev) => {
        const { stream, data } = JSON.parse(ev.data);
        if (stream.endsWith("depth@100ms")) {
          data.b.forEach(([p, q]: [string, string]) => (+q === 0 ? s.bids.delete(+p) : s.bids.set(+p, +q)));
          data.a.forEach(([p, q]: [string, string]) => (+q === 0 ? s.asks.delete(+p) : s.asks.set(+p, +q)));
        } else if (stream.endsWith("aggTrade")) {
          const p = +data.p, q = +data.q;
          if (data.m) s.cur.sell += q; else s.cur.buy += q;
          s.cur.pv += p * q; s.cur.last = p;
        } else {
          const c = toCandle([data.k.t, data.k.o, data.k.h, data.k.l, data.k.c, data.k.v, 0, 0, 0, data.k.V]);
          const last = s.candles[s.candles.length - 1];
          if (last && last.t === c.t) s.candles[s.candles.length - 1] = c;
          else { s.candles.push(c); if (s.candles.length > 300) s.candles.shift(); }
        }
      };
    })();

    const iv = setInterval(() => {
      const cfg = getSettings();
      const book = new Map<number, number>();
      const add = (m: Map<number, number>) => m.forEach((q, p) => { const b = Math.floor(p / BUCKET) * BUCKET; book.set(b, (book.get(b) ?? 0) + q); });
      add(s.bids); add(s.asks);
      const vol = s.cur.buy + s.cur.sell;
      const col = { book, buy: s.cur.buy, sell: s.cur.sell, vwap: vol ? s.cur.pv / vol : s.cur.last, price: s.cur.last };
      s.cols.push(col);
      if (s.cols.length > MAX_COLS) s.cols.shift();
      s.cur.buy = 0; s.cur.sell = 0; s.cur.pv = 0;

      // passive walls
      const range = (ROWS / 2) * BUCKET;
      const w: Wall[] = [];
      book.forEach((q, p) => { if (q >= cfg.wallMinBtc && Math.abs(p - s.cur.last) <= range) w.push({ p, q, side: p + BUCKET / 2 >= s.cur.last ? "ask" : "bid" }); });
      s.walls = w.sort((a, b) => b.q - a.q).slice(0, 10);
      setWalls(s.walls);

      // alerts
      const now = Date.now();
      if (cfg.alertsOn && now - s.lastAlert > 4000) {
        const big = col.buy >= col.sell ? { side: "buy", q: col.buy, on: cfg.alertBuy } : { side: "sell", q: col.sell, on: cfg.alertSell };
        if (big.on && big.q >= cfg.alertMinBtc) {
          s.lastAlert = now;
          const msg = `Large ${big.side}: ${big.q.toFixed(2)} BTC @ ${col.vwap.toFixed(1)}`;
          (big.side === "buy" ? toast.success : toast.error)(msg, { description: `≈ $${((big.q * col.vwap) / 1e6).toFixed(2)}M in 1 second` });
          if (cfg.alertSound) beep(big.side === "buy");
          if (cfg.alertNotify && "Notification" in window && Notification.permission === "granted") new Notification("Fz Heatmap", { body: msg });
        }
      }
      if (s.cur.last) setPrice(s.cur.last);
      setElapsed(s.cols.length);
    }, SNAP_MS);
    return () => { alive = false; ws?.close(); clearInterval(iv); };
  }, []);

  // history for long timeframes
  useEffect(() => {
    const h = HIST[tf];
    if (!h) return;
    let alive = true;
    const load = () => fetch(`${REST}/klines?symbol=BTCUSDT&interval=${h.interval}&limit=${h.limit}`).then((r) => r.json()).then((k) => { if (alive) st.current.hist = k.map(toCandle); }).catch(() => {});
    st.current.hist = [];
    load();
    const iv = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(iv); };
  }, [tf]);

  // render
  useEffect(() => {
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    const draw = () => {
      const s = st.current;
      const hc = heatRef.current, cc = candleRef.current;
      const dpr = window.devicePixelRatio || 1;
      const css = getComputedStyle(document.documentElement);
      const up = css.getPropertyValue("--bull").trim() || "lime";
      const down = css.getPropertyValue("--bear").trim() || "red";
      const wallC = css.getPropertyValue("--wall").trim() || "red";
      const fg = css.getPropertyValue("--muted-foreground").trim() || "#888";
      const histMode = !!HIST[tf];

      if (hc) {
        const W = hs.w, H = hs.h, AX = 120, PW = W - AX;
        hc.width = W * dpr; hc.height = H * dpr;
        const ctx = hc.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = "10px JetBrains Mono, monospace";
        const putGrid = (grid: Float32Array, n: number, max: number) => {
          off.width = n; off.height = ROWS;
          const img = octx.createImageData(n, ROWS);
          const lmax = Math.log1p(max || 1);
          for (let i = 0; i < grid.length; i++) {
            const [R, G, B] = heat(Math.pow(Math.log1p(grid[i]!) / lmax, 1.4));
            img.data[i * 4] = R; img.data[i * 4 + 1] = G; img.data[i * 4 + 2] = B; img.data[i * 4 + 3] = 255;
          }
          octx.putImageData(img, 0, 0);
          ctx.imageSmoothingEnabled = histMode;
          ctx.drawImage(off, 0, 0, PW, H);
        };

        if (!histMode && s.cur.last) {
          const N = LIVE_SEC[tf]!;
          const cols = s.cols.slice(-N);
          const off0 = N - cols.length;
          const top = Math.floor(s.cur.last / BUCKET) * BUCKET + (ROWS / 2) * BUCKET;
          const grid = new Float32Array(N * ROWS);
          let max = 1;
          cols.forEach((c, i) => {
            for (let r = 0; r < ROWS; r++) { const q = c.book.get(top - r * BUCKET) ?? 0; grid[r * N + i + off0] = q; if (q > max) max = q; }
          });
          putGrid(grid, N, max);
          const yOf = (p: number) => ((top - p) / BUCKET / ROWS) * H + H / ROWS / 2;
          const xOf = (i: number) => ((i + off0 + 0.5) / N) * PW;
          ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath();
          cols.forEach((c, i) => { if (!c.price) return; i ? ctx.lineTo(xOf(i), yOf(c.price)) : ctx.moveTo(xOf(i), yOf(c.price)); });
          ctx.stroke();
          const scale = 600 / N;
          cols.forEach((c, i) => {
            const v = c.buy + c.sell; if (v < 0.1) return;
            const r = Math.min(26, (2 + Math.sqrt(v) * 4) * Math.max(0.55, scale));
            ctx.beginPath(); ctx.arc(xOf(i), yOf(c.vwap), r, 0, Math.PI * 2);
            ctx.fillStyle = c.buy >= c.sell ? up : down; ctx.globalAlpha = 0.55; ctx.fill();
            ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
          });
          // passive walls: red lines that appear/disappear with the order
          for (const w of s.walls) {
            const y = yOf(w.p);
            ctx.strokeStyle = wallC; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); ctx.globalAlpha = 1;
            const label = `${w.side.toUpperCase()} ${w.q.toFixed(1)} BTC`;
            ctx.fillStyle = wallC; ctx.fillRect(PW - 112, y - 7, 108, 14);
            ctx.fillStyle = "#fff"; ctx.fillText(label, PW - 108, y + 3);
          }
          // axis + DOM ladder
          ctx.fillStyle = "rgba(6,10,14,0.94)"; ctx.fillRect(PW, 0, AX, H);
          const latest = cols[cols.length - 1];
          let lmax = 1;
          if (latest) for (let r = 0; r < ROWS; r++) lmax = Math.max(lmax, latest.book.get(top - r * BUCKET) ?? 0);
          const rh = H / ROWS;
          for (let r = 0; r < ROWS; r++) {
            const p = top - r * BUCKET, q = latest?.book.get(p) ?? 0;
            if (q > 0) { ctx.fillStyle = p + BUCKET / 2 >= s.cur.last ? down : up; ctx.globalAlpha = 0.7; ctx.fillRect(PW + 62, r * rh, (q / lmax) * 54, Math.max(1, rh - 0.5)); ctx.globalAlpha = 1; }
          }
          ctx.fillStyle = fg;
          for (let r = 0; r < ROWS; r += 10) ctx.fillText((top - r * BUCKET).toFixed(0), PW + 6, r * rh + 10);
          const y = yOf(s.cur.last);
          ctx.fillStyle = up; ctx.fillRect(PW, y - 8, 60, 16);
          ctx.fillStyle = "#000"; ctx.fillText(s.cur.last.toFixed(1), PW + 4, y + 4);
        } else if (histMode && s.hist.length) {
          const cd = s.hist, n = cd.length;
          const hi = Math.max(...cd.map((c) => c.h)), lo = Math.min(...cd.map((c) => c.l));
          const b = (hi - lo) / ROWS || 1;
          const rowOf = (p: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((hi - p) / b)));
          const grid = new Float32Array(n * ROWS), acc = new Float32Array(ROWS);
          let max = 1;
          cd.forEach((c, i) => {
            for (let r = 0; r < ROWS; r++) acc[r]! *= 0.97;
            const r1 = rowOf(c.h), r2 = rowOf(c.l), span = r2 - r1 + 1;
            for (let r = r1; r <= r2; r++) acc[r]! += c.v / span;
            for (let r = 0; r < ROWS; r++) { grid[r * n + i] = acc[r]!; if (acc[r]! > max) max = acc[r]!; }
          });
          putGrid(grid, n, max);
          const yOf = (p: number) => ((hi - p) / (hi - lo)) * H;
          const xOf = (i: number) => ((i + 0.5) / n) * PW;
          ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath();
          cd.forEach((c, i) => (i ? ctx.lineTo(xOf(i), yOf(c.c)) : ctx.moveTo(xOf(i), yOf(c.c))));
          ctx.stroke();
          const imbs = cd.map((c) => c.tb - (c.v - c.tb));
          const im = Math.max(...imbs.map(Math.abs)) || 1;
          cd.forEach((c, i) => {
            const v = imbs[i]!; if (Math.abs(v) < im * 0.25) return;
            ctx.beginPath(); ctx.arc(xOf(i), yOf(c.c), 2 + (Math.abs(v) / im) * 14, 0, Math.PI * 2);
            ctx.fillStyle = v > 0 ? up : down; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
          });
          ctx.fillStyle = "rgba(6,10,14,0.94)"; ctx.fillRect(PW, 0, AX, H);
          ctx.fillStyle = fg;
          for (let i = 0; i <= 10; i++) { const p = hi - ((hi - lo) * i) / 10; ctx.fillText(p.toFixed(0), PW + 6, yOf(p) + (i === 0 ? 10 : i === 10 ? -2 : 3)); }
        }
      }

      const cdAll = histMode ? s.hist : s.candles;
      if (cc && cdAll.length) {
        const W = cs.w, H = cs.h, AX = 70, PW = W - AX;
        cc.width = W * dpr; cc.height = H * dpr;
        const ctx = cc.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.max(20, Math.floor(PW / 8));
        const cd = cdAll.slice(-n);
        const hi = Math.max(...cd.map((c) => c.h)), lo = Math.min(...cd.map((c) => c.l));
        const pad = (hi - lo) * 0.08 || 1;
        const yOf = (p: number) => ((hi + pad - p) / (hi - lo + pad * 2)) * H;
        const cw = PW / n, vmax = Math.max(...cd.map((c) => c.v));
        cd.forEach((c, i) => {
          const x = i * cw + cw / 2, col = c.c >= c.o ? up : down;
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
          const y1 = yOf(Math.max(c.o, c.c)), y2 = yOf(Math.min(c.o, c.c));
          ctx.fillRect(x - cw * 0.35, y1, cw * 0.7, Math.max(1, y2 - y1));
          ctx.beginPath(); ctx.arc(x, yOf((c.h + c.l) / 2), 2 + Math.sqrt(c.v / vmax) * cw * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = c.tb >= c.v / 2 ? up : down; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
        });
        ctx.font = "10px JetBrains Mono, monospace"; ctx.fillStyle = fg;
        for (let i = 0; i <= 6; i++) { const p = lo - pad + ((hi - lo + pad * 2) * i) / 6; ctx.fillText(p.toFixed(0), PW + 6, yOf(p) + 3); }
      }
    };
    draw();
    const iv = setInterval(draw, 250);
    return () => clearInterval(iv);
  }, [hs, cs, tf]);

  const live = !HIST[tf];
  const need = LIVE_SEC[tf] ?? 0;
  const candleLabel = tf === "1M" ? "1h bubble candles · 1 month" : tf === "3M" ? "4h bubble candles · 3 months" : "1m bubble candles";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-xs tracking-widest text-muted-foreground">BTCUSDT · BINANCE</span>
        <span className="font-mono text-3xl font-semibold text-foreground">{price ? price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</span>
        <span className={`font-mono text-sm ${change >= 0 ? "text-bull" : "text-bear"}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}% 24h</span>
        <span className="ml-auto flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${status === "live" ? "bg-bull animate-pulse" : "bg-bear"}`} />{status}
          {settings.alertsOn && <span className="normal-case">· alerts ≥ {settings.alertMinBtc} BTC</span>}
        </span>
      </div>
      <div className="panel relative min-h-[380px] flex-[3] overflow-hidden">
        <span className="panel-label">
          {live ? `Order book heatmap · ${tf} · walls ≥ ${settings.wallMinBtc} BTC` : `Volume heat flow · ${tf}`}
          {live && elapsed < need && ` · filling ${Math.round((elapsed / need) * 100)}%`}
        </span>
        {live && walls.length > 0 && (
          <div className="absolute left-3 top-6 z-[1] flex max-w-[60%] flex-wrap gap-1">
            {walls.slice(0, 5).map((w) => (
              <span key={w.p} className="wall-chip">{w.side} {w.p.toFixed(0)} · {w.q.toFixed(0)}</span>
            ))}
          </div>
        )}
        <canvas ref={heatRef} className="h-full w-full" />
      </div>
      <div className="panel relative min-h-[200px] flex-[2] overflow-hidden">
        <span className="panel-label">{candleLabel}</span>
        <canvas ref={candleRef} className="h-full w-full" />
      </div>
    </div>
  );
}
