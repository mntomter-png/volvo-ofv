import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { checkRateLimit } from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: previous.NODE_ENV });
    if (previous.UPSTASH_REDIS_REST_URL === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = previous.UPSTASH_REDIS_REST_URL;
    }
    if (previous.UPSTASH_REDIS_REST_TOKEN === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = previous.UPSTASH_REDIS_REST_TOKEN;
    }
  });

  it("denies when Redis credentials are missing in production", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    assert.equal(await checkRateLimit("prod-missing-redis", 5, 60_000), false);
  });

  it("allows then denies in-memory outside production", async () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const key = `mem-${Date.now()}-${Math.random()}`;
    assert.equal(await checkRateLimit(key, 2, 60_000), true);
    assert.equal(await checkRateLimit(key, 2, 60_000), true);
    assert.equal(await checkRateLimit(key, 2, 60_000), false);
  });
});
