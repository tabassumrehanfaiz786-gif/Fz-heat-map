import { z } from "zod";

const finiteNumber = z.number().finite();
const flowSchema = z.object({ etf_ticker: z.string().min(1).max(12), flow_usd: finiteNumber.nullish() });
const responseSchema = z.object({
  code: z.union([z.string(), z.number()]),
  data: z.array(z.object({ timestamp: finiteNumber, flow_usd: finiteNumber.nullish(), etf_flows: z.array(flowSchema).optional() })).optional(),
});

export function parseCoinGlassDays(input: unknown) {
  const response = responseSchema.safeParse(input);
  if (!response.success) throw new Error("CoinGlass returned an unsupported data format.");
  if (String(response.data.code) !== "0") throw new Error("CoinGlass could not authorize ETF data. Check your API key and plan.");
  return (response.data.data ?? []).flatMap((day) => {
    const timestamp = day.timestamp < 1e12 ? day.timestamp * 1000 : day.timestamp;
    if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 8.64e15) return [];
    const flows: Record<string, number> = {};
    for (const flow of day.etf_flows ?? []) {
      if (flow.flow_usd != null) flows[flow.etf_ticker.toUpperCase()] = flow.flow_usd / 1e6;
    }
    if (day.flow_usd == null && Object.keys(flows).length === 0) return [];
    return [{ date: new Date(timestamp).toISOString().slice(0, 10), total: day.flow_usd != null ? day.flow_usd / 1e6 : Object.values(flows).reduce((sum, value) => sum + value, 0), flows }];
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
}