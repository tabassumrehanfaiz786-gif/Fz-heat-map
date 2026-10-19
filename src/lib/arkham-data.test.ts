import { describe, expect, it } from "vitest";
import { aggregateByDay, dailyEntityFlows, parseArkhamTransfer, sampleVaultTransfers } from "./arkham-data";

const raw = {
  transactionHash: "abc123",
  blockTimestamp: "2026-10-10T12:00:00Z",
  tokenValue: 12.5,
  unit: "BTC",
  historicalUSD: 1_350_000,
  fromAddress: { arkhamEntity: { id: "otc-desk" } },
  toAddress: { arkhamEntity: { id: "blackrock" } },
};

describe("parseArkhamTransfer", () => {
  it("parses an inbound transfer with signed BTC", () => {
    const t = parseArkhamTransfer("blackrock", raw);
    expect(t).not.toBeNull();
    expect(t!.direction).toBe("in");
    expect(t!.btc).toBe(12.5);
    expect(t!.usd).toBe(1_350_000);
    expect(t!.counterparty).toBe("otc-desk");
  });

  it("marks outbound when only the sender is labeled", () => {
    const t = parseArkhamTransfer("grayscale", { ...raw, fromAddress: { arkhamEntity: { id: "grayscale" } }, toAddress: {} });
    expect(t!.direction).toBe("out");
    expect(t!.btc).toBe(-12.5);
  });

  it("rejects rows without a hash or valid time", () => {
    expect(parseArkhamTransfer("x", { ...raw, transactionHash: undefined })).toBeNull();
    expect(parseArkhamTransfer("x", { ...raw, blockTimestamp: "not-a-date" })).toBeNull();
    expect(parseArkhamTransfer("x", null)).toBeNull();
  });
});

describe("aggregation", () => {
  it("aggregates net flow per day and per entity", () => {
    const transfers = sampleVaultTransfers(1_760_000_000_000);
    const days = aggregateByDay(transfers);
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((d) => d.transfers > 0)).toBe(true);
    const entity = dailyEntityFlows(transfers);
    const blackrockDays = Object.values(entity).filter((d) => "blackrock" in d);
    expect(blackrockDays.length).toBeGreaterThan(0);
  });
});
