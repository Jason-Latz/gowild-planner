import type { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Reclaim memory from abandoned buckets at most once per interval instead of
// sweeping the whole map on every request. Per-key expiry is still enforced on
// access (see the `existing.resetAt <= now` reset below), so throttling the
// sweep only defers memory reclamation — it never relaxes the rate limit.
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function cleanupExpired(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/** Test/diagnostic helper: current number of live buckets. */
export function getActiveBucketCount() {
  return buckets.size;
}

/** Test helper: clear all limiter state. */
export function resetRateLimiter() {
  buckets.clear();
  lastCleanupAt = 0;
}

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  return clientIp;
}

export function checkRateLimit(
  args: {
    request: NextRequest;
    namespace: string;
    max: number;
    windowMs: number;
  },
  now: number = Date.now(),
) {
  if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
    cleanupExpired(now);
    lastCleanupAt = now;
  }

  const clientKey = getClientKey(args.request);
  const key = `${args.namespace}:${clientKey}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + args.windowMs;
    buckets.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: args.max - 1,
      retryAfterSeconds: Math.ceil(args.windowMs / 1000),
    };
  }

  if (existing.count >= args.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: args.max - existing.count,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
