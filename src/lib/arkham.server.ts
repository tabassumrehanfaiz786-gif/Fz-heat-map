// Server-only Arkham fetcher. Never import this from client code.
import { VAULT_ENTITIES, parseArkhamTransfer, type VaultTransfer } from "./arkham-data";

const CACHE_MS = 10 * 60_000;
let cache: { at: number; data: VaultTransfer[] } | null = null;

async function fetchEntityTransfers(key: string, entity: string, sinceMs: number): Promise<VaultTransfer[]> {
  const url = new URL("https://api.arkhamintelligence.com/transfers");
  url.searchParams.set("base", entity);
  url.searchParams.set("tokens", "bitcoin");
  url.searchParams.set("limit", "100");
  const res = await fetch(url, {
    headers: { "API-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Arkham error [${res.status}]`);
  const json: unknown = await res.json();
  const rows = Array.isArray(json) ? json : ((json as Record<string, unknown>).transfers as unknown[] | undefined) ?? [];
  return rows
    .map((r) => parseArkhamTransfer(entity, r))
    .filter((t): t is VaultTransfer => t !== null && t.time >= sinceMs);
}

export async function fetchVaultTransfers(key: string, days = 30): Promise<VaultTransfer[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const since = Date.now() - days * 86_400_000;
  const results = await Promise.allSettled(VAULT_ENTITIES.map((e) => fetchEntityTransfers(key, e.arkhamEntity, since)));
  const transfers = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (results.every((r) => r.status === "rejected")) throw new Error("Arkham connection failed. Check your API key or try again later.");
  const data = transfers.sort((a, b) => b.time - a.time);
  cache = { at: Date.now(), data };
  return data;
}
