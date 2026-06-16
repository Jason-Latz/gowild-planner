import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = ["NODE_ENV", "DATABASE_URL", "CRON_SECRET", "ALLOW_HEADER_AUTH"] as const;
// process.env types NODE_ENV as readonly; route mutations through a plain record.
const procEnv = process.env as Record<string, string | undefined>;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = procEnv[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) {
      delete procEnv[key];
    } else {
      procEnv[key] = saved[key];
    }
  }
  vi.resetModules();
});

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete procEnv[key];
    } else {
      procEnv[key] = value;
    }
  }
}

async function loadEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

const STRONG_SECRET = "a-strong-cron-secret-value-123456";

describe("env validation", () => {
  it("rejects the default/weak CRON_SECRET in production", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://db", CRON_SECRET: "dev-secret" });
    await expect(loadEnv()).rejects.toThrow();
  });

  it("rejects a missing DATABASE_URL in production", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: undefined, CRON_SECRET: STRONG_SECRET });
    await expect(loadEnv()).rejects.toThrow();
  });

  it("accepts strong production config", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://db", CRON_SECRET: STRONG_SECRET });
    const mod = await loadEnv();
    expect(mod.env.NODE_ENV).toBe("production");
  });

  it("does not enforce production rules outside production", async () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: undefined, CRON_SECRET: undefined });
    const mod = await loadEnv();
    expect(mod.env.CRON_SECRET).toBe("dev-secret");
  });

  it("allows header auth only with explicit ALLOW_HEADER_AUTH=true", async () => {
    setEnv({ NODE_ENV: "development", ALLOW_HEADER_AUTH: "true" });
    expect((await loadEnv()).allowHeaderAuth()).toBe(true);

    setEnv({ NODE_ENV: "development", ALLOW_HEADER_AUTH: undefined });
    expect((await loadEnv()).allowHeaderAuth()).toBe(false);
  });
});
