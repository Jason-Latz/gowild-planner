import type { FlightLeg, ProviderHealth } from "@/lib/types/domain";

export type ProviderQuery = {
  airportCode: string;
  serviceDate: string;
  carrier: string;
};

export interface ProviderAdapter {
  id: string;
  fetchDepartures(query: ProviderQuery): Promise<FlightLeg[]>;
  healthCheck(): Promise<ProviderHealth>;
}
