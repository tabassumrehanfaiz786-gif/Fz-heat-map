import { newsHistoryWindows, normalizeHistoricalNews, parseHistoricalNews } from "./news-history";

type HistoryResult = {
  items: ReturnType<typeof normalizeHistoricalNews>;
  startDate: string;
  endDate: string;
  fetchedAt: string;
  failedWindows: number;
};

let cached: { expiresAt: number; result: HistoryResult } | undefined;
let pending: Promise<HistoryResult> | undefined;

export async function fetchBitcoinNewsHistory(): Promise<HistoryResult> {
  const now = Date.now();
  const windows = newsHistoryWindows(now);
  const startDate = windows[0]?.start ?? new Date(now).toISOString().slice(0, 10);
  if (cached && cached.expiresAt > now && cached.result.startDate === startDate) return cached.result;
  if (pending) return pending;
  pending = (async () => {
    const responses = await Promise.allSettled(windows.map(async (window) => {
      const url = new URL("https://news.google.com/rss/search");
      url.search = new URLSearchParams({ q: `bitcoin after:${window.start} before:${window.end}`, hl: "en-US", gl: "US", ceid: "US:en" }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("Historical news unavailable");
      const xml = await response.text();
      if (!xml.includes("<rss")) throw new Error("Invalid news feed");
      return parseHistoricalNews(xml);
    }));
    const result: HistoryResult = {
      items: normalizeHistoricalNews(responses.flatMap((response) => response.status === "fulfilled" ? response.value : []), now),
      startDate,
      endDate: new Date(now).toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
      failedWindows: responses.filter((response) => response.status === "rejected").length,
    };
    cached = { expiresAt: now + (result.failedWindows ? 60_000 : 600_000), result };
    return result;
  })();
  try { return await pending; } finally { pending = undefined; }
}