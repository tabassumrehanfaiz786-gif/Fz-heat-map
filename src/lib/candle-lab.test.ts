import { describe, expect, it } from "vitest";
import { flowMarkers, WallTracker, type Candle } from "./candle-lab";

const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
const candles: Candle[] = ["2025-01-06", "2025-01-07", "2025-01-08"].map((d) => ({ t: day(d), o: 1, h: 1, l: 1, c: 1, v: 1 }));

describe("flowMarkers", () => {
  it("marks only BlackRock days at or beyond $300M", () => {
    const days = [
      { date: "2025-01-06", total: 900, flows: { IBIT: 299 } },
      { date: "2025-01-07", total: -50, flows: { IBIT: -310 } },
      { date: "2025-01-08", total: 10, flows: { IBIT: 300 } },
    ];
    const m = flowMarkers(days, candles, "IBIT", 300);
    expect(m.map((x) => [x.date, x.side])).toEqual([["2025-01-07", "out"], ["2025-01-08", "in"]]);
  });
  it("snaps a day to the weekly candle containing it", () => {
    const m = flowMarkers([{ date: "2025-01-08", total: 400, flows: {} }], [candles[0]!], "TOTAL", 300);
    expect(m[0]?.candleTime).toBe(day("2025-01-06"));
  });
});

describe("WallTracker", () => {
  it("reports a 50 BTC wall emerging then being pulled when filter is 50", () => {
    const w = new WallTracker(50);
    expect(w.apply("bid", 100, 49, 0)).toBeNull();
    expect(w.apply("bid", 100, 60, 1)?.kind).toBe("emerged");
    expect(w.apply("bid", 100, 0, 2)?.kind).toBe("pulled");
  });
  it("ignores walls above the selected max", () => {
    const w = new WallTracker(10, 100);
    expect(w.apply("ask", 1, 150, 0)).toBeNull();
  });
});
