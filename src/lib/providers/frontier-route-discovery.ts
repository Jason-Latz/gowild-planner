import { getFrontierOriginPageSlug } from "@/lib/providers/frontier-origin-pages";

const FRONTIER_FLIGHTS_BASE_URL = "https://flights.flyfrontier.com/en";
const FRONTIER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;
const ROUTE_DISCOVERY_CONCURRENCY = 8;

type NextData = {
  props?: {
    pageProps?: {
      apolloState?: {
        data?: Record<string, unknown>;
      };
    };
  };
};

type RouteMetadata = {
  originAirportCode: string;
  destinationAirportCode: string;
};

const htmlCache = new Map<string, Promise<string>>();
const routeCandidatesCache = new Map<string, Promise<string[]>>();
const routeMetadataCache = new Map<string, Promise<RouteMetadata | null>>();

async function fetchFrontierPage(slug: string) {
  const cached = htmlCache.get(slug);
  if (cached) {
    return cached;
  }

  const request = fetch(`${FRONTIER_FLIGHTS_BASE_URL}/${slug}`, {
    headers: {
      "user-agent": FRONTIER_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Frontier route page request failed (${response.status}) for ${slug}`);
    }

    return response.text();
  });

  htmlCache.set(slug, request);
  return request;
}

export function extractNextDataJson(html: string): NextData {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    throw new Error("Unable to parse Frontier page payload.");
  }

  return JSON.parse(match[1]) as NextData;
}

function getApolloState(nextData: NextData) {
  return nextData.props?.pageProps?.apolloState?.data ?? {};
}

export function extractRoutePageMetadata(nextData: NextData): RouteMetadata | null {
  const state = getApolloState(nextData);

  let originAirportCode = "";
  let destinationAirportCode = "";

  for (const [key, value] of Object.entries(state)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const record = value as Record<string, unknown>;

    if (key.startsWith("DpaHeadline:")) {
      const lowestFare = (((record.metaData as Record<string, unknown> | undefined)?.headline ??
        {}) as Record<string, unknown>).lowestFare as Record<string, unknown> | undefined;
      originAirportCode = String(lowestFare?.originAirportCode ?? originAirportCode).toUpperCase();
      destinationAirportCode = String(lowestFare?.destinationAirportCode ?? destinationAirportCode).toUpperCase();
    }

    if (key.startsWith("StandardFareModule:")) {
      const prepopulationSettings = record.prepopulationSettings as Record<string, unknown> | undefined;
      originAirportCode = String(prepopulationSettings?.originAirportCode ?? originAirportCode).toUpperCase();
      destinationAirportCode = String(
        prepopulationSettings?.destinationAirportCode ?? destinationAirportCode,
      ).toUpperCase();
    }
  }

  if (!originAirportCode || !destinationAirportCode) {
    return null;
  }

  return {
    originAirportCode,
    destinationAirportCode,
  };
}

export function extractRoutePageSlugs(nextData: NextData) {
  const state = getApolloState(nextData);
  const routeSlugs = new Set<string>();

  for (const [key, value] of Object.entries(state)) {
    if (!key.startsWith("InterlinkRoutes:") || !value || typeof value !== "object") {
      continue;
    }

    const links = (value as { links?: Array<{ url?: string }> }).links ?? [];
    for (const link of links) {
      const slug = String(link.url ?? "");
      if (slug.startsWith("flights-from-")) {
        routeSlugs.add(slug);
      }
    }
  }

  return [...routeSlugs];
}

async function resolveRouteMetadata(routeSlug: string): Promise<RouteMetadata | null> {
  const cached = routeMetadataCache.get(routeSlug);
  if (cached) {
    return cached;
  }

  const request = fetchFrontierPage(routeSlug)
    .then((html) => extractRoutePageMetadata(extractNextDataJson(html)))
    .catch(() => null);

  routeMetadataCache.set(routeSlug, request);
  return request;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function discoverDirectDestinationsForAirport(airportCode: string): Promise<string[]> {
  const normalizedAirport = airportCode.toUpperCase();
  const cached = routeCandidatesCache.get(normalizedAirport);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const originSlug = getFrontierOriginPageSlug(normalizedAirport);
    if (!originSlug) {
      return [];
    }

    const pageHtml = await fetchFrontierPage(originSlug);
    const routeSlugs = extractRoutePageSlugs(extractNextDataJson(pageHtml));

    const routeMetadata = await mapWithConcurrency(routeSlugs, ROUTE_DISCOVERY_CONCURRENCY, resolveRouteMetadata);

    const destinations = new Set<string>();

    for (const route of routeMetadata) {
      if (!route) {
        continue;
      }

      if (route.originAirportCode !== normalizedAirport) {
        continue;
      }

      if (route.destinationAirportCode === normalizedAirport) {
        continue;
      }

      destinations.add(route.destinationAirportCode);
    }

    return [...destinations].sort();
  })();

  routeCandidatesCache.set(normalizedAirport, request);
  return request;
}
