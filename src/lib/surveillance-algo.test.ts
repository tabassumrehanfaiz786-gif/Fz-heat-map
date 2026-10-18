import { describe, it, expect } from "vitest";
import { IcebergDetector, detectTwap, liquidityAsymmetry, type Trade } from "./surveillance-algo";

describe("iceberg detector", () => {
  it("flags a level executed beyond 2.5x visible with 2+ refills", () => {
    const d = new IcebergDetector(1, 0.5);
    const bids = new Map([[100, 1]]);
    for (let i = 0; i < 3; i++) {
      d.onTrade({ price: 100, qty: 1, time: i * 1000, side: "sell" }, 1);
      d.onBook(new Map([[100, 0.2]]), new Map(), i * 1000 + 100);
      d.onBook(bids, new Map(), i * 1000 + 200);
    }
    const ev = d.events(3000);
    expect(ev).toHaveLength(1);
    expect(ev[0].passiveSide).toBe("bid");
    expect(ev[0].refills).toBeGreaterThanOrEqual(2);
  });
  it("does not flag when executed is below 2.5x visible", () => {
    const d = new IcebergDetector(1, 0.1);
    d.onTrade({ price: 100, qty: 2, time: 0, side: "sell" }, 1);
    d.onBook(new Map([[100, 0.5]]), new Map(), 1); d.onBook(new Map([[100, 1]]), new Map(), 2);
    d.onBook(new Map([[100, 0.5]]), new Map(), 3); d.onBook(new Map([[100, 1]]), new Map(), 4);
    expect(d.events(5)).toHaveLength(0);
  });
});

describe("twap detector", () => {
  it("detects 5 evenly spaced equal slices", () => {
    const t: Trade[] = Array.from({ length: 6 }, (_, i) => ({ price: 100, qty: 0.5, time: i * 10_000, side: "buy" }));
    const ev = detectTwap(t);
    expect(ev).toHaveLength(1);
    expect(ev[0].slices).toBe(6);
    expect(Math.round(ev[0].intervalMs)).toBe(10_000);
  });
  it("ignores irregular timing", () => {
    const times = [0, 1000, 15000, 16000, 40000, 41000];
    expect(detectTwap(times.map((time) => ({ price: 100, qty: 0.5, time, side: "buy" as const })))).toHaveLength(0);
  });
});

it("asymmetry is +1 when only bid icebergs", () => {
  expect(liquidityAsymmetry([{ kind: "iceberg", price: 1, passiveSide: "bid", executed: 3, peakVisible: 1, refills: 2, ratio: 3, firstSeen: 0, lastSeen: 0 }])).toBe(1);
});
