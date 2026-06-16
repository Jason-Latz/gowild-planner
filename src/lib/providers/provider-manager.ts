import type { FlightLeg } from "@/lib/types/domain";
import type { ProviderAdapter, ProviderQuery } from "@/lib/providers/types";
import { FliAdapter } from "@/lib/providers/provider-fli";
import { ProviderAAdapter } from "@/lib/providers/provider-a";
import { ProviderBAdapter } from "@/lib/providers/provider-b";
import { wallClockDiffMinutes } from "@/lib/utils/date";

const adapters: ProviderAdapter[] = [new FliAdapter(), new ProviderAAdapter(), new ProviderBAdapter()];

type FetchResult = {
  providerId: string;
  legs: FlightLeg[];
};

function normalizeLegs(legs: FlightLeg[]) {
  const unique = new Map<string, FlightLeg>();

  for (const leg of legs) {
    const depTs = leg.depTs;
    const arrTs = leg.arrTs;
    const key = `${leg.carrier}-${leg.flightNo}-${leg.origin}-${leg.destination}-${depTs}-${arrTs}`;
    if (!unique.has(key)) {
      unique.set(key, {
        ...leg,
        depTs,
        arrTs,
        // Trust the provider's authoritative duration. Only fall back to a
        // wall-clock face-value estimate when it is missing/invalid; never an
        // absolute-instant subtraction, which is wrong across timezones.
        durationMinutes:
          Number.isFinite(leg.durationMinutes) && leg.durationMinutes > 0
            ? leg.durationMinutes
            : Math.max(0, wallClockDiffMinutes(depTs, arrTs)),
      });
    }
  }

  return [...unique.values()].sort((a, b) => {
    if (a.depTs !== b.depTs) {
      return a.depTs.localeCompare(b.depTs);
    }
    if (a.arrTs !== b.arrTs) {
      return a.arrTs.localeCompare(b.arrTs);
    }
    return a.flightNo.localeCompare(b.flightNo);
  });
}

export async function fetchDeparturesWithFailover(query: ProviderQuery): Promise<FetchResult> {
  let lastError: Error | null = null;

  for (const adapter of adapters) {
    try {
      const legs = await adapter.fetchDepartures(query);
      return {
        providerId: adapter.id,
        legs: normalizeLegs(legs),
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
