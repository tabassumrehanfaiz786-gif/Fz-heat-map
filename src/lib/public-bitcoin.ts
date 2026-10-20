export type LargeTransaction = { txid: string; outputBtc: number; fee: number; vsize: number };
export type MempoolSnapshot = {
  count: number; vsize: number; totalFeeBtc: number;
  fees: { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number };
  transactions: LargeTransaction[]; sampled: number; fetchedAt: number;
};

const record = (x: unknown): Record<string, unknown> => x !== null && typeof x === "object" ? x as Record<string, unknown> : {};
const numeric = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;

export function parseRecentTransactions(input: unknown): LargeTransaction[] {
  if (!Array.isArray(input)) throw new Error("Bitcoin transaction data unavailable.");
  return input.flatMap((value) => {
    const t = record(value), amount = numeric(t['value']), fee = numeric(t['fee']), vsize = numeric(t['vsize']);
    const txid = t['txid'];
    if (typeof txid !== "string" || !/^[a-f0-9]{64}$/.test(txid) || amount === null || fee === null || vsize === null) return [];
    return [{ txid, outputBtc: amount / 1e8, fee, vsize }];
  });
}

export function largeTransactions(transactions: LargeTransaction[], minimumBtc: number) {
  return transactions.filter((t) => t.outputBtc >= minimumBtc).sort((a, b) => b.outputBtc - a.outputBtc);
}

export function parseMempool(stats: unknown, fees: unknown, recent: unknown, fetchedAt: number): MempoolSnapshot {
  const s = record(stats), f = record(fees);
  const count = numeric(s['count']), vsize = numeric(s['vsize']), totalFee = numeric(s['total_fee']);
  const fastestFee = numeric(f['fastestFee']), halfHourFee = numeric(f['halfHourFee']), hourFee = numeric(f['hourFee']), economyFee = numeric(f['economyFee']);
  if (count === null || vsize === null || totalFee === null || fastestFee === null || halfHourFee === null || hourFee === null || economyFee === null) throw new Error("Bitcoin mempool data unavailable.");
  const transactions = parseRecentTransactions(recent);
  return { count, vsize, totalFeeBtc: totalFee / 1e8, fees: { fastestFee, halfHourFee, hourFee, economyFee }, transactions, sampled: transactions.length, fetchedAt };
}