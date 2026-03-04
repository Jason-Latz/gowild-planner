import type { FlightLeg } from "@/lib/types/domain";
import type { ProviderAdapter, ProviderQuery } from "@/lib/providers/types";
import { ProviderAAdapter } from "@/lib/providers/provider-a";
import { ProviderBAdapter } from "@/lib/providers/provider-b";

const adapters: ProviderAdapter[] = [new ProviderAAdapter(), new ProviderBAdapter()];

type FetchResult = {
  providerId: string;
  legs: FlightLeg[];
};

export async function fetchDeparturesWithFailover(query: ProviderQuery): Promise<FetchResult> {
  let lastError: Error | null = null;

  for (const adapter of adapters) {
    try {
      const legs = await adapter.fetchDepartures(query);
      return {
        providerId: adapter.id,
        legs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Provider fetch failed");
    }
  }

  throw lastError ?? new Error("All providers failed.");
}

export async function checkProvidersHealth() {
  return Promise.all(adapters.map((adapter) => adapter.healthCheck()));
}
