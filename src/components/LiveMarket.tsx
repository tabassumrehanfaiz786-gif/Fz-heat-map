import { useEffect, useRef, useState } from "react";

const STREAM = "wss://data-stream.binance.vision/stream?streams=btcusdt@depth@100ms/btcusdt@aggTrade/btcusdt@kline_1m";
const REST = "https://data-api.binance.vision/api/v3";
const BUCKET = 5; // USD per row
const ROWS = 160;
const COLS = 480; // snapshots kept
const SNAP_MS = 500;

// Fz heat palette: abyss -> teal -> lime -> gold -> white-hot
const STOPS: [number, number, number][] = [
  [6, 10, 14], [8, 60, 70], [10, 150, 140], [120, 220, 80], [250, 200, 40], [255, 250, 230],
];
function heat(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

type Col = { book: Map<number, number>; buy: number; sell: number; vwap: number; price: number };
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number; tb: number };

function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>) {
  const [s, setS] = useState({ w: 300, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setS({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

export function LiveMarket() {
  const heatRef = useRef<HTMLCanvasElement>(null);
  const candleRef = useRef<HTMLCanvasElement>(null);
  const hs = useCanvasSize(heatRef);
  const cs = useCanvasSize(candleRef);
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [status, setStatus] = useState("connecting");
  const st = useRef({
    bids: new Map<number, number>(),
    asks: new Map<number, number>(),
    cols: [] as Col[],
    cur: { buy: 0, sell: 0, pv: 0, last: 0 },
    candles: [] as Candle[],
  });

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
        d.bids.forEach(([p, q]: string[]) => s.bids.set(+p, +q));
        d.asks.forEach(([p, q]: string[]) => s.asks.set(+p, +q));
        s.candles = k.map((x: (string | number)[]) => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5], tb: +x[9] }));
        setChange(+t.priceChangePercent);
        s.cur.last = s.candles[s.candles.length - 1]?.c ?? 0;
        setPrice(s.cur.last);
      } catch {
        setStatus("rest error");
      }
      if (!alive) return;
      ws = new WebSocket(STREAM);
      ws.onopen = () => setStatus("live");
      ws.onclose = () => alive && setStatus("disconnected");
      ws.onmessage = (ev) => {
        const { stream, data } = JSON.parse(ev.data);
        if (stream.endsWith("depth@100ms")) {
          data.b.forEach(([p, q]: string[]) => (+q === 0 ? s.bids.delete(+p) : s.bids.set(+p, +q)));
          data.a.forEach(([p, q]: string[]) => (+q === 0 ? s.asks.delete(+p) : s.asks.set(+p, +q)));
        } else if (stream.endsWith("aggTrade")) {
          const p = +data.p, q = +data.q;
          if (data.m) s.cur.sell += q; else s.cur.buy += q;
          s.cur.pv += p * q;
          s.cur.last = p;
        } else {
          const k = data.k;
          const c: Candle = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v, tb: +k.V };
          const last = s.candles[s.candles.length - 1];
          if (last && last.t === c.t) s.candles[s.candles.length - 1] = c;
          else { s.candles.push(c); if (s.candles.length > 200) s.candles.shift(); }
        }
      };
    })();

    const iv = setInterval(() => {
      const book = new Map<number, number>();
      const add = (m: Map<number, number>) => m.forEach((q, p) => {
        const b = Math.floor(p / BUCKET) * BUCKET;
        book.set(b, (book.get(b) ?? 0) + q);
      });
      add(s.bids); add(s.asks);
      const vol = s.cur.buy + s.cur.sell;
      s.cols.push({ book, buy: s.cur.buy, sell: s.cur.sell, vwap: vol ? s.cur.pv / vol : s.cur.last, price: s.cur.last });
      if (s.cols.length > COLS) s.cols.shift();
      s.cur.buy = 0; s.cur.sell = 0; s.cur.pv = 0;
      if (s.cur.last) setPrice(s.cur.last);
    }, SNAP_MS);
    return () => { alive = false; ws?.close(); clearInterval(iv); };
  }, []);

  // render loop
  useEffect(() => {
    let raf = 0;
    const off = document.createElement("canvas");
    off.width = COLS; off.height = ROWS;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(COLS, ROWS);
    const draw = () => {
      const s = st.current;
      const hc = heatRef.current, cc = candleRef.current;
      const dpr = window.devicePixelRatio || 1;
      const css = getComputedStyle(document.documentElement);
      const up = css.getPropertyValue("--bull").trim() || "lime";
      const down = css.getPropertyValue("--bear").trim() || "red";
      const fg = css.getPropertyValue("--muted-foreground").trim() || "#888";
      if (hc && s.cur.last) {
        const W = hs.w, H = hs.h, AX = 70;
        hc.width = W * dpr; hc.height = H * dpr;
        const ctx = hc.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const mid = Math.floor(s.cur.last / BUCKET) * BUCKET;
        const top = mid + (ROWS / 2) * BUCKET;
        let max = 1;
        for (const c of s.cols) for (let r = 0; r < ROWS; r++) { const q = c.book.get(top - r * BUCKET) ?? 0; if (q > max) max = q; }
        const lmax = Math.log1p(max);
        const off0 = COLS - s.cols.length;
        img.data.fill(0);
        for (let x = 0; x < COLS; x++) {
          const c = s.cols[x - off0];
          for (let r = 0; r < ROWS; r++) {
            const q = c ? c.book.get(top - r * BUCKET) ?? 0 : 0;
            const [R, G, B] = heat(Math.pow(Math.log1p(q) / lmax, 1.4));
            const i = (r * COLS + x) * 4;
            img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const PW = W - AX;
        ctx.drawImage(off, 0, 0, PW, H);
        const yOf = (p: number) => ((top - p) / BUCKET / ROWS) * H + H / ROWS / 2;
        const xOf = (i: number) => ((i + off0 + 0.5) / COLS) * PW;
        // price line
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath();
        s.cols.forEach((c, i) => { if (!c.price) return; const x = xOf(i), y = yOf(c.price); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        // trade bubbles
        s.cols.forEach((c, i) => {
          const v = c.buy + c.sell; if (v < 0.05) return;
          const r = Math.min(28, 2 + Math.sqrt(v) * 4);
          ctx.beginPath(); ctx.arc(xOf(i), yOf(c.vwap), r, 0, Math.PI * 2);
          ctx.fillStyle = c.buy >= c.sell ? up : down; ctx.globalAlpha = 0.55; ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
        });
        // axis
        ctx.fillStyle = "rgba(6,10,14,0.92)"; ctx.fillRect(PW, 0, AX, H);
        ctx.font = "10px JetBrains Mono, monospace"; ctx.fillStyle = fg;
        for (let r = 0; r < ROWS; r += 10) ctx.fillText((top - r * BUCKET).toFixed(0), PW + 6, (r / ROWS) * H + 10);
        const y = yOf(s.cur.last);
        ctx.fillStyle = up; ctx.fillRect(PW, y - 8, AX, 16);
        ctx.fillStyle = "#000"; ctx.fillText(s.cur.last.toFixed(1), PW + 6, y + 4);
      }
      if (cc && s.candles.length) {
        const W = cs.w, H = cs.h, AX = 70, PW = W - AX;
        cc.width = W * dpr; cc.height = H * dpr;
        const ctx = cc.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.max(20, Math.floor(PW / 9));
        const cd = s.candles.slice(-n);
        const hi = Math.max(...cd.map((c) => c.h)), lo = Math.min(...cd.map((c) => c.l));
        const pad = (hi - lo) * 0.08 || 1;
        const yOf = (p: number) => ((hi + pad - p) / (hi - lo + pad * 2)) * H;
        const cw = PW / n;
        const vmax = Math.max(...cd.map((c) => c.v));
        cd.forEach((c, i) => {
          const x = i * cw + cw / 2, col = c.c >= c.o ? up : down;
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
          const y1 = yOf(Math.max(c.o, c.c)), y2 = yOf(Math.min(c.o, c.c));
          ctx.fillRect(x - cw * 0.35, y1, cw * 0.7, Math.max(1, y2 - y1));
          // volume bubble
          const r = 2 + Math.sqrt(c.v / vmax) * cw * 1.6;
          ctx.beginPath(); ctx.arc(x, yOf((c.h + c.l) / 2), r, 0, Math.PI * 2);
          ctx.fillStyle = c.tb >= c.v / 2 ? up : down; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
        });
        ctx.font = "10px JetBrains Mono, monospace"; ctx.fillStyle = fg;
        for (let i = 0; i <= 6; i++) { const p = lo - pad + ((hi - lo + pad * 2) * i) / 6; ctx.fillText(p.toFixed(0), PW + 6, yOf(p) + 3); }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hs, cs]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-xs tracking-widest text-muted-foreground">BTCUSDT · BINANCE</span>
        <span className="font-mono text-3xl font-semibold text-foreground">{price ? price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</span>
        <span className={`font-mono text-sm ${change >= 0 ? "text-bull" : "text-bear"}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}% 24h</span>
        <span className="ml-auto flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${status === "live" ? "bg-bull animate-pulse" : "bg-bear"}`} />{status}
        </span>
      </div>
      <div className="panel relative min-h-[360px] flex-[3] overflow-hidden">
        <span className="panel-label">Liquidity heatmap · trade bubbles</span>
        <canvas ref={heatRef} className="h-full w-full" />
      </div>
      <div className="panel relative min-h-[220px] flex-[2] overflow-hidden">
        <span className="panel-label">1m bubble candles</span>
        <canvas ref={candleRef} className="h-full w-full" />
      </div>
    </div>
  );
}
