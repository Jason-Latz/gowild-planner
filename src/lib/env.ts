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
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  ALERT_FROM_EMAIL: z.string().default("GoWild Explorer <alerts@example.com>"),
  CRON_SECRET: z.string().default("dev-secret"),
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
  return process.env.NODE_ENV !== "production" || Boolean(env.ALLOW_HEADER_AUTH);
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
