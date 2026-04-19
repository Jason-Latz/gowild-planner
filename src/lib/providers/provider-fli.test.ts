import { afterEach, describe, expect, it, vi } from "vitest";

const envBackup = {
  VERCEL: process.env.VERCEL,
  VERCEL_URL: process.env.VERCEL_URL,
  FLI_HTTP_BASE_URL: process.env.FLI_HTTP_BASE_URL,
};

afterEach(() => {
  process.env.VERCEL = envBackup.VERCEL;
  process.env.VERCEL_URL = envBackup.VERCEL_URL;
  process.env.FLI_HTTP_BASE_URL = envBackup.FLI_HTTP_BASE_URL;
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
