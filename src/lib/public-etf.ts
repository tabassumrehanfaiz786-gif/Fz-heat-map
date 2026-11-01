import { load } from "cheerio/slim";

export const PUBLIC_ETF_URL = "https://bitbo.io/treasuries/etf-flows/";
export const PUBLIC_ETF_SOURCE = "Bitbo · holdings-based estimates";
export type PublicEtfDay = { date: string; total: number | null; flows: Record<string, number>; missing: string[] };

export function parseEtfValue(text: string): number | null {
  const value = text.trim().replace(/,/g, "");
  if (!/^(?:-?\d+(?:\.\d+)?|\(\d+(?:\.\d+)?\))$/.test(value)) return null;
  const number = value.startsWith("(") ? -Number(value.slice(1, -1)) : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parsePublicEtfTable(html: string): { days: PublicEtfDay[]; tickers: string[] } {
  const $ = load(html);
  let tickers: string[] = [];
  const days = new Map<string, PublicEtfDay>();
  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    const header = rows.find((row) => $(row).find("th,td").first().text().trim() === "Date");
    if (!header) return;
    const columns = $(header).find("th,td").toArray().map((cell) => $(cell).text().trim());
    if (!columns.includes("IBIT") || !columns.includes("FBTC")) return;
    tickers = columns.filter((column) => /^[A-Z]{2,5}$/.test(column));
    for (const row of rows) {
      const cells = $(row).find("td").toArray().map((cell) => $(cell).text().trim());
      const label = cells[0] ?? "";
      if (!/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(label)) continue;
      const timestamp = Date.parse(`${label} 00:00:00 UTC`);
      if (!Number.isFinite(timestamp)) continue;
      const date = new Date(timestamp).toISOString().slice(0, 10);
      const flows: Record<string, number> = {};
      const missing: string[] = [];
      for (const ticker of tickers) {
        const value = parseEtfValue(cells[columns.indexOf(ticker)] ?? "");
        if (value === null) missing.push(ticker); else flows[ticker] = value;
      }
      const totalIndex = columns.findIndex((column) => /^Totals?$/i.test(column));
      days.set(date, { date, flows, missing, total: parseEtfValue(cells[totalIndex] ?? "") });
    }
  });
  if (!days.size) throw new Error("Public ETF table unavailable or its format changed. No sample figures shown.");
  return { tickers, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function missingWeekdays(dates: string[], now: number): string[] {
  const reported = new Set(dates);
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
  const missing: string[] = [];
  for (const day = start; day < end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() % 6 !== 0 && !reported.has(day.toISOString().slice(0, 10))) missing.push(day.toISOString().slice(0, 10));
  }
  return missing;
}