import { describe, expect, it } from "vitest";
import { largeTransactions, parseMempool, parseRecentTransactions } from "./public-bitcoin";

const tx = (value: number) => ({ txid: "a".repeat(64), value, fee: 1200, vsize: 220 });
describe("free Bitcoin monitoring", () => {
  it("converts output satoshis to BTC, not a buy or sell amount", () => {
    expect(parseRecentTransactions([tx(5_000_000_000)])[0]?.outputBtc).toBe(50);
  });
  it("includes the 50 BTC boundary and excludes smaller outputs", () => {
    expect(largeTransactions(parseRecentTransactions([tx(4_999_999_999), tx(5_000_000_000), tx(10_000_000_000)]), 50).map(t => t.outputBtc)).toEqual([100, 50]);
  });
  it("rejects invalid or missing amounts rather than inventing transactions", () => {
    expect(parseRecentTransactions([{ txid: "a".repeat(64), fee: 1, vsize: 1 }, tx(-1)])).toEqual([]);
  });
  it("preserves mempool counts, fee rates and total fee units", () => {
    const result = parseMempool({ count: 123, vsize: 2000000, total_fee: 150000000 }, { fastestFee: 8, halfHourFee: 5, hourFee: 3, economyFee: 2 }, [tx(5000000000)], 123456);
    expect(result).toMatchObject({ count: 123, vsize: 2000000, totalFeeBtc: 1.5, fees: { fastestFee: 8, halfHourFee: 5, hourFee: 3, economyFee: 2 }, sampled: 1, fetchedAt: 123456 });
  });
});