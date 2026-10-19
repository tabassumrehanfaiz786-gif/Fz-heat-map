import { createServerFn } from "@tanstack/react-start";
import { VAULT_ENTITIES, aggregateByDay, dailyEntityFlows, sampleVaultTransfers, type VaultTransfer } from "./arkham-data";

export type VaultResult = {
  configured: boolean;
  transfers: VaultTransfer[];
  days: ReturnType<typeof aggregateByDay>;
  entityDaily: Record<string, Record<string, number>>;
  entities: typeof VAULT_ENTITIES;
  fetchedAt?: number | undefined;
  error?: string | undefined;
};

export const getVaultFlows = createServerFn({ method: "GET" }).handler(async (): Promise<VaultResult> => {
  const key = process.env["ARKHAM_API_KEY"];
  if (!key) {
    const transfers = sampleVaultTransfers();
    return { configured: false, transfers, days: aggregateByDay(transfers), entityDaily: dailyEntityFlows(transfers), entities: VAULT_ENTITIES };
  }
  try {
    const { fetchVaultTransfers } = await import("./arkham.server");
    const transfers = await fetchVaultTransfers(key, 30);
    return { configured: true, transfers, days: aggregateByDay(transfers), entityDaily: dailyEntityFlows(transfers), entities: VAULT_ENTITIES, fetchedAt: Date.now() };
  } catch (e) {
    return { configured: true, transfers: [], days: [], entityDaily: {}, entities: VAULT_ENTITIES, error: e instanceof Error ? e.message : "Arkham connection failed. Try again later." };
  }
});
