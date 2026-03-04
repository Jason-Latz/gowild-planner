import { describe, expect, it } from "vitest";

import { buildBookingLink } from "@/lib/services/booking-service";
import type { Itinerary } from "@/lib/types/domain";

function itinerary(args: {
  origin: string;
  destination: string;
  depTs: string;
  arrTs: string;
  flightNo: string;
}): Itinerary {
  return {
    legs: [
      {
        providerId: "test",
        carrier: "F9",
        flightNo: args.flightNo,
        origin: args.origin,
        destination: args.destination,
        depTs: args.depTs,
        arrTs: args.arrTs,
      },
    ],
    stops: 0,
    layovers: [],
    totalMinutes: 120,
    score: 120,
  };
}

describe("booking-service", () => {
  it("builds round-trip Frontier handoff links and fallback details", () => {
    const outbound = itinerary({
      origin: "ORD",
      destination: "MCO",
      depTs: "2026-03-06T14:00:00.000Z",
      arrTs: "2026-03-06T18:00:00.000Z",
      flightNo: "1201",
    });

    const inbound = itinerary({
      origin: "MCO",
      destination: "MDW",
      depTs: "2026-03-08T16:00:00.000Z",
      arrTs: "2026-03-08T20:00:00.000Z",
      flightNo: "1202",
    });

    const link = buildBookingLink({
      outbound,
      returnItinerary: inbound,
    });

    expect(link.bookingUrl).toContain("trip=roundtrip");
    expect(link.bookingUrl).toContain("origin=ORD");
    expect(link.bookingUrl).toContain("destination=MCO");
    expect(link.bookingUrl).toContain("return=");
    expect(link.fallbackUrl).toContain("booking.flyfrontier.com");
    expect(link.detailsText).toContain("Outbound:");
    expect(link.detailsText).toContain("Return:");
  });
});
