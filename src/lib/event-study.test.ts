import { describe, it, expect } from "vitest";
import { findEvents, summarize, forwardFromCloses } from "./event-study";

const closes = { "2026-01-01": 100, "2026-01-02": 110, "2026-01-04": 90, "2026-01-08": 120 };
const days = [
  { date: "2026-01-01", total: 50, flows: { IBIT: 40 } },
  { date: "2026-01-02", total: -30, flows: { IBIT: -3 } },
];

describe("event study", () => {
  it("computes forward return over calendar days", () => {
    expect(forwardFromCloses(closes, "2026-01-01", 1)).toBeCloseTo(10);
    expect(forwardFromCloses(closes, "2026-01-01", 2)).toBeNull();
  });
  it("filters by issuer and minimum flow", () => {
    const ev = findEvents(days, closes, "IBIT", 5);
    expect(ev.map((e) => e.date)).toEqual(["2026-01-01"]);
    expect(ev[0]!.side).toBe("buy");
  });
  it("scores sell events as hits when price falls", () => {
    const s = summarize(findEvents(days, closes, "TOTAL", 5), [2]);
    expect(s[0]).toMatchObject({ n: 1, hitRate: 1 });
    expect(s[0]!.avg).toBeCloseTo(100 * (20 / 110));
  });
});
