import { differenceInMilliseconds } from "date-fns";

import { env, hasProviderAConfig } from "@/lib/env";
import { getMockFrontierDepartures } from "@/lib/providers/mock-data";
import type { ProviderAdapter, ProviderQuery } from "@/lib/providers/types";
import type { FlightLeg } from "@/lib/types/domain";

function normalizeLeg(record: Record<string, unknown>, providerId: string): FlightLeg | null {
  const carrier = String(record.carrier ?? record.airline_iata ?? record.airline ?? "").toUpperCase();
  const flightNo = String(record.flightNo ?? record.flight_number ?? record.flight ?? "").trim();
  const origin = String(record.origin ?? record.dep_iata ?? record.departureAirport ?? "").toUpperCase();
  const destination = String(
    record.destination ?? record.arr_iata ?? record.arrivalAirport ?? "",
  ).toUpperCase();
  const depTs = String(record.depTs ?? record.departureTime ?? record.departure ?? "");
  const arrTs = String(record.arrTs ?? record.arrivalTime ?? record.arrival ?? "");

  if (!carrier || !flightNo || !origin || !destination || !depTs || !arrTs) {
    return null;
  }

  if (Number.isNaN(Date.parse(depTs)) || Number.isNaN(Date.parse(arrTs))) {
    return null;
  }

  return {
    providerId,
    carrier,
    flightNo,
    origin,
    destination,
    depTs: new Date(depTs).toISOString(),
    arrTs: new Date(arrTs).toISOString(),
  };
}

async function fetchRemote(query: ProviderQuery): Promise<FlightLeg[]> {
  const url = new URL(env.PROVIDER_A_BASE_URL || "");
  url.pathname = `${url.pathname.replace(/\/$/, "")}/departures`;
  url.searchParams.set("airport", query.airportCode);
  url.searchParams.set("date", query.serviceDate);
  url.searchParams.set("carrier", query.carrier);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.PROVIDER_A_API_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider A error (${response.status})`);
  }

  const payload = (await response.json()) as unknown;

  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? ((payload as { data: unknown[] }).data ?? [])
      : Array.isArray((payload as { flights?: unknown[] })?.flights)
        ? ((payload as { flights: unknown[] }).flights ?? [])
        : [];

  return records
    .map((record) => normalizeLeg(record as Record<string, unknown>, "provider-a"))
    .filter((record): record is FlightLeg => Boolean(record))
    .filter((record) => record.carrier === query.carrier);
}

export class ProviderAAdapter implements ProviderAdapter {
  id = "provider-a";

  async fetchDepartures(query: ProviderQuery): Promise<FlightLeg[]> {
    if (!hasProviderAConfig()) {
      return getMockFrontierDepartures(query.airportCode, query.serviceDate).filter(
        (leg) => leg.carrier === query.carrier,
      );
    }

    const flights = await fetchRemote(query);
    return flights;
  }

  async healthCheck() {
    const start = new Date();

    try {
      if (!hasProviderAConfig()) {
        return {
          id: this.id,
          ok: true,
          latencyMs: 0,
          message: "Using built-in mock schedule fallback.",
        };
      }

      const url = new URL(env.PROVIDER_A_BASE_URL || "");
      url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.PROVIDER_A_API_KEY}`,
        },
        cache: "no-store",
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
