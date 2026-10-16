import { XMLParser } from "fast-xml-parser";

export type HistoricalHeadline = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: "positive" | "negative" | "neutral";
};

const DAY = 86_400_000;
const POS = ["surge", "soar", "rally", "bull", "record", "high", "gain", "jump", "inflow", "approve", "adopt", "buy", "rise", "climb", "breakout", "boost", "accumulat", "upgrade", "optimis", "recover", "spike", "ath"];
const NEG = ["crash", "plunge", "drop", "bear", "low", "loss", "fall", "outflow", "hack", "ban", "sell", "dump", "fear", "slump", "decline", "lawsuit", "fraud", "liquidat", "tumble", "sink", "warn", "risk", "reject", "exploit"];

export function headlineSentiment(title: string): HistoricalHeadline["sentiment"] {
  const text = title.toLowerCase();
  const score = POS.filter((word) => text.includes(word)).length - NEG.filter((word) => text.includes(word)).length;
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
}

// Thirty calendar dates, including today, with exclusive upper boundaries.
export function newsHistoryWindows(now: number) {
  const today = Math.floor(now / DAY) * DAY;
  const start = today - 29 * DAY;
  const end = today + DAY;
  const windows: { start: string; end: string }[] = [];
  for (let cursor = start; cursor < end; cursor += 7 * DAY) {
    windows.push({ start: new Date(cursor).toISOString().slice(0, 10), end: new Date(Math.min(cursor + 7 * DAY, end)).toISOString().slice(0, 10) });
  }
  return windows;
}

export function parseHistoricalNews(xml: string): HistoricalHeadline[] {
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: true });
  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item;
  const items: Record<string, unknown>[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const text = (value: unknown): string => typeof value === "string" ? value : typeof value === "object" && value !== null && "#text" in value ? String(value["#text"]) : "";
  return items.flatMap((item) => {
    const source = text(item.source) || "Google News";
    const originalTitle = text(item.title);
    const suffix = ` - ${source}`;
    const title = originalTitle.endsWith(suffix) ? originalTitle.slice(0, -suffix.length) : originalTitle;
    const url = text(item.link);
    const publishedAt = Date.parse(text(item.pubDate));
    if (!title || !/bitcoin|\bbtc\b/i.test(title) || !Number.isFinite(publishedAt) || !/^https?:\/\//i.test(url)) return [];
    return [{ id: `history-${url}`, title, url, source, publishedAt, sentiment: headlineSentiment(title) }];
  });
}

export function normalizeHistoricalNews(items: HistoricalHeadline[], now: number) {
  const start = (Math.floor(now / DAY) - 29) * DAY;
  const seen = new Set<string>();
  return [...items].sort((a, b) => b.publishedAt - a.publishedAt).filter((item) => {
    if (item.publishedAt < start || item.publishedAt > now) return false;
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}