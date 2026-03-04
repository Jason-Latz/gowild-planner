import { describe, expect, it } from "vitest";

import { buildItineraries, scoreItinerary } from "@/lib/services/itinerary-service";
import type { FlightLeg } from "@/lib/types/domain";

function leg(args: {
  flightNo: string;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
}): FlightLeg {
  return {
    providerId: "test",
    carrier: "F9",
    flightNo: args.flightNo,
    origin: args.origin,
    destination: args.destination,
    depTs: new Date(args.dep).toISOString(),
    arrTs: new Date(args.arr).toISOString(),
  };
}

describe("itinerary-service", () => {
  it("builds 0-2 stop itineraries while preventing airport loops", async () => {
    const departures: Record<string, FlightLeg[]> = {
      ORD: [
        leg({
          flightNo: "101",
          origin: "ORD",
          destination: "DEN",
          dep: "2026-03-05T08:00:00Z",
          arr: "2026-03-05T10:00:00Z",
        }),
        leg({
          flightNo: "102",
          origin: "ORD",
          destination: "MCO",
          dep: "2026-03-05T09:00:00Z",
          arr: "2026-03-05T12:00:00Z",
        }),
      ],
      DEN: [
        leg({
          flightNo: "103",
          origin: "DEN",
          destination: "LAS",
          dep: "2026-03-05T11:00:00Z",
          arr: "2026-03-05T12:30:00Z",
        }),
        leg({
          flightNo: "104",
          origin: "DEN",
          destination: "ORD",
          dep: "2026-03-05T11:15:00Z",
          arr: "2026-03-05T14:00:00Z",
        }),
      ],
      MCO: [
        leg({
          flightNo: "105",
          origin: "MCO",
          destination: "TPA",
          dep: "2026-03-05T13:30:00Z",
          arr: "2026-03-05T14:15:00Z",
        }),
      ],
      LAS: [],
      TPA: [],
    };

    const itineraries = await buildItineraries({
      originAirports: ["ORD"],
      serviceDate: "2026-03-05",
      maxStops: 2,
      carrier: "F9",
      getDepartures: async (airportCode) => departures[airportCode] ?? [],
    });

    expect(itineraries.length).toBeGreaterThan(0);
    expect(itineraries.every((itinerary) => itinerary.stops <= 2)).toBe(true);

    const hasLas = itineraries.some((itinerary) => itinerary.legs.at(-1)?.destination === "LAS");
    expect(hasLas).toBe(true);

    const hasOrdLoop = itineraries.some((itinerary) => itinerary.legs.at(-1)?.destination === "ORD");
    expect(hasOrdLoop).toBe(false);
  });

  it("scores fewer stops better than extra-stop alternatives", () => {
    const direct = scoreItinerary([
      leg({
        flightNo: "201",
        origin: "ORD",
        destination: "DEN",
        dep: "2026-03-05T08:00:00Z",
        arr: "2026-03-05T10:00:00Z",
      }),
    ]);

    const connection = scoreItinerary([
      leg({
        flightNo: "202",
        origin: "ORD",
        destination: "MCO",
        dep: "2026-03-05T08:00:00Z",
        arr: "2026-03-05T10:00:00Z",
      }),
      leg({
        flightNo: "203",
        origin: "MCO",
        destination: "DEN",
        dep: "2026-03-05T11:00:00Z",
        arr: "2026-03-05T13:00:00Z",
      }),
    ]);

    expect(direct.score).toBeLessThan(connection.score);
  });
});
