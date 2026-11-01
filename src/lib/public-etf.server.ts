import { PUBLIC_ETF_URL, parsePublicEtfTable, missingWeekdays } from "./public-etf";

type Snapshot = ReturnType<typeof parsePublicEtfTable> & { fetchedAt: number; missingDates: string[]; sourceUpdatedAt: null };
let cache: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;

export async function fetchPublicEtf(): Promise<Snapshot> {
  if (cache && Date.now() - cache.fetchedAt < 300_000) return cache;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(PUBLIC_ETF_URL, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Public ETF source unavailable (${response.status}). No sample figures shown.`);
    const parsed = parsePublicEtfTable(await response.text());
    const fetchedAt = Date.now();
    const cutoff = new Date(fetchedAt - 29 * 86400_000).toISOString().slice(0, 10);
    const today = new Date(fetchedAt).toISOString().slice(0, 10);
    const days = parsed.days.filter((day) => day.date >= cutoff && day.date <= today);
    if (!days.length) throw new Error("Public ETF source has no figures within the last 30 days.");
    cache = { ...parsed, days, fetchedAt, sourceUpdatedAt: null, missingDates: missingWeekdays(days.map((day) => day.date), fetchedAt) };
    return cache;
  })();
  try { return await pending; } finally { pending = undefined; }
}