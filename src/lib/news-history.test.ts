import { describe, expect, it } from "vitest";
import { newsHistoryWindows, normalizeHistoricalNews, parseHistoricalNews, type HistoricalHeadline } from "./news-history";

const now = Date.parse("2026-10-16T07:15:00Z");
const headline = (title: string, date: string): HistoricalHeadline => ({ id: title, title, url: "https://example.com/news", source: "Publisher", publishedAt: Date.parse(date), sentiment: "neutral" });

describe("30-day Bitcoin news archive", () => {
  it("covers exactly 30 calendar days including today without gaps", () => {
    const windows = newsHistoryWindows(now);
    expect(windows[0]?.start).toBe("2026-09-17");
    expect(windows.at(-1)?.end).toBe("2026-10-17");
    expect(windows).toHaveLength(5);
    windows.slice(1).forEach((window, i) => expect(window.start).toBe(windows[i]?.end));
  });

  it("keeps older event headlines and excludes dates outside the 30-day window", () => {
    const result = normalizeHistoricalNews([
      headline("Bitcoin older divergence", "2026-09-17T00:00:00Z"),
      headline("Bitcoin too old", "2026-09-16T23:59:59Z"),
      headline("Bitcoin future", "2026-10-16T08:00:00Z"),
    ], now);
    expect(result.map((item) => item.title)).toEqual(["Bitcoin older divergence"]);
  });

  it("preserves actual archive publication dates, publisher and decoded titles", () => {
    const items = parseHistoricalNews(`<rss><channel><item><title>Bitcoin rally &amp; ETF inflows - CoinDesk</title><link>https://news.google.com/rss/articles/123</link><pubDate>Thu, 17 Sep 2026 12:00:00 GMT</pubDate><source url="https://coindesk.com">CoinDesk</source></item><item><title>Bitcoin missing date</title><link>https://example.com</link></item></channel></rss>`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Bitcoin rally & ETF inflows", source: "CoinDesk", publishedAt: Date.parse("2026-09-17T12:00:00Z"), sentiment: "positive" });
  });

  it("deduplicates repeated headlines without capping away older days", () => {
    const items = Array.from({ length: 80 }, (_, i) => headline(`Bitcoin headline ${i}`, "2026-10-15T00:00:00Z"));
    items.push(headline("Bitcoin older event", "2026-09-18T00:00:00Z"), headline("Bitcoin headline 0", "2026-10-15T00:00:00Z"));
    const result = normalizeHistoricalNews(items, now);
    expect(result).toHaveLength(81);
    expect(result.at(-1)?.title).toBe("Bitcoin older event");
  });
});