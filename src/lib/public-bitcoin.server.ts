import { parseMempool, type MempoolSnapshot } from "./public-bitcoin";

let cache: MempoolSnapshot | undefined;
let pending: Promise<MempoolSnapshot> | undefined;
async function read(path: string) {
  const response = await fetch(`https://mempool.space/api/${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Public Bitcoin feed temporarily unavailable. Try again shortly.");
  return response.json();
}
export async function fetchPublicBitcoin() {
  if (cache && Date.now() - cache.fetchedAt < 30_000) return cache;
  if (pending) return pending;
  pending = Promise.all([read("mempool"), read("v1/fees/recommended"), read("mempool/recent")]).then(([stats, fees, recent]) => {
    cache = parseMempool(stats, fees, recent, Date.now());
    return cache;
  }).finally(() => { pending = undefined; });
  return pending;
}