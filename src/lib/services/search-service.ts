import { addDays } from "date-fns";
import { z } from "zod";

import { DEFAULT_CARRIER, DEFAULT_ORIGIN_GROUP } from "@/lib/constants";
import { fetchDeparturesWithFailover } from "@/lib/providers/provider-manager";
import { buildBookingLink } from "@/lib/services/booking-service";
import {
  getCachedProviderLegs,
  getCachedSearchResult,
  setCachedProviderLegs,
  setCachedSearchResult,
} from "@/lib/services/cache-service";
import { buildItineraries, sortItineraries } from "@/lib/services/itinerary-service";
import { getOriginGroupAirports } from "@/lib/services/user-service";
import type { Itinerary, ReturnCheck, SearchRequest, SearchResponse } from "@/lib/types/domain";
import { hashPayload } from "@/lib/utils/hash";
import { isValidDateOnly, parseDateOnly, toDateOnly, tomorrowDateOnly } from "@/lib/utils/date";

export const searchRequestSchema = z
  .object({
    originGroup: z.string().trim().min(2).max(6).default(DEFAULT_ORIGIN_GROUP),
    departDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => isValidDateOnly(value), "departDate must be a valid YYYY-MM-DD date")
      .optional(),
    maxStops: z.coerce.number().int().min(0).max(2).default(2),
    requireReturn: z
      .union([z.boolean(), z.string()])
      .transform((value) => {
        if (typeof value === "boolean") {
          return value;
        }
        return value !== "false";
      })
      .default(true),
    minNights: z.coerce.number().int().min(1).max(7).default(1),
    maxNights: z.coerce.number().int().min(1).max(10).default(3),
  })
  .transform((input) => {
    const departDate = input.departDate ?? tomorrowDateOnly();
    const minNights = Math.min(input.minNights, input.maxNights);
    const maxNights = Math.max(input.minNights, input.maxNights);

    return {
      ...input,
      departDate,
      originGroup: input.originGroup.toUpperCase(),
      minNights,
      maxNights,
    } satisfies SearchRequest;
  });

async function fetchAirportDepartures(args: {
  airportCode: string;
  serviceDate: string;
  carrier: string;
}) {
  const cached = await getCachedProviderLegs(args);
  if (cached) {
    return cached.legs;
  }

  const response = await fetchDeparturesWithFailover({
    airportCode: args.airportCode,
    serviceDate: args.serviceDate,
    carrier: args.carrier,
  });

  await setCachedProviderLegs({
    provider: response.providerId,
    airportCode: args.airportCode,
    serviceDate: args.serviceDate,
    carrier: args.carrier,
    legs: response.legs,
  });

  return response.legs;
}

function extractDestination(itinerary: Itinerary) {
  return itinerary.legs[itinerary.legs.length - 1]?.destination ?? "";
}

async function computeReturnCheck(args: {
  destination: string;
  originAirports: string[];
  departDate: string;
  maxStops: number;
  minNights: number;
  maxNights: number;
  getDeparturesForDate: (
    airportCode: string,
    serviceDate: string,
  ) => Promise<Awaited<ReturnType<typeof fetchAirportDepartures>>>;
}): Promise<ReturnCheck> {
  let bestReturn: Itinerary | undefined;
  let bestReturnDate: string | undefined;

  const baseDate = parseDateOnly(args.departDate);

  for (let nights = args.minNights; nights <= args.maxNights; nights += 1) {
    const returnDate = toDateOnly(addDays(baseDate, nights));

    const itineraries = await buildItineraries({
      originAirports: [args.destination],
      serviceDate: returnDate,
      maxStops: args.maxStops,
      carrier: DEFAULT_CARRIER,
      getDepartures: async (airportCode) => args.getDeparturesForDate(airportCode, returnDate),
    });

    const validReturns = sortItineraries(
      itineraries.filter((itinerary) => args.originAirports.includes(extractDestination(itinerary))),
    );

    if (validReturns.length === 0) {
      continue;
    }

    const candidate = validReturns[0];

    if (!bestReturn || candidate.score < bestReturn.score) {
      bestReturn = candidate;
      bestReturnDate = returnDate;
    }
  }

  if (!bestReturn || !bestReturnDate) {
    return {
      feasible: false,
      reason: "No valid return in selected window",
    };
  }

  return {
    feasible: true,
    bestReturn,
    bestReturnDate,
  };
}

export async function searchFlights(input: SearchRequest): Promise<SearchResponse> {
  const request = searchRequestSchema.parse(input);

  const queryHash = hashPayload(request);
  const cachedSearch = await getCachedSearchResult(queryHash);

  if (cachedSearch) {
    return cachedSearch;
  }

  const originAirports = await getOriginGroupAirports(request.originGroup);

  const departuresMemo = new Map<string, Awaited<ReturnType<typeof fetchAirportDepartures>>>();

  const getDeparturesForDate = async (airportCode: string, serviceDate: string) => {
    const key = `${airportCode}-${serviceDate}`;
    const existing = departuresMemo.get(key);
    if (existing) {
      return existing;
    }

    const departures = await fetchAirportDepartures({
      airportCode,
      serviceDate,
      carrier: DEFAULT_CARRIER,
    });

    departuresMemo.set(key, departures);
    return departures;
  };

  const outboundItineraries = await buildItineraries({
    originAirports,
    serviceDate: request.departDate,
    maxStops: request.maxStops,
    carrier: DEFAULT_CARRIER,
    getDepartures: async (airportCode) => getDeparturesForDate(airportCode, request.departDate),
  });

  const byDestination = new Map<string, Itinerary[]>();

  for (const itinerary of outboundItineraries) {
    const destination = extractDestination(itinerary);

    if (!destination || originAirports.includes(destination)) {
      continue;
    }

    const list = byDestination.get(destination) ?? [];
    list.push(itinerary);
    byDestination.set(destination, sortItineraries(list));
  }

  const returnMemo = new Map<string, ReturnCheck>();
  const results: SearchResponse["results"] = [];

  for (const [destination, itineraries] of byDestination.entries()) {
    const bestOutbound = itineraries[0];
    if (!bestOutbound) {
      continue;
    }

    let returnCheck = returnMemo.get(destination);
    if (!returnCheck) {
      returnCheck = await computeReturnCheck({
        destination,
        originAirports,
        departDate: request.departDate,
        maxStops: request.maxStops,
        minNights: request.minNights,
        maxNights: request.maxNights,
        getDeparturesForDate,
      });
      returnMemo.set(destination, returnCheck);
    }

    if (request.requireReturn && !returnCheck.feasible) {
      continue;
    }

    const booking = buildBookingLink({
      outbound: bestOutbound,
      returnItinerary: returnCheck.bestReturn,
    });

    results.push({
      destination,
      bestOutbound,
      returnCheck,
      bookingUrl: booking.bookingUrl,
      bookingFallbackUrl: booking.fallbackUrl,
      bookingDetailsText: booking.detailsText,
    });
  }

  results.sort((a, b) => {
    if (a.bestOutbound.stops !== b.bestOutbound.stops) {
      return a.bestOutbound.stops - b.bestOutbound.stops;
    }
    if (a.bestOutbound.totalMinutes !== b.bestOutbound.totalMinutes) {
      return a.bestOutbound.totalMinutes - b.bestOutbound.totalMinutes;
    }
    return a.bestOutbound.score - b.bestOutbound.score;
  });

  const freshResult: SearchResponse = {
    meta: {
      originGroup: request.originGroup,
      departDate: request.departDate,
      maxStops: request.maxStops,
      requireReturn: request.requireReturn,
      minNights: request.minNights,
      maxNights: request.maxNights,
      generatedAt: new Date().toISOString(),
      source: "fresh",
    },
    results,
  };

  await setCachedSearchResult({
    queryHash,
    originGroup: request.originGroup,
    departDate: request.departDate,
    requireReturn: request.requireReturn,
    minNights: request.minNights,
    maxNights: request.maxNights,
    payload: freshResult,
  });

  return freshResult;
}
