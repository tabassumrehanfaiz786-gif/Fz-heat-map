import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { Settings2 } from "lucide-react";
import { LiveMarket, TFS, type TF } from "@/components/LiveMarket";
import { EtfFlows } from "@/components/EtfFlows";
import { NewsFeed, newsQuery } from "@/components/NewsFeed";
import { MacroCalendar } from "@/components/MacroCalendar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fz Heatmap — Live BTCUSDT order flow" },
      { name: "description", content: "Live BTCUSDT order book heatmap, big-order walls, bubble candles, ETF flows, AI news impact and macro calendar." },
      { property: "og:title", content: "Fz Heatmap — Live BTCUSDT order flow" },
      { property: "og:description", content: "Live BTCUSDT heatmap, ETF flows, AI news impact and macro calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(newsQuery).catch(() => []),
  component: Index,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-bear">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function Index() {
  const [tf, setTf] = useState<TF>("10m");
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background p-3 text-foreground lg:h-screen lg:overflow-hidden">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div className="logo-mark" />
        <h1 className="font-display text-xl font-bold tracking-tight">Fz <span className="text-primary">Heatmap</span></h1>
        <div className="ml-auto flex items-center gap-1">
          {TFS.map((t) => (
            <button key={t} className={`btn-chip ${tf === t ? "btn-chip-active" : ""}`} onClick={() => setTf(t)}>{t}</button>
          ))}
          <button className="btn-chip ml-2" aria-label="Settings" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="grid gap-3 lg:h-[calc(100vh-4.5rem)] lg:grid-cols-[1fr_360px]">
        <main className="min-h-[640px] lg:min-h-0">
          <ClientOnly fallback={<div className="panel h-full" />}>
            <LiveMarket tf={tf} />
          </ClientOnly>
        </main>
        <aside className="flex min-h-[600px] flex-col gap-3 lg:min-h-0">
          <EtfFlows onConfigure={() => setOpen(true)} />
          <Tabs defaultValue="news" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="news" className="flex-1">News</TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1">Calendar</TabsTrigger>
            </TabsList>
            <TabsContent value="news" className="flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<div className="panel flex-1" />}><NewsFeed /></Suspense>
            </TabsContent>
            <TabsContent value="calendar" className="flex min-h-0 flex-1 flex-col">
              <MacroCalendar />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <ClientOnly fallback={null}>
        <SettingsDialog open={open} onOpenChange={setOpen} />
      </ClientOnly>
    </div>
  );
}
