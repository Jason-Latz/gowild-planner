import { Resend } from "resend";

import { env, hasResendConfig } from "@/lib/env";
import type { DigestTrip, SearchResultCard } from "@/lib/types/domain";

const resend = hasResendConfig() ? new Resend(env.RESEND_API_KEY) : null;

function toHtmlList(items: string[]) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

export async function sendWatchAlertEmail(args: {
  to: string;
  watchName: string;
  results: SearchResultCard[];
}) {
  const subject = `GoWild watch update: ${args.watchName}`;
  const lines = args.results.slice(0, 10).map((result) => {
    const stops = result.bestOutbound.stops;
    const returnBadge = result.returnCheck.feasible ? "Return available" : "No return";
    return `${result.destination} | ${stops} stop(s) | ${result.bestOutbound.totalMinutes} mins | ${returnBadge}`;
  });

  if (!resend) {
    console.log("[watch-email:mock]", { subject, to: args.to, lines });
    return { id: `mock-${Date.now()}` };
  }

  const response = await resend.emails.send({
    from: env.ALERT_FROM_EMAIL,
    to: args.to,
    subject,
    html: `<p>Top matches from your GoWild watch:</p>${toHtmlList(lines)}`,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { id: response.data?.id ?? null };
}

export async function sendWeekendDigestEmail(args: {
  to: string;
  timezone: string;
  trips: DigestTrip[];
  hadResults: boolean;
}) {
  const subject = args.hadResults
    ? "GoWild Thursday digest: weekend-ready options"
    : "GoWild Thursday digest: no weekend options found";

  if (!args.hadResults) {
    if (!resend) {
      console.log("[digest-email:mock]", { subject, to: args.to, message: "No qualifying trips." });
      return { id: `mock-${Date.now()}` };
    }

    const response = await resend.emails.send({
      from: env.ALERT_FROM_EMAIL,
      to: args.to,
      subject,
      html: `<p>No return-qualified weekend itineraries were found this week.</p>`,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return { id: response.data?.id ?? null };
  }

  const list = args.trips.map((trip) => {
    return `${trip.destination} | depart ${trip.departDate} | return ${trip.returnDate} | ${trip.outbound.stops} stop(s) out, ${trip.returnItinerary.stops} stop(s) back`;
  });

  if (!resend) {
    console.log("[digest-email:mock]", { subject, to: args.to, list, timezone: args.timezone });
    return { id: `mock-${Date.now()}` };
  }

  const response = await resend.emails.send({
    from: env.ALERT_FROM_EMAIL,
    to: args.to,
    subject,
    html: `<p>Return-qualified trips for this weekend:</p>${toHtmlList(list)}`,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { id: response.data?.id ?? null };
}
