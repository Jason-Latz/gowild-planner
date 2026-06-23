import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { env, fliMaxDestinations, hasFliHttpBaseUrl, isFliEnabled } from "@/lib/env";
import { discoverDirectDestinationsForAirport } from "@/lib/providers/frontier-route-discovery";
import type { ProviderAdapter, ProviderQuery } from "@/lib/providers/types";
import type { FlightLeg } from "@/lib/types/domain";

const execFileAsync = promisify(execFile);
const SEARCH_CONCURRENCY = 6;
const SEARCH_TIMEOUT_MS = 45_000;

type FliSearchResult = Array<{
  carrier: string;
  flightNo: string;
  origin: string;
  destination: string;
  depTs: string;
  arrTs: string;
  durationMinutes: number;
}>;

type FliHealthResponse = {
  ok?: boolean;
  error?: string;
};

type FliTransport = "http" | "local";

let healthCache: { at: number; value: Promise<{ ok: boolean; message: string; latencyMs: number }> } | null =
  null;
const HEALTH_CACHE_TTL_MS = 60_000;

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_URL);
}

export function resolveFliHttpBaseUrl() {
  const explicitBaseUrl = env.FLI_HTTP_BASE_URL;

  if (hasFliHttpBaseUrl() && explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return null;
}

export function resolveFliTransport(): FliTransport {
  return resolveFliHttpBaseUrl() || isVercelRuntime() ? "http" : "local";
}

function buildHttpHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (env.FLI_HTTP_SECRET) {
    headers.Authorization = `Bearer ${env.FLI_HTTP_SECRET}`;
    headers["x-fli-secret"] = env.FLI_HTTP_SECRET;
  }

  return headers;
}

async function runLocalHelper(args: string[]) {
  return execFileAsync(env.FLI_PYTHON_BIN, [path.join(process.cwd(), "scripts", "fli_search.py"), ...args], {
    cwd: process.cwd(),
    timeout: SEARCH_TIMEOUT_MS,
    env: process.env,
    maxBuffer: 1_024 * 1_024 * 8,
  });
}

async function runHttpHelper(pathname: string, searchParams?: Record<string, string>) {
  const baseUrl = resolveFliHttpBaseUrl();
  if (!baseUrl) {
    throw new Error("FLI HTTP base URL is not configured");
  }

  const url = new URL(pathname, `${baseUrl}/`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: buildHttpHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }

  return text;
}

async function runHelper(args: string[]) {
  if (resolveFliTransport() === "http") {
    const [command, ...rest] = args;

    if (command === "health") {
      return {
        stdout: await runHttpHelper("/api/fli/health"),
      };
    }

    if (command === "search") {
      const searchParams: Record<string, string> = {};

      for (let index = 0; index < rest.length; index += 2) {
        const flag = rest[index];
        const value = rest[index + 1];
        if (!flag || value === undefined) {
          continue;
        }

        switch (flag) {
          case "--origin":
            searchParams.origin = value;
            break;
          case "--destination":
            searchParams.destination = value;
            break;
          case "--departure-date":
            searchParams.departureDate = value;
            break;
          case "--carrier":
            searchParams.carrier = value;
            break;
          default:
            break;
        }
      }

      return {
        stdout: await runHttpHelper("/api/fli/search", searchParams),
      };
    }

    throw new Error(`Unsupported fli command: ${command}`);
  }

  return runLocalHelper(args);
}

async function getFliHealth() {
  // Cache the probe with a short TTL instead of forever: a transient failure on
  // a warm instance must not permanently pin ok:false (or a stale ok:true).
  const now = Date.now();
  if (healthCache && now - healthCache.at < HEALTH_CACHE_TTL_MS) {
    return healthCache.value;
  }

  // Measure the real probe round-trip here so healthCheck() can report the
  // actual last-probe latency instead of the (near-zero) time to read the cache.
  const probeStart = now;
  const value = runHelper(["health"])
    .then(({ stdout }) => {
      const payload = JSON.parse(stdout) as FliHealthResponse;
      return {
        ok: Boolean(payload.ok),
        message: payload.ok ? `ok (${resolveFliTransport()})` : payload.error ?? "fli unavailable",
        latencyMs: Date.now() - probeStart,
      };
    })
    .catch((error) => {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "fli unavailable",
        latencyMs: Date.now() - probeStart,
      };
    });

  healthCache = { at: now, value };
  return value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function normalizeLeg(record: FliSearchResult[number]): FlightLeg | null {
  if (!record.flightNo || !record.origin || !record.destination || !record.depTs || !record.arrTs) {
    return null;
  }

  if (Number.isNaN(Date.parse(record.depTs)) || Number.isNaN(Date.parse(record.arrTs))) {
    return null;
  }

  return {
    providerId: "provider-fli",
    carrier: record.carrier.toUpperCase(),
    flightNo: record.flightNo,
    origin: record.origin.toUpperCase(),
    destination: record.destination.toUpperCase(),
    depTs: record.depTs,
    arrTs: record.arrTs,
    durationMinutes: record.durationMinutes,
  };
}

async function searchDirectRouteForDate(query: ProviderQuery, destination: string) {
  try {
    const { stdout } = await runHelper([
      "search",
      "--origin",
      query.airportCode,
      "--destination",
      destination,
      "--departure-date",
      query.serviceDate,
      "--carrier",
      query.carrier,
    ]);

    const payload = JSON.parse(stdout) as FliSearchResult;
    return payload
      .map(normalizeLeg)
      .filter((leg): leg is FlightLeg => Boolean(leg))
      .filter((leg) => leg.origin === query.airportCode && leg.destination === destination);
  } catch {
    return [];
  }
}

export class FliAdapter implements ProviderAdapter {
  id = "provider-fli";

  async fetchDepartures(query: ProviderQuery): Promise<FlightLeg[]> {
    if (!isFliEnabled()) {
      throw new Error("fli adapter disabled");
    }

    const health = await getFliHealth();
    if (!health.ok) {
      throw new Error(health.message);
    }

    const discovered = await discoverDirectDestinationsForAirport(query.airportCode);
    if (discovered.length === 0) {
      throw new Error(`No Frontier route metadata found for ${query.airportCode}`);
    }

    // Bound the per-airport fan-out: a hub can have 100+ direct destinations, and
    // one fli query each (even at SEARCH_CONCURRENCY) is what makes a cold search
    // explode. Cap to the first N (FLI_MAX_DESTINATIONS) and never drop silently.
    const maxDestinations = fliMaxDestinations();
    const destinations = discovered.slice(0, maxDestinations);
    if (discovered.length > destinations.length) {
      console.warn(
        `[provider-fli] ${query.airportCode}: capped ${discovered.length} direct destinations to ` +
          `${destinations.length} (FLI_MAX_DESTINATIONS); ${discovered.length - destinations.length} not searched`,
      );
    }

    const routeResults = await mapWithConcurrency(destinations, SEARCH_CONCURRENCY, async (destination) =>
      searchDirectRouteForDate(query, destination),
    );

    return routeResults.flat();
  }

  async healthCheck() {
    const health = await getFliHealth();

    return {
      id: this.id,
      ok: health.ok,
      // The real probe round-trip (memoized with the result), not the time to
      // read the health cache — a warm-instance check now reports true latency.
      latencyMs: health.latencyMs,
      message: health.message,
    };
  }
}
