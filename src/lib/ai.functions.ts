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

export const analyzeHeadlines = createServerFn({ method: "POST" })
  .inputValidator((input: { titles: string[] }) => {
    if (!input || !Array.isArray(input.titles)) throw new Error("titles required");
    return { titles: input.titles.slice(0, 20).map((t) => String(t).slice(0, 300)) };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const list = data.titles.map((t, i) => `${i}. ${t}`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        store: false,
        stream: true,
        input: [
          { role: "system", content: "You are a crypto market analyst. For each headline, classify its likely short-term impact on the BTC price as bullish, bearish or neutral, give confidence 0-1, and a one-sentence explanation (max 25 words). Return one item per headline using its index." },
          { role: "user", content: list },
        ],
        text: { format: { type: "json_schema", name: "btc_impact", strict: true, schema } },
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
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "AI failed");
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e;
        }
      }
    }
    const parsed = JSON.parse(text) as { items: Impact[] };
    return parsed.items;
  });
