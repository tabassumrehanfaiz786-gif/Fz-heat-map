import { describe, it, expect } from "vitest";
import { computeInav } from "./etf-inav";

const series = [{ t: 1000, p: 100000 }, { t: 5000, p: 101000 }];
const q = (price: number) => ({ ticker: "IBIT", price, time: 5000, prevClose: 50, prevCloseTime: 1000 });

describe("computeInav", () => {
  it("scales prior close by BTC move", () => {
    expect(computeInav(q(50.5), series)!.inav).toBeCloseTo(50.5, 6);
  });
  it("flags creation above +0.25% premium", () => {
    expect(computeInav(q(50.7), series)!.signal).toBe("creation");
  });
  it("flags redemption below -0.25% discount", () => {
    expect(computeInav(q(50.3), series)!.signal).toBe("redemption");
  });
  it("returns null with no BTC price near the quote", () => {
    expect(computeInav({ ...q(50), time: 99999 }, series)).toBeNull();
  });
});
