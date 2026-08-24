import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("buildContentSecurityPolicy", () => {
  it("includes nonce and strict-dynamic without unsafe-inline scripts", () => {
    const csp = buildContentSecurityPolicy("abc123");
    assert.match(csp, /script-src[^;]*'nonce-abc123'/);
    assert.match(csp, /script-src[^;]*'strict-dynamic'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.match(csp, /connect-src[^;]*supabase\.co/);
  });

  it("omits unsafe-eval outside development", () => {
    const csp = buildContentSecurityPolicy("n", "production");
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);
  });

  it("allows unsafe-eval only in development", () => {
    const csp = buildContentSecurityPolicy("n", "development");
    assert.match(csp, /script-src[^;]*'unsafe-eval'/);
  });
});
