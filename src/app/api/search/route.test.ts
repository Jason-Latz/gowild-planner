import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/services/search-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/search-service")>();
  return { ...actual, searchFlights: vi.fn() };
});

import { GET } from "@/app/api/search/route";
import { searchFlights } from "@/lib/services/search-service";

function get(query: string) {
  return new NextRequest(`http://localhost/api/search?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("returns 400 for an invalid originGroup", async () => {
    const res = await GET(get("originGroup=A1"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(searchFlights).not.toHaveBeenCalled();
  });

  it("returns the search response for a valid query", async () => {
    (searchFlights as Mock).mockResolvedValue({
      meta: {
        originGroup: "CHI",
        departDate: "2026-06-19",
        maxStops: 2,
        requireReturn: true,
        minNights: 1,
        maxNights: 3,
        generatedAt: "2026-06-16T00:00:00.000Z",
        source: "fresh",
        dataSource: "live",
      },
      results: [],
    });

    const res = await GET(get("originGroup=CHI&departDate=2026-06-19"));

    expect(res.status).toBe(200);
    expect(searchFlights).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { meta: { dataSource: string } };
    expect(body.meta.dataSource).toBe("live");
  });
});
