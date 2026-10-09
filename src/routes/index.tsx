import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { LiveMarket } from "@/components/LiveMarket";
import { EtfFlows } from "@/components/EtfFlows";
import { getBtcNews } from "@/lib/news.functions";

const newsQuery = queryOptions({
  queryKey: ["btc-news"],
  queryFn: () => getBtcNews(),
  refetchInterval: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fz Heatmap — Live BTCUSDT order flow" },
      { name: "description", content: "Live BTCUSDT liquidity heatmap, bubble candles, ETF flows and sentiment-colored Bitcoin news." },
      { property: "og:title", content: "Fz Heatmap — Live BTCUSDT order flow" },
      { property: "og:description", content: "Live BTCUSDT liquidity heatmap, bubble candles, ETF flows and Bitcoin news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(newsQuery).catch(() => []),
  component: Index,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-bear">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function timeAgo(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

function NewsFeed() {
  const { data } = useSuspenseQuery(newsQuery);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col p-4">
      <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-foreground">Live BTC news</h2>
      <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
        {data.length === 0 && <li className="text-xs text-muted-foreground">No news available right now.</li>}
        {data.map((n) => (
          <li key={n.id}>
            <a href={n.url} target="_blank" rel="noreferrer" className={`news-item news-${n.sentiment}`}>
              <span className="block text-sm leading-snug">{n.title}</span>
              <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{n.source} · {timeAgo(n.publishedAt)} · {n.sentiment}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background p-3 text-foreground lg:h-screen lg:overflow-hidden">
      <header className="mb-3 flex items-center gap-3">
        <div className="logo-mark" />
        <h1 className="font-display text-xl font-bold tracking-tight">Fz <span className="text-primary">Heatmap</span></h1>
      </header>
      <div className="grid gap-3 lg:h-[calc(100vh-4.5rem)] lg:grid-cols-[1fr_340px]">
        <main className="min-h-[640px] lg:min-h-0">
          <ClientOnly fallback={<div className="panel h-full" />}>
            <LiveMarket />
          </ClientOnly>
        </main>
        <aside className="flex min-h-0 flex-col gap-3">
          <EtfFlows />
          <NewsFeed />
        </aside>
      </div>
    </div>
  );
}
