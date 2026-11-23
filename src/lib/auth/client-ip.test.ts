import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getClientIp } from "@/lib/auth/client-ip";

describe("getClientIp", () => {
  it("prefers Netlify connection IP over X-Forwarded-For", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 203.0.113.10",
    });
    assert.equal(getClientIp(headers), "203.0.113.10");
  });

  it("does not trust the first X-Forwarded-For hop", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 203.0.113.9",
    });
    assert.equal(getClientIp(headers), "203.0.113.9");
  });

  it("returns unknown when no IP headers are present", () => {
    assert.equal(getClientIp(new Headers()), "unknown");
  });
});
