import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RegistrationsFilters } from "@/lib/registrations/filters";
import {
  buildPotentialExportParams,
  readPotentialTotals,
} from "@/lib/registrations/potential-params";

function filters(overrides: Partial<RegistrationsFilters> = {}): RegistrationsFilters {
  return {
    segment: null,
    make: null,
    year: 2026,
    page: 1,
    month: null,
    region: null,
    hp: null,
    fuel: null,
    pabygg: null,
    bodywork: null,
    disp: null,
    chassis: null,
    from: null,
    to: null,
    fleet: "all",
    search: null,
    ...overrides,
  };
}

describe("potensial-totaler", () => {
  it("leser hele utvalget fra første rad, ikke antall rader", () => {
    const totals = readPotentialTotals([
      {
        total_accounts: 1661,
        avg_score: 64,
        untapped_count: 455,
        reactivation_count: 868,
        competitor_count: 338,
      },
      {
        total_accounts: 1661,
        avg_score: 64,
        untapped_count: 455,
        reactivation_count: 868,
        competitor_count: 338,
      },
    ]);
    assert.deepEqual(totals, {
      accounts: 1661,
      avgScore: 64,
      untapped: 455,
      reactivation: 868,
      competitor: 338,
    });
  });

  it("gir null når listen er tom", () => {
    assert.deepEqual(readPotentialTotals([]), {
      accounts: 0,
      avgScore: 0,
      untapped: 0,
      reactivation: 0,
      competitor: 0,
    });
    assert.equal(readPotentialTotals(null).accounts, 0);
  });
});

describe("potensial-eksport", () => {
  it("tar med motorstørrelse 0 og chassis", () => {
    const params = buildPotentialExportParams(
      filters({ disp: 0, chassis: "trekker", region: 2, fuel: "Diesel" }),
      { excludeFinance: true, district: "Oslo" },
    );
    assert.equal(params.get("disp"), "0");
    assert.equal(params.get("chassis"), "trekker");
    assert.equal(params.get("year"), "2026");
    assert.equal(params.get("region"), "2");
    assert.equal(params.get("fuel"), "Diesel");
    assert.equal(params.get("district"), "Oslo");
    assert.equal(params.get("excludeFinance"), "1");
  });

  it("utelater filtre som ikke er satt", () => {
    const params = buildPotentialExportParams(filters(), {
      excludeFinance: false,
      district: null,
    });
    assert.equal(params.get("disp"), null);
    assert.equal(params.get("chassis"), null);
    assert.equal(params.get("excludeFinance"), "0");
  });
});
