import { describe, expect, it } from "vitest";
import { parseEtfValue, parsePublicEtfTable, missingWeekdays } from "./public-etf";

describe("Free public daily ETF estimates", () => {
  it("preserves missing figures instead of fabricating zero", () => {
    expect(parseEtfValue("—")).toBeNull();
    expect(parseEtfValue("-")).toBeNull();
    expect(parseEtfValue("")).toBeNull();
    expect(parseEtfValue("0.0")).toBe(0);
  });
  it("keeps published million-dollar units and negative values", () => {
    expect(parseEtfValue("(95.1)")).toBe(-95.1);
    expect(parseEtfValue("1,111.7")).toBe(1111.7);
  });
  it("extracts dated issuer rows and excludes summaries", () => {
    const parsed = parsePublicEtfTable('<table><tr><th>Date</th><th>IBIT</th><th>FBTC</th><th>Totals</th></tr><tr><td>Oct 29, 2026</td><td>12.4</td><td>-</td><td>—</td></tr><tr><td>Total</td><td>999</td></tr></table>');
    expect(parsed.days).toEqual([{ date: "2026-10-29", total: null, flows: { IBIT: 12.4 }, missing: ["FBTC"] }]);
  });
  it("flags unreported weekdays without counting weekends", () => {
    const missing = missingWeekdays(["2026-10-29"], Date.UTC(2026, 10, 1));
    expect(missing).toContain("2026-10-30");
    expect(missing).not.toContain("2026-10-31");
    expect(missing).not.toContain("2026-10-29");
  });
  it("rejects blocked or changed tables without sample fallback", () => {
    expect(() => parsePublicEtfTable("<html>Access denied</html>")).toThrow("No sample figures");
  });
});