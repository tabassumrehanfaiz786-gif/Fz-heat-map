import { useMemo } from "react";

// Official 2026 FOMC decision days (second day of each meeting).
const FOMC = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09"];

type Ev = { date: Date; title: string; kind: "fomc" | "expiry" | "jobs"; note: string };

function lastFriday(y: number, m: number) {
  const d = new Date(Date.UTC(y, m + 1, 0));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function firstFriday(y: number, m: number) {
  const d = new Date(Date.UTC(y, m, 1));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function MacroCalendar() {
  const events = useMemo(() => {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const out: Ev[] = FOMC.map((d) => ({ date: new Date(d + "T18:00:00Z"), title: "FOMC rate decision", kind: "fomc" as const, note: "Fed · 2:00pm ET" }));
    for (let i = 0; i < 4; i++) {
      const y = now.getUTCFullYear(), m = now.getUTCMonth() + i;
      const lf = lastFriday(y, m);
      const q = lf.getUTCMonth() % 3 === 2;
      out.push({ date: lf, title: q ? "Quarterly BTC options & CME expiry" : "Monthly BTC options & CME expiry", kind: "expiry", note: "Deribit 08:00 UTC" });
      out.push({ date: firstFriday(y, m), title: "US jobs report (NFP)", kind: "jobs", note: "Usual schedule · 8:30am ET" });
    }
    return out.filter((e) => e.date.getTime() >= today).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 10);
  }, []);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col p-4">
      <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-foreground">Upcoming market dates</h2>
      <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
        {events.map((e) => {
          const days = Math.ceil((e.date.getTime() - Date.now()) / 86400000);
          return (
            <li key={e.title + e.date.toISOString()} className={`cal-item cal-${e.kind}`}>
              <div className="cal-date">
                <span className="font-mono text-[10px] uppercase">{e.date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}</span>
                <span className="font-mono text-lg font-semibold leading-none">{e.date.getUTCDate()}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-foreground">{e.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{e.note} · {days <= 0 ? "today" : `in ${days}d`}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">FOMC dates are official; expiries and jobs reports follow their usual schedule.</p>
    </div>
  );
}
