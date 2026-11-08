const MODULES = [
  {
    tab: "Algo",
    law: "UK MAR Art. 12(1)(a)–(b) · Art. 16",
    question:
      "Can Level-2 refill and vanishing-wall heuristics separate possible spoofing or layering from legitimate liquidity provision?",
    limit:
      "Public L2 data has no order IDs, so it cannot tell cancellations from fills, or show who traded or why.",
  },
  {
    tab: "NBBO",
    law: "UK MiFIR consolidated tape · best execution (COBS 11.2A)",
    question:
      "How fragmented are prices across venues, and why does a consolidated tape matter for best execution?",
    limit:
      "This is a synthetic tape, not an official NBBO. USD and USDT quotes mix, and latency varies by venue.",
  },
  {
    tab: "iNAV",
    law: "ETF disclosure · Authorised Participant creation/redemption",
    question:
      "How large are intraday premium/discount gaps, and when would AP arbitrage be expected to close them?",
    limit:
      "iNAV is estimated from holdings and spot price; real AP activity is not observable.",
  },
  {
    tab: "Flows 30D · Events",
    law: "Disclosure, information asymmetry · UK MAR Art. 7 & 14",
    question:
      "Do published ETF flows and news sentiment point the same way, and which better matched later BTC returns?",
    limit:
      "Flows are daily, delayed, and estimated. Samples are small, sentiment is keyword-based, and correlation is not causation.",
  },
  {
    tab: "Chain",
    law: "Custody, transparency, AML attribution",
    question: "What can public mempool data reveal about large transfers, and what can it not?",
    limit:
      "Raw outputs show no owner, direction, OTC desk, or issuer. They are never treated as institutional trades.",
  },
];

export function ResearchMethodology() {
  return (
    <div className="panel flex min-h-0 flex-1 flex-col overflow-y-auto p-3 text-xs leading-relaxed">
      <h2 className="text-sm font-semibold text-foreground">Research &amp; legal methodology</h2>
      <p className="mt-1 text-muted-foreground">
        Fz Heatmap &amp; Newsflow is an empirical research tool. It explores how far public market data
        can support market-integrity oversight under UK financial regulation. It is not a trading system.
        Its signals are statistical anomalies, not evidence of intent or identity.
      </p>

      <h3 className="mt-4 font-semibold text-foreground">Research question</h3>
      <p className="mt-1 text-muted-foreground">
        How far can open, aggregated market data detect possible manipulation and information
        divergence in fragmented Bitcoin and spot-ETF markets? And where does detection end and
        regulatory enforcement have to take over?
      </p>

      <h3 className="mt-4 font-semibold text-foreground">Module → legal framework</h3>
      <div className="mt-2 space-y-2">
        {MODULES.map((m) => (
          <div key={m.tab} className="rounded border border-border p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <span className="font-semibold text-primary">{m.tab}</span>
              <span className="text-[10px] text-muted-foreground">{m.law}</span>
            </div>
            <p className="mt-1 text-foreground">{m.question}</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium">Limit: </span>
              {m.limit}
            </p>
          </div>
        ))}
      </div>

      <h3 className="mt-4 font-semibold text-foreground">Detection vs. enforcement</h3>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
        <li>UK MAR civil market abuse does not require proof of intent, but regulators rely on order-level and identity data (MAR Art. 16 STORs, MiFIR transaction reporting) that public feeds lack.</li>
        <li>Without Level-3 market-by-order data, a heuristic flag is a reason to investigate, not a finding.</li>
        <li>Crypto spot markets largely fall outside UK MAR today. The planned UK cryptoasset regime would add a market-abuse framework. This project tests what that oversight would need.</li>
      </ul>

      <h3 className="mt-4 font-semibold text-foreground">Data provenance</h3>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
        <li>Order book and trades: Binance and Coinbase public feeds (live).</li>
        <li>Cross-venue quotes: Binance, Coinbase, OKX, Kraken public APIs.</li>
        <li>ETF flows: Bitbo public holdings-based estimates (daily, about 10 days). Missing values are shown as missing, never filled in.</li>
        <li>News: public RSS headlines, with AI and keyword sentiment labels.</li>
        <li>On-chain: mempool.space public data (unlabelled).</li>
      </ul>

      <p className="mt-4 border-t border-border pt-2 text-[10px] text-muted-foreground">
        Independent research by Faizan Rehan. For academic discussion only; not legal or investment advice.
      </p>
    </div>
  );
}
