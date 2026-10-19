import { createServerFn } from "@tanstack/react-start";

export type Impact = { index: number; impact: "bullish" | "bearish" | "neutral"; confidence: number; explanation: string };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "impact", "confidence", "explanation"],
        properties: {
          index: { type: "integer" },
          impact: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          confidence: { type: "number" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

async function streamJson<T>(system: string, user: string, name: string, schema: object): Promise<T> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      store: false,
      stream: true,
      input: [{ role: "system", content: system }, { role: "user", content: user }],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI is busy — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are used up. Add credits in your workspace to keep analyzing.");
    throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev: { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "AI failed");
    }
  }
  return JSON.parse(text) as T;
}

export const analyzeHeadlines = createServerFn({ method: "POST" })
  .inputValidator((input: { titles: string[] }) => {
    if (!input || !Array.isArray(input.titles)) throw new Error("titles required");
    return { titles: input.titles.slice(0, 20).map((t) => String(t).slice(0, 300)) };
  })
  .handler(async ({ data }) => {
    const list = data.titles.map((t, i) => `${i}. ${t}`).join("\n");
    const parsed = await streamJson<{ items: Impact[] }>(
      "You are a crypto market analyst. For each headline, classify its likely short-term impact on the BTC price as bullish, bearish or neutral, give confidence 0-1, and a one-sentence explanation (max 25 words). Return one item per headline using its index.",
      list, "btc_impact", schema);
    return parsed.items;
  });

export type DivergenceDay = { date: string; flow: number; priceChg: number };
export type DivergenceResult = { summary: string; newsTone: string; items: { date: string; explanation: string }[] };

const divSchema = {
  type: "object", additionalProperties: false, required: ["summary", "newsTone", "items"],
  properties: {
    summary: { type: "string" },
    newsTone: { type: "string" },
    items: { type: "array", items: { type: "object", additionalProperties: false, required: ["date", "explanation"], properties: { date: { type: "string" }, explanation: { type: "string" } } } },
  },
};

export const analyzeDivergence = createServerFn({ method: "POST" })
  .inputValidator((input: { days: DivergenceDay[]; headlines: string[] }) => {
    if (!input || !Array.isArray(input.days)) throw new Error("days required");
    return {
      days: input.days.slice(-31).map((d) => ({ date: String(d.date).slice(0, 10), flow: Number(d.flow) || 0, priceChg: Number(d.priceChg) || 0 })),
      headlines: (input.headlines ?? []).slice(0, 25).map((h) => String(h).slice(0, 250)),
    };
  })
  .handler(async ({ data }) => {
    const table = data.days.map((d) => `${d.date}: ETF net flow ${d.flow >= 0 ? "+" : ""}${d.flow.toFixed(1)}M USD, BTC ${d.priceChg >= 0 ? "+" : ""}${d.priceChg.toFixed(2)}%`).join("\n");
    return streamJson<DivergenceResult>(
      "You are a BTC market analyst. Compare daily spot BTC ETF net flows with BTC daily price change and recent news headlines. Identify days where flows and price moved in OPPOSITE directions (inflow but price fell, or outflow but price rose) and explain why the news/flow did not correspond with the market reaction (e.g. derivatives liquidations, macro, profit taking, basis trades, flow reported after the move). summary: 3-4 sentences on overall correlation. newsTone: one sentence on whether the news tone matched price action. items: one entry per notable divergent day (max 8), explanation max 30 words. Be honest when causes are uncertain.",
      `Daily data:\n${table}\n\nRecent headlines:\n${data.headlines.map((h) => "- " + h).join("\n")}`,
      "etf_divergence", divSchema);
  });

export type TripleDay = { date: string; etfFlow: number; onChainUsd: number; priceChg: number; headlines: string[] };
export type TripleResult = {
  verdict: string;
  days: { date: string; signal: "confirmed" | "paper-disconnect" | "noise" | "unclear"; explanation: string }[];
};

const tripleSchema = {
  type: "object", additionalProperties: false, required: ["verdict", "days"],
  properties: {
    verdict: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["date", "signal", "explanation"],
        properties: {
          date: { type: "string" },
          signal: { type: "string", enum: ["confirmed", "paper-disconnect", "noise", "unclear"] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

export const analyzeTripleVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { days: TripleDay[] }) => {
    if (!input || !Array.isArray(input.days)) throw new Error("days required");
    return {
      days: input.days.slice(-31).map((d) => ({
        date: String(d.date).slice(0, 10),
        etfFlow: Number(d.etfFlow) || 0,
        onChainUsd: Number(d.onChainUsd) || 0,
        priceChg: Number(d.priceChg) || 0,
        headlines: (d.headlines ?? []).slice(0, 3).map((h) => String(h).slice(0, 200)),
      })),
    };
  })
  .handler(async ({ data }) => {
    const table = data.days
      .map((d) => `${d.date}: ETF flow ${d.etfFlow >= 0 ? "+" : ""}${d.etfFlow.toFixed(1)}M USD, on-chain custodian net ${d.onChainUsd >= 0 ? "+" : ""}${d.onChainUsd.toFixed(1)}M USD, BTC ${d.priceChg >= 0 ? "+" : ""}${d.priceChg.toFixed(2)}% | news: ${d.headlines.join(" ; ") || "none"}`)
      .join("\n");
    return streamJson<TripleResult>(
      "You are a crypto market-structure analyst. For each day you get three signals: reported ETF net flow, on-chain net movement of issuer/custodian wallets (Arkham labels), BTC price change, and news headlines. Classify each day: 'confirmed' = ETF flow direction matches on-chain movement (real settlement behind the reported flow); 'paper-disconnect' = ETF flow reported but on-chain wallets moved the opposite way or not at all (internal netting or timing gap); 'noise' = big news but no institutional flow either way (retail/derivatives-driven move); 'unclear' = mixed or insufficient data. verdict: 3-4 sentences on how often the three layers agreed and what that implies about market integrity. days: one entry per notable day (max 10), explanation max 30 words. Be honest about uncertainty; on-chain data lags and custodians net flows internally.",
      `Daily data:\n${table}`,
      "triple_verification", tripleSchema);
  });
