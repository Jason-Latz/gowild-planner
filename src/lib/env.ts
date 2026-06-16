import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  ALLOW_HEADER_AUTH: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === "true" || value === true),
  PROVIDER_A_BASE_URL: z.string().url().optional().or(z.literal("")),
  PROVIDER_A_API_KEY: z.string().optional().or(z.literal("")),
  PROVIDER_B_BASE_URL: z.string().url().optional().or(z.literal("")),
  PROVIDER_B_API_KEY: z.string().optional().or(z.literal("")),
  FLI_ENABLED: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return true;
      }
      return value === "true" || value === true;
    }),
  FLI_HTTP_BASE_URL: z.string().url().optional().or(z.literal("")),
  FLI_HTTP_SECRET: z.string().optional().or(z.literal("")),
  FLI_PYTHON_BIN: z.string().default("python3"),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  ALERT_FROM_EMAIL: z.string().default("GoWild Explorer <alerts@example.com>"),
  CRON_SECRET: z.string().default("dev-secret"),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") {
    return;
  }

  // Fail the boot fast in production rather than running with insecure defaults.
  if (!value.DATABASE_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required in production",
    });
  }

  if (!value.CRON_SECRET || value.CRON_SECRET === "dev-secret" || value.CRON_SECRET.length < 16) {
    ctx.addIssue({
      code: "custom",
      path: ["CRON_SECRET"],
      message:
        "CRON_SECRET must be set to a strong non-default value (>=16 chars) in production",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid env configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

export function hasSupabaseConfig() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function allowHeaderAuth() {
  // Trusting an `x-user-email` header is full account impersonation, so it must
  // be an EXPLICIT opt-in (ALLOW_HEADER_AUTH=true) and never inferred from
  // NODE_ENV: preview/staging deploys are internet-reachable yet not
  // "production". Local development sets the flag deliberately.
  return env.ALLOW_HEADER_AUTH === true;
}

export function hasResendConfig() {
  return Boolean(env.RESEND_API_KEY);
}

export function hasProviderAConfig() {
  return Boolean(env.PROVIDER_A_BASE_URL && env.PROVIDER_A_API_KEY);
}

export function hasProviderBConfig() {
  return Boolean(env.PROVIDER_B_BASE_URL && env.PROVIDER_B_API_KEY);
}

export function isFliEnabled() {
  return env.FLI_ENABLED;
}

export function hasFliHttpBaseUrl() {
  return Boolean(env.FLI_HTTP_BASE_URL);
}
