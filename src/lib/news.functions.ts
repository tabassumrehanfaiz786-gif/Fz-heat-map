import { createServerFn } from "@tanstack/react-start";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: "positive" | "negative" | "neutral";
};

const POS = ["surge", "soar", "rally", "bull", "record", "high", "gain", "jump", "inflow", "approve", "adopt", "buy", "rise", "climb", "breakout", "boost", "accumulat", "upgrade", "optimis", "recover", "spike", "ath"];
const NEG = ["crash", "plunge", "drop", "bear", "low", "loss", "fall", "outflow", "hack", "ban", "sell", "dump", "fear", "slump", "decline", "lawsuit", "fraud", "liquidat", "tumble", "sink", "warn", "risk", "reject", "exploit"];

function score(text: string): NewsItem["sentiment"] {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of POS) if (t.includes(w)) s++;
  for (const w of NEG) if (t.includes(w)) s--;
  return s > 0 ? "positive" : s < 0 ? "negative" : "neutral";
}

function decode(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function fromRss(url: string, source: string): Promise<NewsItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 FzHeatmap" } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.split("<item>").slice(1);
  return items.map((it, i) => {
    const title = decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = decode(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const date = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    return {
      id: `${source}-${i}-${link}`,
      title,
      url: link,
      source,
      publishedAt: date ? Date.parse(date) : Date.now(),
      sentiment: score(title),
    };
  });
}

export const getBtcNews = createServerFn({ method: "GET" }).handler(async () => {
  const results = await Promise.allSettled([
    fromRss("https://cointelegraph.com/rss/tag/bitcoin", "Cointelegraph"),
    fromRss("https://www.coindesk.com/arc/outboundfeeds/rss/", "CoinDesk"),
    fromRss("https://bitcoinmagazine.com/.rss/full/", "Bitcoin Magazine"),
  ]);
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const btc = all.filter((n) => /bitcoin|btc|etf|crypto/i.test(n.title));
  return btc.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 40);
});
