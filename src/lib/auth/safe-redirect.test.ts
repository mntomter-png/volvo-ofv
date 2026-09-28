import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";

describe("safeRedirectPath", () => {
  it("allows internal paths", () => {
    assert.equal(safeRedirectPath("/nyregistreringer"), "/nyregistreringer");
    assert.equal(safeRedirectPath("/admin/sikkerhet"), "/admin/sikkerhet");
  });

  it("rejects open redirects", () => {
    assert.equal(safeRedirectPath("https://evil.example"), "/");
    assert.equal(safeRedirectPath("//evil.example"), "/");
    assert.equal(safeRedirectPath("evil.example"), "/");
    assert.equal(safeRedirectPath(""), "/");
    assert.equal(safeRedirectPath(null), "/");
  });
});
