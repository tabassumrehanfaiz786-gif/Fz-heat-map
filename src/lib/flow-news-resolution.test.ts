import { describe, it, expect } from "vitest";
import { resolveConflicts, forwardReturn } from "./flow-news-resolution";

const rows = [
  { date: "d1", total: 100, news: -1, priceChg: 0 }, // conflict: flow up, news down
  { date: "d2", total: 0, news: 0, priceChg: 2 },
  { date: "d3", total: -50, news: 1, priceChg: 1 }, // conflict: flow down, news up
  { date: "d4", total: 0, news: 0, priceChg: 3 },
];

describe("flow vs news resolution", () => {
  it("credits flow when next-day price follows the flow", () => {
    expect(resolveConflicts(rows, [1])[0]).toMatchObject({ events: 2, flowWins: 1, newsWins: 1 });
  });
  it("skips events without enough forward data", () => {
    expect(resolveConflicts(rows, [3])[0].events).toBe(1);
  });
  it("ignores flows within the $5M noise floor", () => {
    expect(resolveConflicts([{ date: "a", total: 4, news: -1, priceChg: 0 }, { date: "b", total: 0, news: 0, priceChg: -1 }], [1])[0].events).toBe(0);
  });
  it("compounds forward returns", () => {
    expect(forwardReturn(rows, 1, 2)!).toBeCloseTo(4.03, 2);
  });
});
