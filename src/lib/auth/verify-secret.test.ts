import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  verifyBearerSecret,
  verifyRequestBearerSecret,
} from "@/lib/auth/verify-secret";

describe("verifyBearerSecret", () => {
  it("denies missing secret or header", () => {
    assert.equal(verifyBearerSecret("Bearer secret", undefined), false);
    assert.equal(verifyBearerSecret("Bearer secret", ""), false);
    assert.equal(verifyBearerSecret(null, "secret"), false);
    assert.equal(verifyBearerSecret("", "secret"), false);
  });

  it("accepts an exact Bearer match", () => {
    assert.equal(verifyBearerSecret("Bearer hunter2", "hunter2"), true);
  });

  it("denies wrong token without throwing on length mismatch", () => {
    assert.equal(verifyBearerSecret("Bearer short", "much-longer-secret"), false);
    assert.equal(verifyBearerSecret("Bearer hunter2", "hunter3"), false);
    assert.equal(verifyBearerSecret("Basic hunter2", "hunter2"), false);
  });
});

describe("verifyRequestBearerSecret", () => {
  it("reads Authorization from the request", () => {
    const ok = new Request("https://example.internal/api/sync", {
      headers: { Authorization: "Bearer sync-secret" },
    });
    assert.equal(verifyRequestBearerSecret(ok, "sync-secret"), true);

    const missing = new Request("https://example.internal/api/sync");
    assert.equal(verifyRequestBearerSecret(missing, "sync-secret"), false);
  });
});
