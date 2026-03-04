export type FlightLeg = {
  providerId: string;
  carrier: string;
  flightNo: string;
  origin: string;
  destination: string;
  depTs: string;
  arrTs: string;
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
  };
  results: SearchResultCard[];
};

export type ProviderHealth = {
  id: string;
  ok: boolean;
  latencyMs: number;
  message?: string;
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
};
