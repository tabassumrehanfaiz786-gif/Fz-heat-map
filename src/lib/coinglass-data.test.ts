import { describe, expect, it } from "vitest";
import { parseCoinGlassDays } from "./coinglass-data";

describe("CoinGlass licensed issuer flows", () => {
  it("converts real USD values to millions and retains issuer tickers", () => {
    const days = parseCoinGlassDays({ code: "0", data: [{ timestamp: 1704931200000, flow_usd: 655300000, etf_flows: [{ etf_ticker: "IBIT", flow_usd: 111700000 }, { etf_ticker: "FBTC", flow_usd: 227000000 }, { etf_ticker: "GBTC", flow_usd: -95100000 }] }] });
    expect(days[0]).toEqual({ date: "2024-01-11", total: 655.3, flows: { IBIT: 111.7, FBTC: 227, GBTC: -95.1 } });
  });
  it("does not turn missing issuer values into zero flows", () => {
    const days = parseCoinGlassDays({ code: "0", data: [{ timestamp: 1704931200000, flow_usd: 0, etf_flows: [{ etf_ticker: "IBIT", flow_usd: null }, { etf_ticker: "FBTC", flow_usd: 0 }] }] });
    expect(days[0]?.flows).toEqual({ FBTC: 0 });
  });
  it("rejects unsuccessful responses without echoing provider messages", () => {
    expect(() => parseCoinGlassDays({ code: "401", msg: "private provider details" })).toThrow("CoinGlass could not authorize ETF data. Check your API key and plan.");
  });
});