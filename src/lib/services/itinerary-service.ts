import { differenceInMinutes, isSameDay, parseISO } from "date-fns";

import {
  MAX_LAYOVER_MINUTES,
  MAX_OVERNIGHT_LAYOVER_MINUTES,
  MIN_DOMESTIC_LAYOVER_MINUTES,
  MIN_INTERNATIONAL_LAYOVER_MINUTES,
  US_AIRPORTS,
} from "@/lib/constants";
import type { FlightLeg, Itinerary, Layover } from "@/lib/types/domain";

type BuildItinerariesInput = {
  originAirports: string[];
  serviceDate: string;
  maxStops: number;
  carrier: string;
  getDepartures: (airportCode: string) => Promise<FlightLeg[]>;
};

type PathState = {
  startOrigin: string;
  legs: FlightLeg[];
  visitedAirports: Set<string>;
};

function toDateOnlyFromIso(iso: string) {
  return iso.slice(0, 10);
}

function matchesServiceDate(leg: FlightLeg, serviceDate: string) {
  return toDateOnlyFromIso(leg.depTs) === serviceDate;
}

function isDomesticAirport(airportCode: string) {
  return US_AIRPORTS.has(airportCode);
}

function getMinLayoverMinutes(previous: FlightLeg, next: FlightLeg) {
  const domestic = isDomesticAirport(previous.destination) && isDomesticAirport(next.origin);
  return domestic ? MIN_DOMESTIC_LAYOVER_MINUTES : MIN_INTERNATIONAL_LAYOVER_MINUTES;
}

function isValidConnection(previous: FlightLeg, next: FlightLeg) {
  if (previous.destination !== next.origin) {
    return false;
  }

  const previousArrival = parseISO(previous.arrTs);
  const nextDeparture = parseISO(next.depTs);

  const layoverMinutes = differenceInMinutes(nextDeparture, previousArrival);
  if (layoverMinutes < 0) {
    return false;
  }

  if (layoverMinutes < getMinLayoverMinutes(previous, next) || layoverMinutes > MAX_LAYOVER_MINUTES) {
    return false;
  }

  if (!isSameDay(previousArrival, nextDeparture) && layoverMinutes > MAX_OVERNIGHT_LAYOVER_MINUTES) {
    return false;
  }

  return true;
}

function buildLayovers(legs: FlightLeg[]): Layover[] {
  const layovers: Layover[] = [];

  for (let index = 0; index < legs.length - 1; index += 1) {
    const current = legs[index];
    const next = legs[index + 1];

    const minutes = differenceInMinutes(parseISO(next.depTs), parseISO(current.arrTs));
    layovers.push({
      airport: current.destination,
      minutes,
    });
  }

  return layovers;
}

export function scoreItinerary(legs: FlightLeg[]) {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const totalMinutes = differenceInMinutes(parseISO(last.arrTs), parseISO(first.depTs));
  const layovers = buildLayovers(legs);
  const stops = Math.max(0, legs.length - 1);

  const layoverPenalty = layovers.reduce((sum, layover) => {
    return sum + Math.abs(120 - layover.minutes);
  }, 0);

  const score = stops * 10_000 + totalMinutes + layoverPenalty;

  return {
    legs,
    stops,
    layovers,
    totalMinutes,
    score,
  } satisfies Itinerary;
}

export function sortItineraries(itineraries: Itinerary[]) {
  return [...itineraries].sort((a, b) => {
    if (a.stops !== b.stops) {
      return a.stops - b.stops;
    }

    if (a.totalMinutes !== b.totalMinutes) {
      return a.totalMinutes - b.totalMinutes;
    }

    if (a.score !== b.score) {
      return a.score - b.score;
    }

    return a.legs[0].depTs.localeCompare(b.legs[0].depTs);
  });
}

export async function buildItineraries(input: BuildItinerariesInput): Promise<Itinerary[]> {
  const maxLegs = input.maxStops + 1;
  const results: Itinerary[] = [];

  const queue: PathState[] = input.originAirports.map((originAirport) => ({
    startOrigin: originAirport,
    legs: [],
    visitedAirports: new Set([originAirport]),
  }));

  while (queue.length > 0) {
    const state = queue.shift();
    if (!state) {
      break;
    }

    const currentAirport = state.legs.length > 0 ? state.legs[state.legs.length - 1].destination : state.startOrigin;
    const departures = await input.getDepartures(currentAirport);

    for (const departure of departures) {
      if (departure.carrier !== input.carrier) {
        continue;
      }

      if (departure.origin !== currentAirport) {
        continue;
      }

      if (!matchesServiceDate(departure, input.serviceDate)) {
        continue;
      }

      if (state.visitedAirports.has(departure.destination)) {
        continue;
      }

      const previousLeg = state.legs[state.legs.length - 1];
      if (previousLeg && !isValidConnection(previousLeg, departure)) {
        continue;
      }

      const legs = [...state.legs, departure];
      const itinerary = scoreItinerary(legs);
      results.push(itinerary);

      if (legs.length < maxLegs) {
        const visitedAirports = new Set(state.visitedAirports);
        visitedAirports.add(departure.destination);
        queue.push({
          startOrigin: state.startOrigin,
          legs,
          visitedAirports,
        });
      }
    }
  }

  return sortItineraries(results);
}
