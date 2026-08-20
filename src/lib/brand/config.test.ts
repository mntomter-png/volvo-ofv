import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBrandId } from "@/lib/brand/config";

describe("resolveBrandId", () => {
  it("defaults missing to volvo", () => {
    assert.equal(resolveBrandId(null), "volvo");
    assert.equal(resolveBrandId(""), "volvo");
  });

  it("denies unknown", () => {
    assert.equal(resolveBrandId("unknown"), null);
  });
});
