import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

// Mock the exec boundary so fetchDepartures runs without a real Python subprocess:
// "health" → ok, "search" → empty result set. We assert on the number of search
// invocations to verify the fan-out cap.
vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (_file: string, args: string[], _opts: unknown, cb: (err: unknown, res: unknown) => void) => {
      const stdout = args.includes("health") ? JSON.stringify({ ok: true }) : JSON.stringify([]);
      cb(null, { stdout, stderr: "" });
      return undefined;
    },
  ),
}));

vi.mock("@/lib/providers/frontier-route-discovery", () => ({
  discoverDirectDestinationsForAirport: vi.fn(),
}));

const envBackup = {
  VERCEL: process.env.VERCEL,
  VERCEL_URL: process.env.VERCEL_URL,
  FLI_HTTP_BASE_URL: process.env.FLI_HTTP_BASE_URL,
  FLI_ENABLED: process.env.FLI_ENABLED,
  FLI_MAX_DESTINATIONS: process.env.FLI_MAX_DESTINATIONS,
};

function restoreEnv(key: keyof typeof envBackup) {
  if (envBackup[key] === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = envBackup[key];
  }
}

afterEach(() => {
  (Object.keys(envBackup) as Array<keyof typeof envBackup>).forEach(restoreEnv);
  vi.resetModules();
});

describe("provider-fli transport selection", () => {
  it("uses local transport by default outside Vercel", async () => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    delete process.env.FLI_HTTP_BASE_URL;

    const providerModule = await import("@/lib/providers/provider-fli");

    expect(providerModule.resolveFliHttpBaseUrl()).toBeNull();
    expect(providerModule.resolveFliTransport()).toBe("local");
  });

  it("uses explicit HTTP base URL when configured", async () => {
    process.env.FLI_HTTP_BASE_URL = "https://example.com";
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;

    const providerModule = await import("@/lib/providers/provider-fli");

    expect(providerModule.resolveFliHttpBaseUrl()).toBe("https://example.com");
    expect(providerModule.resolveFliTransport()).toBe("http");
  });

  it("uses Vercel URL when running on Vercel", async () => {
    delete process.env.FLI_HTTP_BASE_URL;
    process.env.VERCEL = "1";
    process.env.VERCEL_URL = "gowild.example.vercel.app";

    const providerModule = await import("@/lib/providers/provider-fli");

    expect(providerModule.resolveFliHttpBaseUrl()).toBe("https://gowild.example.vercel.app");
    expect(providerModule.resolveFliTransport()).toBe("http");
  });
});

describe("provider-fli destination fan-out cap", () => {
  it("queries at most FLI_MAX_DESTINATIONS routes and logs what it drops", async () => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    delete process.env.FLI_HTTP_BASE_URL;
    process.env.FLI_ENABLED = "true";
    process.env.FLI_MAX_DESTINATIONS = "5";

    // Import inside the test so the mock instances match the freshly-imported module graph.
    const { execFile } = (await import("node:child_process")) as unknown as { execFile: Mock };
    const { discoverDirectDestinationsForAirport } = await import(
      "@/lib/providers/frontier-route-discovery"
    );

    const discovered = Array.from({ length: 23 }, (_, i) => `D${String(i).padStart(2, "0")}`);
    (discoverDirectDestinationsForAirport as Mock).mockResolvedValue(discovered);
    execFile.mockClear();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { FliAdapter } = await import("@/lib/providers/provider-fli");
    await new FliAdapter().fetchDepartures({
      airportCode: "DEN",
      serviceDate: "2026-06-24",
      carrier: "F9",
    });

    const searchCalls = execFile.mock.calls.filter((call) => (call[1] as string[]).includes("search"));
    expect(searchCalls).toHaveLength(5);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("capped 23 direct destinations to 5"));

    warnSpy.mockRestore();
  });

  it("does not cap when the airport has fewer destinations than the limit", async () => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    delete process.env.FLI_HTTP_BASE_URL;
    process.env.FLI_ENABLED = "true";
    process.env.FLI_MAX_DESTINATIONS = "40";

    const { execFile } = (await import("node:child_process")) as unknown as { execFile: Mock };
    const { discoverDirectDestinationsForAirport } = await import(
      "@/lib/providers/frontier-route-discovery"
    );

    (discoverDirectDestinationsForAirport as Mock).mockResolvedValue(["AAA", "BBB", "CCC"]);
    execFile.mockClear();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { FliAdapter } = await import("@/lib/providers/provider-fli");
    await new FliAdapter().fetchDepartures({
      airportCode: "LAS",
      serviceDate: "2026-06-24",
      carrier: "F9",
    });

    const searchCalls = execFile.mock.calls.filter((call) => (call[1] as string[]).includes("search"));
    expect(searchCalls).toHaveLength(3);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
