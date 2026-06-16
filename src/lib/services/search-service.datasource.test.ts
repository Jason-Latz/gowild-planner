import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/providers/provider-manager", () => ({
  fetchDeparturesWithFailover: vi.fn(),
}));

vi.mock("@/lib/services/user-service", () => ({
  getOriginGroupAirports: vi.fn(async () => ["ORD", "MDW"]),
}));

vi.mock("@/lib/services/cache-service", () => ({
  getCachedProviderLegs: vi.fn(async () => null),
  setCachedProviderLegs: vi.fn(async () => {}),
  getCachedSearchResult: vi.fn(async () => null),
  setCachedSearchResult: vi.fn(async () => {}),
}));

import { fetchDeparturesWithFailover } from "@/lib/providers/provider-manager";
import { setCachedProviderLegs, setCachedSearchResult } from "@/lib/services/cache-service";
import { searchFlights } from "@/lib/services/search-service";

function ordLeg(providerId: string) {
  return {
    providerId,
    carrier: "F9",
    flightNo: "1",
    origin: "ORD",
    destination: "DEN",
    depTs: "2026-06-19T08:00:00",
    arrTs: "2026-06-19T10:00:00",
    durationMinutes: 120,
  };
}

function failoverReturning(providerId: string) {
  return async ({ airportCode }: { airportCode: string }) => {
    if (airportCode === "ORD") {
      return { providerId: "provider-a", legs: [ordLeg(providerId)] };
    }
    return { providerId: "provider-a", legs: [] };
  };
}

const baseRequest = {
  originGroup: "CHI",
  departDate: "2026-06-19",
  maxStops: 2,
  requireReturn: false,
  minNights: 1,
  maxNights: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchFlights data-source provenance", () => {
  it("flags mock fallback and does not cache degraded results", async () => {
    (fetchDeparturesWithFailover as Mock).mockImplementation(failoverReturning("mock-frontier"));

    const response = await searchFlights(baseRequest);

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.meta.dataSource).toBe("mock");
    expect(setCachedSearchResult).not.toHaveBeenCalled();
    // The mock ORD legs must never be persisted into the provider cache.
    const cachedAirports = (setCachedProviderLegs as Mock).mock.calls.map((call) => call[0].airportCode);
    expect(cachedAirports).not.toContain("ORD");
  });

  it("flags live data and caches it", async () => {
    (fetchDeparturesWithFailover as Mock).mockImplementation(failoverReturning("provider-fli"));

    const response = await searchFlights(baseRequest);

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.meta.dataSource).toBe("live");
    expect(setCachedSearchResult).toHaveBeenCalledTimes(1);
    expect(setCachedProviderLegs).toHaveBeenCalled();
  });
});
