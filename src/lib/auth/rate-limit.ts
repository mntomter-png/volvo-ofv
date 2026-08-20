import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Enkel in-memory rate limiter (kun lokal utvikling). */
const buckets = new Map<string, { count: number; resetAt: number }>();

const limiterCache = new Map<string, Ratelimit>();

function msToDuration(windowMs: number): `${number} s` | `${number} m` | `${number} h` {
  if (windowMs % (60 * 60 * 1000) === 0) {
    return `${windowMs / (60 * 60 * 1000)} h`;
  }
  if (windowMs % (60 * 1000) === 0) {
    return `${windowMs / (60 * 1000)} m`;
  }
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function getUpstashLimiter(maxAttempts: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${maxAttempts}:${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(maxAttempts, msToDuration(windowMs)),
      prefix: "volvo-ofv",
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

function checkRateLimitMemory(
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Rate limit på tvers av serverless-instanser via Upstash.
 * I produksjon: fail closed hvis Redis mangler eller feiler (ingen in-memory).
 * Lokalt: in-memory fallback.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getUpstashLimiter(maxAttempts, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(key);
      return success;
    } catch (error) {
      console.error(
        "[rate-limit] Upstash feilet:",
        error instanceof Error ? error.message : error,
      );
      if (process.env.NODE_ENV === "production") {
        return false;
      }
      return checkRateLimitMemory(key, maxAttempts, windowMs);
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN mangler i produksjon – avviser",
    );
    return false;
  }

  return checkRateLimitMemory(key, maxAttempts, windowMs);
}
