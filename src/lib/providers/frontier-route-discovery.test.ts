import { describe, expect, it } from "vitest";

import {
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
});
