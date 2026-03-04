export const DEFAULT_ORIGIN_GROUP = "CHI";

export const ORIGIN_GROUP_FALLBACKS: Record<string, { name: string; airports: string[] }> = {
  CHI: {
    name: "Chicago",
    airports: ["ORD", "MDW"],
  },
};

export const DEFAULT_CARRIER = "F9";

export const PROVIDER_CACHE_TTL_MINUTES = 30;
export const SEARCH_CACHE_TTL_MINUTES = 15;

export const MIN_DOMESTIC_LAYOVER_MINUTES = 45;
export const MIN_INTERNATIONAL_LAYOVER_MINUTES = 75;
export const MAX_LAYOVER_MINUTES = 360;
export const MAX_OVERNIGHT_LAYOVER_MINUTES = 480;

export const THURSDAY = 4;
export const DEFAULT_SEND_TIME = "08:00";

export const FRONTIER_BOOKING_BASE = "https://booking.flyfrontier.com";

export const US_AIRPORTS = new Set([
  "ATL",
  "AUS",
  "BDL",
  "BNA",
  "BUF",
  "CLT",
  "CVG",
  "DEN",
  "DFW",
  "DTW",
  "IAH",
  "LAS",
  "LAX",
  "MCO",
  "MIA",
  "MSP",
  "MDW",
  "ORD",
  "PHL",
  "PHX",
  "RDU",
  "SAN",
  "SEA",
  "SFO",
  "TPA",
]);
