import { describe, expect, it } from "vitest";

import { dedupeTrips } from "@/lib/services/digest-service";
import type { DigestTrip, Itinerary } from "@/lib/types/domain";

function itinerary(score: number): Itinerary {
  return {
    legs: [
      {
        providerId: "test",
        carrier: "F9",
        flightNo: "100",
        origin: "ORD",
        destination: "DEN",
        depTs: "2026-03-05T10:00:00.000Z",
        arrTs: "2026-03-05T12:00:00.000Z",
      },
    ],
    stops: 0,
    layovers: [],
    totalMinutes: 120,
    score,
  };
}

describe("digest trip dedupe", () => {
  it("keeps the best-scoring trip per destination", () => {
    const trips: DigestTrip[] = [
      {
        destination: "LAS",
        departDate: "2026-03-06",
        outbound: itinerary(200),
        returnDate: "2026-03-08",
        returnItinerary: itinerary(210),
        bookingUrl: "https://example.com/las-1",
      },
      {
        destination: "LAS",
        departDate: "2026-03-07",
        outbound: itinerary(150),
        returnDate: "2026-03-08",
        returnItinerary: itinerary(140),
        bookingUrl: "https://example.com/las-2",
      },
      {
        destination: "MCO",
        departDate: "2026-03-06",
        outbound: itinerary(190),
        returnDate: "2026-03-08",
        returnItinerary: itinerary(190),
        bookingUrl: "https://example.com/mco",
      },
    ];

    const deduped = dedupeTrips(trips);

    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.destination).toBe("LAS");
    expect(deduped[0]?.bookingUrl).toBe("https://example.com/las-2");
  });
});
