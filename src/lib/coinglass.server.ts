import { parseCoinGlassDays } from "./coinglass-data";

export async function fetchCoinGlassDays(key: string) {
  const response = await fetch("https://open-api-v4.coinglass.com/api/etf/bitcoin/flow-history", {
    headers: { "CG-API-KEY": key, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403) throw new Error("CoinGlass rejected the key or your plan does not include ETF flows.");
  if (response.status === 429) throw new Error("CoinGlass request limit reached. Try again shortly.");
  if (!response.ok) throw new Error("CoinGlass is unavailable. Try again shortly.");
  const days = parseCoinGlassDays(await response.json());
  if (!days.length) throw new Error("CoinGlass returned no ETF flow data.");
  return days;
}