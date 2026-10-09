// Illustrative sample values (US$ millions). A live feed needs a paid data provider.
const ETFS = [
  { t: "IBIT", n: "BlackRock", f: [312.4, 98.1, -41.2, 420.7, 188.3] },
  { t: "FBTC", n: "Fidelity", f: [84.2, 22.5, -63.1, 131.0, 45.6] },
  { t: "ARKB", n: "ARK 21Shares", f: [18.3, -12.4, -8.9, 40.2, 11.0] },
  { t: "BITB", n: "Bitwise", f: [12.1, 4.3, 0, 22.8, 6.4] },
  { t: "GBTC", n: "Grayscale", f: [-55.6, -31.2, -88.4, -12.0, -24.7] },
  { t: "HODL", n: "VanEck", f: [6.2, 0, -3.1, 9.8, 2.2] },
];

export function EtfFlows() {
  const totals = ETFS.map((e) => ({ ...e, today: e.f[e.f.length - 1], week: e.f.reduce((a, b) => a + b, 0) }));
  const net = totals.reduce((a, e) => a + e.today, 0);
  const max = Math.max(...totals.map((e) => Math.abs(e.week)));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">Spot BTC ETF flows</h2>
        <span className={`font-mono text-sm ${net >= 0 ? "text-bull" : "text-bear"}`}>{net >= 0 ? "+" : ""}${net.toFixed(1)}M today</span>
      </div>
      <ul className="space-y-2">
        {totals.map((e) => (
          <li key={e.t} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-2">
            <div>
              <div className="font-mono text-xs font-semibold text-foreground">{e.t}</div>
              <div className="text-[10px] text-muted-foreground">{e.n}</div>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${e.week >= 0 ? "bg-bull" : "bg-bear"}`} style={{ width: `${(Math.abs(e.week) / max) * 100}%` }} />
            </div>
            <div className={`text-right font-mono text-xs ${e.today >= 0 ? "text-bull" : "text-bear"}`}>{e.today >= 0 ? "+" : ""}{e.today.toFixed(1)}M</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-muted-foreground">Bar = 5-day net flow. Sample figures — connect a data provider for live flows.</p>
    </div>
  );
}
