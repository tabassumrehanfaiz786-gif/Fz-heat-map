import type { DivergenceResult } from "@/lib/ai.functions";

export type ReportRow = { date: string; total: number; priceChg: number | null; news: number; conflict: boolean; diverged: boolean };
export type ReportIssuer = { t: string; name: string; inflow: number; outflow: number; net: number; lastDate: string | null; status: string };

export async function exportDivergencePdf(opts: {
  source: string; updated: string; rows: ReportRow[]; issuers: ReportIssuer[]; ai: DivergenceResult | undefined; headlines: { date: string; title: string; tone: string }[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  let y = M;
  const need = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const text = (s: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, W - M * 2) as string[];
    need(lines.length * size * 1.3);
    doc.text(lines, M, y + size); y += lines.length * size * 1.3;
  };
  const GREEN: [number, number, number] = [22, 150, 70], RED: [number, number, number] = [200, 40, 40], GREY: [number, number, number] = [110, 110, 110];

  text("Fz Heatmap — 30-day ETF flow & news divergence report", 16, true);
  text(`Source: ${opts.source} · Data updated: ${opts.updated} · Generated: ${new Date().toUTCString()}`, 8, false, GREY);
  y += 8;

  const withP = opts.rows.filter((r) => r.priceChg != null);
  const div = withP.filter((r) => r.diverged), conf = opts.rows.filter((r) => r.conflict);
  const tin = opts.rows.reduce((a, r) => a + Math.max(0, r.total), 0), tout = opts.rows.reduce((a, r) => a + Math.min(0, r.total), 0);
  text("Summary", 12, true);
  text(`Total inflows +$${tin.toFixed(0)}M, outflows $${tout.toFixed(0)}M, net $${(tin + tout).toFixed(0)}M over ${opts.rows.length} trading days.`);
  text(`BTC price moved opposite to ETF flows on ${div.length} of ${withP.length} days. News tone conflicted with flow direction on ${conf.length} day(s).`);
  y += 6;

  // chart
  need(150);
  text("Daily net flow (bars) vs BTC daily % (line)", 10, true);
  const cx = M, cw = W - M * 2, ch = 120, cy = y + 4, mid = cy + ch / 2;
  const fmax = Math.max(1, ...opts.rows.map((r) => Math.abs(r.total))), pmax = Math.max(0.5, ...withP.map((r) => Math.abs(r.priceChg!)));
  const bw = cw / Math.max(1, opts.rows.length);
  doc.setDrawColor(200); doc.line(cx, mid, cx + cw, mid);
  opts.rows.forEach((r, i) => {
    if (r.diverged || r.conflict) { doc.setFillColor(255, 235, 200); doc.rect(cx + i * bw, cy, bw, ch, "F"); }
    const h = (Math.abs(r.total) / fmax) * (ch / 2 - 4);
    doc.setFillColor(...(r.total >= 0 ? GREEN : RED));
    doc.rect(cx + i * bw + 1, r.total >= 0 ? mid - h : mid, Math.max(1, bw - 2), h, "F");
  });
  doc.setDrawColor(20); doc.setLineWidth(1.2);
  let prev: [number, number] | null = null;
  opts.rows.forEach((r, i) => {
    if (r.priceChg == null) return;
    const p: [number, number] = [cx + i * bw + bw / 2, mid - (r.priceChg / pmax) * (ch / 2 - 4)];
    if (prev) doc.line(prev[0], prev[1], p[0], p[1]);
    prev = p;
  });
  doc.setLineWidth(0.5);
  y = cy + ch + 8;
  text("Shaded = flow/price or flow/news disagreement.", 7, false, GREY);
  y += 6;

  text("Top issuers (30 days)", 12, true);
  const cols = [M, M + 50, M + 170, M + 245, M + 320, M + 395, M + 465];
  const head = ["Ticker", "Issuer", "Inflow", "Outflow", "Net", "Last data", "Status"];
  need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GREY);
  head.forEach((h, i) => doc.text(h, cols[i]!, y + 8)); y += 14;
  doc.setFont("helvetica", "normal");
  for (const r of opts.issuers) {
    need(12); doc.setTextColor(30, 30, 30);
    doc.text(r.t, cols[0]!, y + 8); doc.text(r.name.slice(0, 22), cols[1]!, y + 8);
    doc.setTextColor(...GREEN); doc.text(`+${r.inflow.toFixed(0)}M`, cols[2]!, y + 8);
    doc.setTextColor(...RED); doc.text(`${r.outflow.toFixed(0)}M`, cols[3]!, y + 8);
    doc.setTextColor(...(r.net >= 0 ? GREEN : RED)); doc.text(`${r.net.toFixed(0)}M`, cols[4]!, y + 8);
    doc.setTextColor(30, 30, 30); doc.text(r.lastDate ?? "—", cols[5]!, y + 8);
    doc.setTextColor(...(r.status === "ok" ? GREEN : RED)); doc.text(r.status, cols[6]!, y + 8);
    y += 12;
  }
  y += 8;

  text("Divergent days", 12, true);
  for (const r of opts.rows.filter((r) => r.diverged || r.conflict)) {
    const parts = [`${r.date}: ETF ${r.total >= 0 ? "inflow +" : "outflow "}${r.total.toFixed(0)}M`];
    if (r.priceChg != null) parts.push(`BTC ${r.priceChg >= 0 ? "+" : ""}${r.priceChg.toFixed(2)}%`);
    if (r.news) parts.push(`news tone ${r.news > 0 ? "positive" : "negative"}`);
    if (r.conflict) parts.push("NEWS vs FLOW CONFLICT");
    text(parts.join(" · "), 9);
  }
  y += 6;

  if (opts.ai) {
    text("AI analysis", 12, true);
    text(opts.ai.summary, 9);
    text(`News vs price: ${opts.ai.newsTone}`, 9);
    for (const it of opts.ai.items) text(`${it.date} — ${it.explanation}`, 9);
    y += 6;
  }

  if (opts.headlines.length) {
    text("Major headlines considered", 12, true);
    for (const h of opts.headlines.slice(0, 20)) text(`${h.date} [${h.tone}] ${h.title}`, 8, false, h.tone === "positive" ? GREEN : h.tone === "negative" ? RED : [30, 30, 30]);
  }
  text("Not investment advice. Analysis is indicative; causes of divergences are uncertain.", 7, false, GREY);
  doc.save(`fz-heatmap-etf-divergence-${new Date().toISOString().slice(0, 10)}.pdf`);
}
