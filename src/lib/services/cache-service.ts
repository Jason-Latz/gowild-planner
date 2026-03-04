import { addMinutes } from "date-fns";

import { PROVIDER_CACHE_TTL_MINUTES, SEARCH_CACHE_TTL_MINUTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { FlightLeg, SearchResponse } from "@/lib/types/domain";

export async function getCachedProviderLegs(args: {
  airportCode: string;
  serviceDate: string;
  carrier: string;
}) {
  const serviceDate = new Date(`${args.serviceDate}T00:00:00.000Z`);

  const cached = await prisma.providerLegCache.findFirst({
    where: {
      airportCode: args.airportCode,
      serviceDate,
      carrier: args.carrier,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      fetchedAt: "desc",
    },
  });

  if (!cached) {
    return null;
  }

  return {
    provider: cached.provider,
    legs: cached.payload as FlightLeg[],
  };
}

export async function setCachedProviderLegs(args: {
  provider: string;
  airportCode: string;
  serviceDate: string;
  carrier: string;
  legs: FlightLeg[];
}) {
  const serviceDate = new Date(`${args.serviceDate}T00:00:00.000Z`);

  await prisma.providerLegCache.create({
    data: {
      provider: args.provider,
      airportCode: args.airportCode,
      serviceDate,
      carrier: args.carrier,
      payload: args.legs,
      expiresAt: addMinutes(new Date(), PROVIDER_CACHE_TTL_MINUTES),
    },
  });
}

export async function getCachedSearchResult(queryHash: string): Promise<SearchResponse | null> {
  const cached = await prisma.searchResultsCache.findUnique({
    where: {
      queryHash,
    },
  });

  if (!cached || cached.expiresAt <= new Date()) {
    return null;
  }

  const payload = cached.payload as SearchResponse;
  return {
    ...payload,
    meta: {
      ...payload.meta,
      source: "cache",
    },
  };
}

export async function setCachedSearchResult(args: {
  queryHash: string;
  originGroup: string;
  departDate: string;
  requireReturn: boolean;
  minNights: number;
  maxNights: number;
  payload: SearchResponse;
}) {
  await prisma.searchResultsCache.upsert({
    where: {
      queryHash: args.queryHash,
    },
    update: {
      payload: args.payload,
      expiresAt: addMinutes(new Date(), SEARCH_CACHE_TTL_MINUTES),
    },
    create: {
      queryHash: args.queryHash,
      originGroup: args.originGroup,
      departDate: new Date(`${args.departDate}T00:00:00.000Z`),
      requireReturn: args.requireReturn,
      minNights: args.minNights,
      maxNights: args.maxNights,
      payload: args.payload,
      expiresAt: addMinutes(new Date(), SEARCH_CACHE_TTL_MINUTES),
    },
  });
}
