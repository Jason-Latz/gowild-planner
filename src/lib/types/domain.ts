export type FlightLeg = {
  providerId: string;
  carrier: string;
  flightNo: string;
  origin: string;
  destination: string;
  depTs: string;
  arrTs: string;
  durationMinutes: number;
};

export type Layover = {
  airport: string;
  minutes: number;
};

export type Itinerary = {
  legs: FlightLeg[];
  stops: number;
  layovers: Layover[];
  totalMinutes: number;
  score: number;
};

export type ReturnCheck = {
  feasible: boolean;
  bestReturn?: Itinerary;
  reason?: string;
  bestReturnDate?: string;
};

export type SearchRequest = {
  originGroup: string;
  departDate: string;
  maxStops: number;
  requireReturn: boolean;
  minNights: number;
  maxNights: number;
};

export type SearchResultCard = {
  destination: string;
  bestOutbound: Itinerary;
  returnCheck: ReturnCheck;
  bookingUrl: string;
  bookingFallbackUrl: string;
  bookingDetailsText: string;
};

export type SearchResponse = {
  meta: {
    originGroup: string;
    departDate: string;
    maxStops: number;
    requireReturn: boolean;
    minNights: number;
    maxNights: number;
    generatedAt: string;
    source: "cache" | "fresh";
    // Provenance of the underlying flight data, distinct from the cache tier:
    // "live" = real provider/fli data; "mock" = built-in sample schedule served
    // because live providers were unavailable (results are illustrative only).
    dataSource: "live" | "mock";
  };
  results: SearchResultCard[];
};

export type ProviderHealth = {
  id: string;
  ok: boolean;
  latencyMs: number;
  message?: string;
  // True when the adapter is reachable but serving the built-in mock schedule
  // (no live credentials), so callers can surface a degraded/"sample data" state.
  degraded?: boolean;
};

export type DigestTrip = {
  destination: string;
  departDate: string;
  outbound: Itinerary;
  returnDate: string;
  returnItinerary: Itinerary;
  bookingUrl: string;
};

export type DigestRunResult = {
  processedUsers: number;
  sentEmails: number;
  skippedUsers: number;
  failedUsers: number;
};
