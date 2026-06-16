import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/env", () => ({
  allowHeaderAuth: vi.fn(),
}));

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { UnauthorizedError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { resolveUserEmail } from "@/lib/auth/user-context";
import { allowHeaderAuth } from "@/lib/env";

const procEnv = process.env as Record<string, string | undefined>;
const savedNodeEnv = procEnv.NODE_ENV;

function requestWithHeaders(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as never;
}

function supabaseReturning(email: string | null) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: email ? { email } : null },
        error: null,
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (createSupabaseServerClient as Mock).mockResolvedValue(null);
});

afterEach(() => {
  if (savedNodeEnv === undefined) {
    delete procEnv.NODE_ENV;
  } else {
    procEnv.NODE_ENV = savedNodeEnv;
  }
});

describe("resolveUserEmail", () => {
  it("honors x-user-email only when header auth is allowed", async () => {
    (allowHeaderAuth as Mock).mockReturnValue(true);

    await expect(
      resolveUserEmail(requestWithHeaders({ "x-user-email": "Picked@Example.com" })),
    ).resolves.toBe("picked@example.com");
  });

  it("ignores x-user-email when header auth is disabled (no impersonation)", async () => {
    (allowHeaderAuth as Mock).mockReturnValue(false);
    procEnv.NODE_ENV = "development";

    // Header points at a victim, but it must be ignored — falls back to the demo
    // identity in dev, never the spoofed email.
    await expect(
      resolveUserEmail(requestWithHeaders({ "x-user-email": "victim@example.com" })),
    ).resolves.toBe("demo@gowild.local");
  });

  it("uses the Supabase session email when present", async () => {
    (allowHeaderAuth as Mock).mockReturnValue(false);
    (createSupabaseServerClient as Mock).mockResolvedValue(supabaseReturning("Session@Example.com"));

    await expect(resolveUserEmail(requestWithHeaders({}))).resolves.toBe("session@example.com");
  });

  it("throws Unauthorized in production with no header and no session", async () => {
    (allowHeaderAuth as Mock).mockReturnValue(false);
    procEnv.NODE_ENV = "production";

    await expect(
      resolveUserEmail(requestWithHeaders({ "x-user-email": "victim@example.com" })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
