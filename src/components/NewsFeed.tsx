import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getBtcNews } from "@/lib/news.functions";
import { analyzeHeadlines, type Impact } from "@/lib/ai.functions";

export const newsQuery = queryOptions({ queryKey: ["btc-news"], queryFn: () => getBtcNews(), refetchInterval: 60_000 });

function timeAgo(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

const N = 15;

export function NewsFeed() {
  const { data } = useSuspenseQuery(newsQuery);
  const ai = useMutation({ mutationFn: (titles: string[]) => analyzeHeadlines({ data: { titles } }) });
  const byTitle = new Map<string, Impact>();
  if (ai.data && ai.variables) ai.data.forEach((r) => { const t = ai.variables[r.index]; if (t) byTitle.set(t, r); });
  const counts = ai.data ? { up: ai.data.filter((r) => r.impact === "bullish").length, down: ai.data.filter((r) => r.impact === "bearish").length } : null;

  return (
    <div className="panel flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">Live BTC news</h2>
        <button className="btn-chip btn-chip-active" disabled={ai.isPending || !data.length} onClick={() => ai.mutate(data.slice(0, N).map((n) => n.title))}>
          {ai.isPending ? "Analyzing…" : ai.data ? "Re-analyze" : "AI impact"}
        </button>
      </div>
      {ai.error && <p role="alert" className="mb-2 text-xs text-bear">{(ai.error as Error).message}</p>}
      {counts && (
        <p className="mb-2 font-mono text-[11px] text-muted-foreground">
          AI read of top {ai.data!.length}: <span className="text-bull">{counts.up} bullish</span> · <span className="text-bear">{counts.down} bearish</span>
        </p>
      )}
      <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
        {data.length === 0 && <li className="text-xs text-muted-foreground">No news available right now.</li>}
        {data.map((n) => {
          const a = byTitle.get(n.title);
          const tone = a ? (a.impact === "bullish" ? "positive" : a.impact === "bearish" ? "negative" : "neutral") : n.sentiment;
          return (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer" className={`news-item news-${tone}`}>
                <span className="block text-sm leading-snug">{n.title}</span>
                {a && (
                  <span className="mt-1 block text-xs text-foreground/80">
                    <b className="font-mono uppercase">{a.impact}</b> · {Math.round(a.confidence * 100)}% — {a.explanation}
                  </span>
                )}
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{n.source} · {timeAgo(n.publishedAt)}{a ? " · AI" : ` · ${n.sentiment}`}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
