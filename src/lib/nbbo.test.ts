import { describe, it, expect } from "vitest";
import { computeNbbo } from "./nbbo";

const now = 10_000;
describe("computeNbbo", () => {
  it("picks highest bid and lowest ask across venues", () => {
    const n = computeNbbo([{ venue: "A", bid: 100, ask: 102, ts: now }, { venue: "B", bid: 101, ask: 103, ts: now }], now);
    expect(n.bestBid?.venue).toBe("B");
    expect(n.bestAsk?.venue).toBe("A");
    expect(n.spread).toBe(1);
  });
  it("flags crossed market when one venue's bid exceeds another's ask", () => {
    expect(computeNbbo([{ venue: "A", bid: 100, ask: 101, ts: now }, { venue: "B", bid: 102, ask: 103, ts: now }], now).state).toBe("crossed");
  });
  it("excludes quotes older than 5 seconds", () => {
    const n = computeNbbo([{ venue: "A", bid: 200, ask: 201, ts: now - 6000 }, { venue: "B", bid: 100, ask: 101, ts: now }], now);
    expect(n.bestBid?.venue).toBe("B");
    expect(n.stale).toEqual(["A"]);
  });
});
