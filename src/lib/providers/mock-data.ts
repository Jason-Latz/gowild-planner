import type { FlightLeg } from "@/lib/types/domain";

type Template = {
  flightNo: string;
  origin: string;
  destination: string;
  depLocal: string;
  arrLocal: string;
};

const ROUTE_TEMPLATES: Template[] = [
  { flightNo: "1201", origin: "ORD", destination: "DEN", depLocal: "06:25", arrLocal: "08:25" },
  { flightNo: "1202", origin: "DEN", destination: "ORD", depLocal: "13:35", arrLocal: "17:05" },
  { flightNo: "1203", origin: "MDW", destination: "DEN", depLocal: "07:00", arrLocal: "09:05" },
  { flightNo: "1204", origin: "DEN", destination: "MDW", depLocal: "14:20", arrLocal: "17:40" },

  { flightNo: "1301", origin: "ORD", destination: "MCO", depLocal: "08:10", arrLocal: "12:05" },
  { flightNo: "1302", origin: "MCO", destination: "ORD", depLocal: "15:35", arrLocal: "17:50" },
  { flightNo: "1303", origin: "MDW", destination: "MCO", depLocal: "09:00", arrLocal: "12:45" },
  { flightNo: "1304", origin: "MCO", destination: "MDW", depLocal: "16:25", arrLocal: "18:55" },

  { flightNo: "1401", origin: "DEN", destination: "LAS", depLocal: "10:05", arrLocal: "11:20" },
  { flightNo: "1402", origin: "LAS", destination: "DEN", depLocal: "12:10", arrLocal: "15:00" },
  { flightNo: "1403", origin: "DEN", destination: "SFO", depLocal: "10:40", arrLocal: "12:25" },
  { flightNo: "1404", origin: "SFO", destination: "DEN", depLocal: "13:30", arrLocal: "17:05" },

  { flightNo: "1501", origin: "MCO", destination: "TPA", depLocal: "13:25", arrLocal: "14:15" },
  { flightNo: "1502", origin: "TPA", destination: "MCO", depLocal: "15:35", arrLocal: "16:20" },
  { flightNo: "1503", origin: "TPA", destination: "AUS", depLocal: "17:10", arrLocal: "18:55" },
  { flightNo: "1504", origin: "AUS", destination: "TPA", depLocal: "19:45", arrLocal: "23:00" },

  { flightNo: "1601", origin: "LAS", destination: "SAN", depLocal: "13:15", arrLocal: "14:30" },
  { flightNo: "1602", origin: "SAN", destination: "LAS", depLocal: "16:05", arrLocal: "17:20" },
  { flightNo: "1603", origin: "SFO", destination: "SEA", depLocal: "14:10", arrLocal: "16:25" },
  { flightNo: "1604", origin: "SEA", destination: "SFO", depLocal: "18:05", arrLocal: "20:20" },

  { flightNo: "1701", origin: "SEA", destination: "DEN", depLocal: "08:45", arrLocal: "12:30" },
  { flightNo: "1702", origin: "SAN", destination: "DEN", depLocal: "09:00", arrLocal: "12:25" },
  { flightNo: "1703", origin: "AUS", destination: "DEN", depLocal: "07:15", arrLocal: "09:20" },
  { flightNo: "1704", origin: "DEN", destination: "AUS", depLocal: "18:25", arrLocal: "20:30" },

  { flightNo: "1801", origin: "DEN", destination: "MCO", depLocal: "18:50", arrLocal: "23:45" },
  { flightNo: "1802", origin: "MCO", destination: "DEN", depLocal: "06:50", arrLocal: "09:10" },
];

function toIso(serviceDate: string, localTime: string) {
  return new Date(`${serviceDate}T${localTime}:00-06:00`).toISOString();
}

export function getMockFrontierDepartures(airportCode: string, serviceDate: string): FlightLeg[] {
  return ROUTE_TEMPLATES.filter((template) => template.origin === airportCode).map((template) => ({
    providerId: "mock-frontier",
    carrier: "F9",
    flightNo: template.flightNo,
    origin: template.origin,
    destination: template.destination,
    depTs: toIso(serviceDate, template.depLocal),
    arrTs: toIso(serviceDate, template.arrLocal),
  }));
}
