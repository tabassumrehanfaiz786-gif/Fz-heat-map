import { createServerFn } from "@tanstack/react-start";
import { fetchCoinGlassDays } from "./coinglass.server";

export type EtfRow = { ticker: string; issuer: string; today: number; week: number };
export type EtfResult = { configured: boolean; provider: string; rows: EtfRow[]; date?: string | undefined; error?: string | undefined };

const ISSUERS: Record<string, string> = {
  IBIT: "BlackRock", FBTC: "Fidelity", GBTC: "Grayscale", BTC: "Grayscale Mini", ARKB: "ARK 21Shares",
  BITB: "Bitwise", HODL: "VanEck", BRRR: "Valkyrie/CoinShares", EZBC: "Franklin", BTCO: "Invesco Galaxy",
  BTCW: "WisdomTree", MSBT: "Morgan Stanley", DEFI: "Hashdex",
};

async function coinglass(key: string): Promise<EtfResult> {
  const days = await fetchCoinGlassDays(key);
  const last5 = days.slice(-5), lastDay = last5.at(-1);
  if (!lastDay) return { configured: true, provider: "CoinGlass", rows: [], error: "No ETF flow data returned." };
  const map = new Map<string, EtfRow>();
  for (const d of last5) for (const [ticker, m] of Object.entries(d.flows)) {
    const r = map.get(ticker) ?? { ticker, issuer: ISSUERS[ticker] ?? ticker, today: 0, week: 0 };
    r.week += m;
    if (d === lastDay) r.today = m;
    map.set(ticker, r);
  }
  return { configured: true, provider: "CoinGlass", rows: [...map.values()].filter((r) => r.ticker in lastDay.flows).sort((a, b) => Math.abs(b.week) - Math.abs(a.week)), date: lastDay.date };
}

async function sosovalue(key: string): Promise<EtfResult> {
  const res = await fetch("https://api.sosovalue.xyz/openapi/v2/etf/currentEtfDataMetrics", {
    method: "POST",
    headers: { "x-soso-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "us-btc-spot" }),
  });
  const body = await res.text();
  if (!res.ok) return { configured: true, provider: "SoSoValue", rows: [], error: `SoSoValue error [${res.status}]: ${body.slice(0, 200)}` };
  const json = JSON.parse(body);
  const list: { ticker: string; dailyNetInflow?: { value?: number | string; lastUpdateDate?: string } }[] = json.data?.list ?? [];
  if (!list.length) return { configured: true, provider: "SoSoValue", rows: [], error: json.msg || "No data returned" };
  const rows = list.map((e) => {
    const t = Number(e.dailyNetInflow?.value ?? 0) / 1e6;
    return { ticker: e.ticker, issuer: ISSUERS[e.ticker] ?? e.ticker, today: t, week: t };
  });
  return { configured: true, provider: "SoSoValue", rows: rows.sort((a, b) => Math.abs(b.today) - Math.abs(a.today)), date: list[0]?.dailyNetInflow?.lastUpdateDate };
}

export const getEtfFlows = createServerFn({ method: "GET" })
  .inputValidator((input: { provider: string }) => ({ provider: input?.provider === "sosovalue" ? "sosovalue" : "coinglass" }))
  .handler(async ({ data }): Promise<EtfResult> => {
    try {
      if (data.provider === "sosovalue") {
        const k = process.env['SOSOVALUE_API_KEY'];
        return k ? await sosovalue(k) : { configured: false, provider: "SoSoValue", rows: [] };
      }
      const k = process.env['COINGLASS_API_KEY'];
      return k ? await coinglass(k) : { configured: false, provider: "CoinGlass", rows: [] };
    } catch (e) {
      return { configured: true, provider: data.provider, rows: [], error: e instanceof Error ? e.message : "Failed" };
    }
  });

export type EtfDay = { date: string; total: number; flows: Record<string, number> };
export type EtfHistory = { configured: boolean; provider: string; days: EtfDay[]; error?: string | undefined; fetchedAt?: number | undefined };

export const getEtfHistory = createServerFn({ method: "GET" })
  .inputValidator((input: { provider: string }) => ({ provider: input?.provider === "sosovalue" ? "sosovalue" : "coinglass" }))
  .handler(async ({ data }): Promise<EtfHistory> => {
    try {
      if (data.provider === "sosovalue") {
        const k = process.env['SOSOVALUE_API_KEY'];
        if (!k) return { configured: false, provider: "SoSoValue", days: [] };
        const res = await fetch("https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart", {
          method: "POST", headers: { "x-soso-api-key": k, "Content-Type": "application/json" }, body: JSON.stringify({ type: "us-btc-spot" }),
        });
        const body = await res.text();
        if (!res.ok) return { configured: true, provider: "SoSoValue", days: [], error: `SoSoValue error [${res.status}]: ${body.slice(0, 200)}` };
        const list: { date: string; totalNetInflow?: number | string }[] = JSON.parse(body).data ?? [];
        const days = list.map((d) => ({ date: d.date, total: Number(d.totalNetInflow ?? 0) / 1e6, flows: {} })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
        return { configured: true, provider: "SoSoValue", days, fetchedAt: Date.now() };
      }
      const k = process.env['COINGLASS_API_KEY'];
      if (!k) return { configured: false, provider: "CoinGlass", days: [] };
      const days = await fetchCoinGlassDays(k);
      return { configured: true, provider: "CoinGlass", days, fetchedAt: Date.now() };
    } catch (e) {
      return { configured: true, provider: data.provider, days: [], error: e instanceof Error ? e.message : "Failed" };
    }
  });

export function issuerName(t: string) {
  return ISSUERS[t] ?? t;
}
