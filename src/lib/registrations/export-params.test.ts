import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { registrationsExportParams } from "@/lib/registrations/export-params";
import type { RegistrationsFilters } from "@/lib/registrations/filters";

function filters(
  overrides: Partial<RegistrationsFilters> = {},
): RegistrationsFilters {
  return {
    segment: null,
    make: "Volvo",
    year: 2026,
    page: 2,
    month: 10,
    region: 1,
    hp: null,
    fuel: null,
    pabygg: null,
    bodywork: null,
    disp: 0,
    chassis: "trekker",
    from: null,
    to: null,
    fleet: "region",
    search: "Nordren",
    ...overrides,
  };
}

describe("registrationsExportParams", () => {
  it("sender måned, fleet, chassis og søk videre", () => {
    const params = registrationsExportParams(filters());
    assert.equal(params.month, 10);
    assert.equal(params.fleet, "region");
    assert.equal(params.chassis, "trekker");
    assert.equal(params.disp, 0);
    assert.equal(params.q, "Nordren");
    assert.equal(params.make, "Volvo");
    assert.equal(params.page, undefined);
  });

  it("utelater fleet når valget er alle", () => {
    assert.equal(registrationsExportParams(filters({ fleet: "all" })).fleet, null);
  });
});
