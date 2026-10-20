import { createServerFn } from "@tanstack/react-start";
import { fetchPublicBitcoin } from "./public-bitcoin.server";
import type { MempoolSnapshot } from "./public-bitcoin";

export const getPublicBitcoin = createServerFn({ method: "GET" }).handler(async (): Promise<{ data: MempoolSnapshot | null; error?: string }> => {
  try { return { data: await fetchPublicBitcoin() }; }
  catch { return { data: null, error: "Mempool.space is temporarily unavailable. No sample transactions are shown." }; }
});