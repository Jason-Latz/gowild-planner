import { describe, expect, it, vi } from "vitest";

import {
  discoverDirectDestinationsForAirport,
  extractNextDataJson,
  extractRoutePageMetadata,
  extractRoutePageSlugs,
} from "@/lib/providers/frontier-route-discovery";

function wrapNextData(payload: unknown) {
  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}

describe("frontier route discovery", () => {
  it("extracts route slugs from interlink route modules", () => {
    const html = wrapNextData({
      props: {
        pageProps: {
          apolloState: {
            data: {
              "InterlinkRoutes:test": {
                links: [
                  { url: "flights-from-denver-to-las-vegas" },
                  { url: "flights-from-denver-to-orlando" },
                  { url: "flights-to-las-vegas" },
                ],
              },
            },
          },
        },
      },
    });

    const slugs = extractRoutePageSlugs(extractNextDataJson(html));

    expect(slugs).toEqual([
      "flights-from-denver-to-las-vegas",
      "flights-from-denver-to-orlando",
    ]);
  });

  it("extracts route origin and destination airport codes from route pages", () => {
    const html = wrapNextData({
      props: {
        pageProps: {
          apolloState: {
            data: {
              "DpaHeadline:test": {
                metaData: {
                  headline: {
                    lowestFare: {
                      originAirportCode: "MDW",
                      destinationAirportCode: "MCO",
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(extractRoutePageMetadata(extractNextDataJson(html))).toEqual({
      originAirportCode: "MDW",
      destinationAirportCode: "MCO",
    });
  });

  it("rejects malicious or malformed route slugs (path/host/query injection)", () => {
    const html = wrapNextData({
      props: {
        pageProps: {
          apolloState: {
            data: {
              "InterlinkRoutes:test": {
                links: [
                  { url: "flights-from-denver-to-las-vegas" },
                  { url: "flights-from-x/../../admin" },
                  { url: "flights-from-@evil.com" },
                  { url: "flights-from-x?token=1" },
                  { url: `flights-from-${"a".repeat(200)}` },
                ],
              },
            },
          },
        },
      },
    });

    expect(extractRoutePageSlugs(extractNextDataJson(html))).toEqual([
      "flights-from-denver-to-las-vegas",
    ]);
  });

  it("returns [] for non-IATA airport codes without hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(discoverDirectDestinationsForAirport("denver")).resolves.toEqual([]);
    await expect(discoverDirectDestinationsForAirport("../etc")).resolves.toEqual([]);
    await expect(discoverDirectDestinationsForAirport("")).resolves.toEqual([]);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("retries after a transient origin-page failure instead of caching the error", async () => {
    const originHtml = wrapNextData({
      props: {
        pageProps: {
          apolloState: {
            data: {
              "InterlinkRoutes:x": { links: [{ url: "flights-from-denver-to-las-vegas" }] },
            },
          },
        },
      },
    });
    const routeHtml = wrapNextData({
      props: {
        pageProps: {
          apolloState: {
            data: {
              "DpaHeadline:x": {
                metaData: {
                  headline: {
                    lowestFare: { originAirportCode: "DEN", destinationAirportCode: "LAS" },
                  },
                },
              },
            },
          },
        },
      },
    });

    let originCalls = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (input: unknown) => {
      const url = String(input);
      if (url.includes("flights-from-denver-to-")) {
        return new Response(routeHtml, { status: 200 });
      }
      if (url.includes("flights-from-denver")) {
        originCalls += 1;
        if (originCalls === 1) {
          throw new Error("transient network error");
        }
        return new Response(originHtml, { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch);

    await expect(discoverDirectDestinationsForAirport("DEN")).rejects.toThrow();
    const destinations = await discoverDirectDestinationsForAirport("DEN");

    expect(destinations).toContain("LAS");
    expect(originCalls).toBe(2);
    fetchSpy.mockRestore();
  });
});
