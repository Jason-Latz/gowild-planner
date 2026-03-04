import { DigestType } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";

import { sendWeekendDigestEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { searchFlights } from "@/lib/services/search-service";
import type { DigestRunResult, DigestTrip } from "@/lib/types/domain";
import {
  getIsoWeekKey,
  getUpcomingWeekendDepartures,
  isWeeklySendWindow,
  toDateOnly,
} from "@/lib/utils/date";
import { hashPayload } from "@/lib/utils/hash";

function getTripScore(trip: DigestTrip) {
  return trip.outbound.score + trip.returnItinerary.score;
}

export function dedupeTrips(trips: DigestTrip[]) {
  const byDestination = new Map<string, DigestTrip>();

  for (const trip of trips) {
    const existing = byDestination.get(trip.destination);
    if (!existing || getTripScore(trip) < getTripScore(existing)) {
      byDestination.set(trip.destination, trip);
    }
  }

  return [...byDestination.values()].sort((a, b) => getTripScore(a) - getTripScore(b));
}

async function collectWeekendTrips(args: {
  originGroup: string;
  timezone: string;
  minNights: number;
  maxNights: number;
  topN: number;
  now: Date;
}) {
  const departureDates = getUpcomingWeekendDepartures(args.now, args.timezone);
  const trips: DigestTrip[] = [];

  for (const departDate of departureDates) {
    const search = await searchFlights({
      originGroup: args.originGroup,
      departDate,
      maxStops: 2,
      requireReturn: true,
      minNights: args.minNights,
      maxNights: args.maxNights,
    });

    for (const result of search.results) {
      if (!result.returnCheck.feasible || !result.returnCheck.bestReturn || !result.returnCheck.bestReturnDate) {
        continue;
      }

      trips.push({
        destination: result.destination,
        departDate,
        outbound: result.bestOutbound,
        returnDate: result.returnCheck.bestReturnDate,
        returnItinerary: result.returnCheck.bestReturn,
        bookingUrl: result.bookingUrl,
      });
    }
  }

  return dedupeTrips(trips).slice(0, args.topN);
}

export async function runDigest(now = new Date()): Promise<DigestRunResult> {
  const users = await prisma.user.findMany({
    include: {
      digestPreference: true,
    },
  });

  let processedUsers = 0;
  let sentEmails = 0;
  let skippedUsers = 0;
  let failedUsers = 0;

  for (const user of users) {
    try {
      const preference = user.digestPreference;

      if (!preference) {
        skippedUsers += 1;
        continue;
      }

      const shouldSend = isWeeklySendWindow({
        now,
        timezone: user.timezone,
        sendDay: preference.sendDay,
        sendLocalTime: preference.sendLocalTime,
      });

      if (!shouldSend) {
        skippedUsers += 1;
        continue;
      }

      const isoWeek = getIsoWeekKey(toZonedTime(now, user.timezone));

      const existing = await prisma.digestEvent.findFirst({
        where: {
          userId: user.id,
          isoWeek,
          digestType: DigestType.WEEKEND,
        },
      });

      if (existing) {
        skippedUsers += 1;
        continue;
      }

      const trips = await collectWeekendTrips({
        originGroup: user.defaultOriginGroup,
        timezone: user.timezone,
        minNights: preference.minNights,
        maxNights: preference.maxNights,
        topN: preference.topN,
        now,
      });

      const hadResults = trips.length > 0;
      let messageId: string | null = null;

      if (hadResults || preference.sendEmptyDigest) {
        const response = await sendWeekendDigestEmail({
          to: user.email,
          timezone: user.timezone,
          trips,
          hadResults,
        });
        messageId = response.id;
        sentEmails += 1;
      }

      await prisma.digestEvent.create({
        data: {
          userId: user.id,
          digestType: DigestType.WEEKEND,
          isoWeek,
          fingerprint: hashPayload(
            trips.map((trip) => ({
              destination: trip.destination,
              departDate: trip.departDate,
              returnDate: trip.returnDate,
              score: getTripScore(trip),
            })),
          ),
          hadResults,
          payload: {
            ranAt: now.toISOString(),
            trips,
            timezone: user.timezone,
            weekendOf: toDateOnly(now),
          },
          messageId,
        },
      });

      processedUsers += 1;
    } catch (error) {
      failedUsers += 1;
      console.error("digest-user-failure", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processedUsers,
    sentEmails,
    skippedUsers,
    failedUsers,
  };
}
