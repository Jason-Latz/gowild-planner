import { differenceInMilliseconds } from "date-fns";

import { env, hasProviderBConfig } from "@/lib/env";
import { getMockFrontierDepartures } from "@/lib/providers/mock-data";
import type { ProviderAdapter, ProviderQuery } from "@/lib/providers/types";
import type { FlightLeg } from "@/lib/types/domain";

function parseFlight(record: Record<string, unknown>): FlightLeg | null {
  const origin = String(record.originCode ?? record.origin ?? "").toUpperCase();
  const destination = String(record.destinationCode ?? record.destination ?? "").toUpperCase();
  const depTs = String(record.departureIso ?? record.departure ?? "");
  const arrTs = String(record.arrivalIso ?? record.arrival ?? "");
  const carrier = String(record.carrier ?? "").toUpperCase();
  const flightNo = String(record.flightNumber ?? record.flightNo ?? "").trim();

  if (!origin || !destination || !depTs || !arrTs || !carrier || !flightNo) {
    return null;
  }

  if (Number.isNaN(Date.parse(depTs)) || Number.isNaN(Date.parse(arrTs))) {
    return null;
  }

  return {
    providerId: "provider-b",
    origin,
    destination,
    depTs: new Date(depTs).toISOString(),
    arrTs: new Date(arrTs).toISOString(),
    carrier,
    flightNo,
  };
}

async function fetchRemote(query: ProviderQuery): Promise<FlightLeg[]> {
  const url = new URL(env.PROVIDER_B_BASE_URL || "");
  url.pathname = `${url.pathname.replace(/\/$/, "")}/flights`;
  url.searchParams.set("from", query.airportCode);
  url.searchParams.set("date", query.serviceDate);
  url.searchParams.set("airline", query.carrier);

  const response = await fetch(url, {
    headers: {
      "x-api-key": env.PROVIDER_B_API_KEY || "",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider B error (${response.status})`);
  }

  const payload = (await response.json()) as {
    results?: Array<Record<string, unknown>>;
  };

  return (payload.results ?? [])
    .map(parseFlight)
    .filter((flight): flight is FlightLeg => Boolean(flight))
    .filter((flight) => flight.carrier === query.carrier);
}

export class ProviderBAdapter implements ProviderAdapter {
  id = "provider-b";

  async fetchDepartures(query: ProviderQuery): Promise<FlightLeg[]> {
    if (!hasProviderBConfig()) {
      return getMockFrontierDepartures(query.airportCode, query.serviceDate).filter(
        (leg) => leg.carrier === query.carrier,
      );
    }

    return fetchRemote(query);
  }

  async healthCheck() {
    const start = new Date();

    try {
      if (!hasProviderBConfig()) {
        return {
          id: this.id,
          ok: true,
          latencyMs: 0,
          message: "Using built-in mock schedule fallback.",
        };
      }

      const url = new URL(env.PROVIDER_B_BASE_URL || "");
      url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": env.PROVIDER_B_API_KEY || "",
        },
      });

      return {
        id: this.id,
        ok: response.ok,
        latencyMs: differenceInMilliseconds(new Date(), start),
        message: response.ok ? "ok" : `status ${response.status}`,
      };
    } catch (error) {
      return {
        id: this.id,
        ok: false,
        latencyMs: differenceInMilliseconds(new Date(), start),
        message: error instanceof Error ? error.message : "unknown error",
      };
    }
  }
}
