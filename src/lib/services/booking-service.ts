import { format } from "date-fns";

import { FRONTIER_BOOKING_BASE } from "@/lib/constants";
import type { Itinerary } from "@/lib/types/domain";

export type BookingLinkResult = {
  bookingUrl: string;
  fallbackUrl: string;
  detailsText: string;
};

function getDateForFrontier(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function buildBookingLink(params: {
  outbound: Itinerary;
  returnItinerary?: Itinerary;
}): BookingLinkResult {
  const outboundFirstLeg = params.outbound.legs[0];
  const outboundLastLeg = params.outbound.legs[params.outbound.legs.length - 1];
  const outboundDate = getDateForFrontier(outboundFirstLeg.depTs);

  const url = new URL(FRONTIER_BOOKING_BASE);
  url.searchParams.set("trip", params.returnItinerary ? "roundtrip" : "oneway");
  url.searchParams.set("origin", outboundFirstLeg.origin);
  url.searchParams.set("destination", outboundLastLeg.destination);
  url.searchParams.set("departure", outboundDate);

  const lines = [
    `Outbound: ${outboundFirstLeg.origin} -> ${outboundLastLeg.destination} on ${outboundDate}`,
    `Outbound flights: ${params.outbound.legs.map((leg) => `${leg.carrier}${leg.flightNo}`).join(", ")}`,
  ];

  if (params.returnItinerary) {
    const returnFirstLeg = params.returnItinerary.legs[0];
    const returnLastLeg = params.returnItinerary.legs[params.returnItinerary.legs.length - 1];
    const returnDate = getDateForFrontier(returnFirstLeg.depTs);
    url.searchParams.set("return", returnDate);

    lines.push(
      `Return: ${returnFirstLeg.origin} -> ${returnLastLeg.destination} on ${returnDate}`,
      `Return flights: ${params.returnItinerary.legs
        .map((leg) => `${leg.carrier}${leg.flightNo}`)
        .join(", ")}`,
    );
  }

  return {
    bookingUrl: url.toString(),
    fallbackUrl: FRONTIER_BOOKING_BASE,
    detailsText: lines.join("\n"),
  };
}
