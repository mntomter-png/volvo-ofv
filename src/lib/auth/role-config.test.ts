import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveRole, roleCanAccess } from "@/lib/auth/role-config";
import { resolveBrandId } from "@/lib/brand/config";

describe("resolveRole", () => {
  it("maps known roles", () => {
    assert.equal(resolveRole("salg"), "salg");
    assert.equal(resolveRole("super"), "super");
  });

  it("maps legacy admin to super", () => {
    assert.equal(resolveRole("admin"), "super");
  });

  it("denies empty and unknown", () => {
    assert.equal(resolveRole(""), null);
    assert.equal(resolveRole(null), null);
    assert.equal(resolveRole(undefined), null);
    assert.equal(resolveRole("foo"), null);
  });
});

describe("roleCanAccess", () => {
  it("denies null role", () => {
    assert.equal(roleCanAccess(null, "nyregistreringer"), false);
    assert.equal(roleCanAccess(undefined, "admin"), false);
  });

  it("allows salg only registrations-related pages", () => {
    assert.equal(roleCanAccess("salg", "nyregistreringer"), true);
    assert.equal(roleCanAccess("salg", "admin"), false);
  });
});

describe("resolveBrandId", () => {
  it("defaults missing to volvo", () => {
    assert.equal(resolveBrandId(null), "volvo");
    assert.equal(resolveBrandId(""), "volvo");
    assert.equal(resolveBrandId(undefined), "volvo");
  });

  it("accepts known brands", () => {
    assert.equal(resolveBrandId("volvo"), "volvo");
    assert.equal(resolveBrandId("renault"), "renault");
  });

  it("denies unknown brand strings", () => {
    assert.equal(resolveBrandId("scania"), null);
    assert.equal(resolveBrandId(42), null);
  });
});
