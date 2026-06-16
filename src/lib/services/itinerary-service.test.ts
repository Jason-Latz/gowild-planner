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
    durationMinutes: Math.round(
      (new Date(args.arr).getTime() - new Date(args.dep).getTime()) / 60_000,
    ),
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

  it("returns itineraries in best-first order for a destination", async () => {
    const departures: Record<string, FlightLeg[]> = {
      ORD: [
        leg({
          flightNo: "301",
          origin: "ORD",
          destination: "DEN",
          dep: "2026-03-05T08:00:00Z",
          arr: "2026-03-05T10:00:00Z",
        }),
        leg({
          flightNo: "302",
          origin: "ORD",
          destination: "MCO",
          dep: "2026-03-05T08:30:00Z",
          arr: "2026-03-05T11:30:00Z",
        }),
      ],
      MCO: [
        leg({
          flightNo: "303",
          origin: "MCO",
          destination: "DEN",
          dep: "2026-03-05T12:30:00Z",
          arr: "2026-03-05T15:30:00Z",
        }),
      ],
      DEN: [],
    };

    const itineraries = await buildItineraries({
      originAirports: ["ORD"],
      serviceDate: "2026-03-05",
      maxStops: 2,
      carrier: "F9",
      getDepartures: async (airportCode) => departures[airportCode] ?? [],
    });

    const denTrips = itineraries.filter((itinerary) => itinerary.legs.at(-1)?.destination === "DEN");

    expect(denTrips).toHaveLength(2);
    expect(denTrips[0]?.stops).toBe(0);
    expect(denTrips[1]?.stops).toBe(1);
  });

  // Regression: fli returns local wall-clock datetimes with no timezone offset.
  // Duration must come from the authoritative durationMinutes field, and layovers
  // from same-airport wall-clock differences — never absolute-instant subtraction.
  function tzLeg(args: {
    flightNo: string;
    origin: string;
    destination: string;
    depTs: string;
    arrTs: string;
    durationMinutes: number;
  }): FlightLeg {
    return {
      providerId: "test",
      carrier: "F9",
      flightNo: args.flightNo,
      origin: args.origin,
      destination: args.destination,
      depTs: args.depTs,
      arrTs: args.arrTs,
      durationMinutes: args.durationMinutes,
    };
  }

  it("derives total duration from authoritative durationMinutes, not wall-clock subtraction", () => {
    // ORD (Central) -> DEN (Mountain): 2h wall-clock face value but 3h real.
    const itinerary = scoreItinerary([
      tzLeg({
        flightNo: "900",
        origin: "ORD",
        destination: "DEN",
        depTs: "2026-04-16T06:25:00",
        arrTs: "2026-04-16T08:25:00",
        durationMinutes: 180,
      }),
    ]);

    // A naive arr-dep subtraction would yield 120; the authoritative value is 180.
    expect(itinerary.totalMinutes).toBe(180);
  });

  it("computes single-airport layovers from wall-clock face values across timezones", () => {
    const itinerary = scoreItinerary([
      tzLeg({
        flightNo: "900",
        origin: "ORD",
        destination: "DEN",
        depTs: "2026-04-16T06:25:00",
        arrTs: "2026-04-16T08:25:00",
        durationMinutes: 180,
      }),
      // DEN (Mountain) -> LAS (Pacific): connection wholly within DEN's timezone.
      tzLeg({
        flightNo: "901",
        origin: "DEN",
        destination: "LAS",
        depTs: "2026-04-16T10:05:00",
        arrTs: "2026-04-16T11:20:00",
        durationMinutes: 135,
      }),
    ]);

    expect(itinerary.layovers).toHaveLength(1);
    expect(itinerary.layovers[0]).toEqual({ airport: "DEN", minutes: 100 });
    // 180 (leg1) + 135 (leg2) + 100 (DEN layover wall-clock) = 415.
    expect(itinerary.totalMinutes).toBe(415);
  });

  it("validates connections by wall-clock layover even when authoritative durations span timezones", async () => {
    const departures: Record<string, FlightLeg[]> = {
      ORD: [
        tzLeg({
          flightNo: "900",
          origin: "ORD",
          destination: "DEN",
          depTs: "2026-04-16T06:25:00",
          arrTs: "2026-04-16T08:25:00",
          durationMinutes: 180,
        }),
      ],
      DEN: [
        tzLeg({
          flightNo: "901",
          origin: "DEN",
          destination: "LAS",
          depTs: "2026-04-16T10:05:00",
          arrTs: "2026-04-16T11:20:00",
          durationMinutes: 135,
        }),
      ],
      LAS: [],
    };

    const itineraries = await buildItineraries({
      originAirports: ["ORD"],
      serviceDate: "2026-04-16",
      maxStops: 2,
      carrier: "F9",
      getDepartures: async (airportCode) => departures[airportCode] ?? [],
    });

    const lasTrip = itineraries.find((itinerary) => itinerary.legs.at(-1)?.destination === "LAS");
    expect(lasTrip).toBeDefined();
    expect(lasTrip?.stops).toBe(1);
    expect(lasTrip?.totalMinutes).toBe(415);
  });
});
