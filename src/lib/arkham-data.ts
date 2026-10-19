// Pure parsing and entity registry for Arkham on-chain institutional flows.
// Shared by the Vaults UI and the AI cross-verification so units and
// missing-value handling stay consistent.

export type VaultEntity = {
  id: string;
  name: string;
  kind: "issuer" | "custodian";
  arkhamEntity: string;
};

// Top BTC spot-ETF issuers and the custodians that actually hold the coins.
export const VAULT_ENTITIES: VaultEntity[] = [
  { id: "blackrock", name: "BlackRock (IBIT)", kind: "issuer", arkhamEntity: "blackrock" },
  { id: "fidelity", name: "Fidelity (FBTC)", kind: "issuer", arkhamEntity: "fidelity" },
  { id: "grayscale", name: "Grayscale (GBTC)", kind: "issuer", arkhamEntity: "grayscale" },
  { id: "ark21", name: "ARK 21Shares (ARKB)", kind: "issuer", arkhamEntity: "ark-invest" },
  { id: "bitwise", name: "Bitwise (BITB)", kind: "issuer", arkhamEntity: "bitwise" },
  { id: "vaneck", name: "VanEck (HODL)", kind: "issuer", arkhamEntity: "vaneck" },
  { id: "franklin", name: "Franklin (EZBC)", kind: "issuer", arkhamEntity: "franklin-templeton" },
  { id: "invesco", name: "Invesco Galaxy (BTCO)", kind: "issuer", arkhamEntity: "invesco" },
  { id: "wisdomtree", name: "WisdomTree (BTCW)", kind: "issuer", arkhamEntity: "wisdomtree" },
  { id: "coinbase-prime", name: "Coinbase Prime (custodian)", kind: "custodian", arkhamEntity: "coinbase" },
];

export type VaultTransfer = {
  entityId: string;
  txHash: string;
  time: number; // ms epoch
  btc: number; // signed: + into tracked wallets, - out
  usd: number;
  direction: "in" | "out";
  counterparty: string;
};

export type VaultDay = { date: string; netBtc: number; netUsd: number; transfers: number };

export function entityName(id: string) {
  return VAULT_ENTITIES.find((e) => e.id === id)?.name ?? id;
}

// Normalize an Arkham transfer row into our shape; returns null on bad data.
export function parseArkhamTransfer(entityId: string, raw: unknown): VaultTransfer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const hash = typeof r.transactionHash === "string" ? r.transactionHash : typeof r.txHash === "string" ? r.txHash : null;
  const tsRaw = r.blockTimestamp ?? r.timestamp;
  const time = typeof tsRaw === "string" ? Date.parse(tsRaw) : typeof tsRaw === "number" ? (tsRaw < 1e12 ? tsRaw * 1000 : tsRaw) : NaN;
  const unit = typeof r.unit === "string" ? r.unit.toUpperCase() : "BTC";
  const usd = Number(r.historicalUSD ?? r.usd ?? 0);
  const tokenValue = Number(r.tokenValue ?? r.value ?? NaN);
  if (!hash || !Number.isFinite(time) || time <= 0) return null;
  const btc = unit === "BTC" && Number.isFinite(tokenValue) ? Math.abs(tokenValue) : Number.isFinite(usd) && usd > 0 ? usd / 100_000 : NaN;
  if (!Number.isFinite(btc)) return null;
  const from = (r.fromAddress as Record<string, unknown> | undefined)?.arkhamEntity as Record<string, unknown> | undefined;
  const to = (r.toAddress as Record<string, unknown> | undefined)?.arkhamEntity as Record<string, unknown> | undefined;
  const toId = typeof to?.id === "string" ? to.id : "";
  const fromId = typeof from?.id === "string" ? from.id : "";
  const direction: "in" | "out" = toId && !fromId ? "in" : "out";
  const counterparty = direction === "in" ? (fromId || "unknown") : (toId || "unknown");
  return {
    entityId,
    txHash: hash,
    time,
    btc: direction === "in" ? btc : -btc,
    usd: Number.isFinite(usd) ? usd : 0,
    direction,
    counterparty,
  };
}

export function aggregateByDay(transfers: VaultTransfer[]): VaultDay[] {
  const map = new Map<string, VaultDay>();
  for (const t of transfers) {
    const date = new Date(t.time).toISOString().slice(0, 10);
    const d = map.get(date) ?? { date, netBtc: 0, netUsd: 0, transfers: 0 };
    d.netBtc += t.btc;
    d.netUsd += t.direction === "in" ? t.usd : -t.usd;
    d.transfers += 1;
    map.set(date, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Daily on-chain net flow per entity (USD millions), matching the ETF history shape.
export function dailyEntityFlows(transfers: VaultTransfer[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const t of transfers) {
    const date = new Date(t.time).toISOString().slice(0, 10);
    const day = (out[date] ??= {});
    day[t.entityId] = (day[t.entityId] ?? 0) + (t.direction === "in" ? t.usd : -t.usd) / 1e6;
  }
  return out;
}

// Clearly-labelled sample transfers used until an Arkham key is configured.
export function sampleVaultTransfers(now = Date.now()): VaultTransfer[] {
  const day = 86_400_000;
  const mk = (entityId: string, daysAgo: number, btc: number, price: number, dir: "in" | "out", cp: string): VaultTransfer => ({
    entityId,
    txHash: `sample-${entityId}-${daysAgo}`,
    time: now - daysAgo * day - Math.floor(Math.random() * 6 * 3_600_000),
    btc: dir === "in" ? btc : -btc,
    usd: btc * price,
    direction: dir,
    counterparty: cp,
  });
  return [
    mk("coinbase-prime", 0, 420, 108_000, "in", "otc-desk"),
    mk("coinbase-prime", 0, 150, 108_000, "out", "blackrock"),
    mk("blackrock", 1, 310, 107_500, "in", "coinbase-prime"),
    mk("grayscale", 1, 180, 107_500, "out", "coinbase-prime"),
    mk("fidelity", 2, 95, 106_800, "in", "fidelity-custody"),
    mk("coinbase-prime", 3, 500, 105_900, "in", "market-maker"),
    mk("blackrock", 4, 260, 106_200, "in", "coinbase-prime"),
    mk("ark21", 5, 40, 104_700, "out", "coinbase-prime"),
    mk("bitwise", 6, 55, 104_100, "in", "coinbase-prime"),
    mk("grayscale", 7, 220, 103_800, "out", "coinbase-prime"),
  ];
}
