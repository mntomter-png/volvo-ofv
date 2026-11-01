import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  comparisonPeriodLabel,
  nextDayExclusive,
  osloDayStart,
  osloOffsetMinutes,
  previousPeriodFilters,
  registrationPeriodDescription,
  registrationQueryWindow,
  todayIso,
} from "@/lib/kpi/yoy";
import type { RegistrationsFilters } from "@/lib/registrations/filters";

const NOV_1_UTC = new Date("2026-11-01T12:00:00.000Z");

function filters(
  overrides: Partial<RegistrationsFilters> = {},
): RegistrationsFilters {
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
    dataThrough: "2026-10-17",
    ...overrides,
  };
}

describe("Oslo-døgn", () => {
  it("regner dagen i Oslo, ikke UTC", () => {
    assert.equal(todayIso(new Date("2026-10-31T23:30:00.000Z")), "2026-11-01");
    assert.equal(todayIso(new Date("2026-11-01T00:30:00.000Z")), "2026-11-01");
  });

  it("bruker CET om vinteren og CEST om sommeren", () => {
    assert.equal(osloDayStart("2026-01-15"), "2026-01-15T00:00:00+01:00");
    assert.equal(osloDayStart("2026-07-15"), "2026-07-15T00:00:00+02:00");
    assert.equal(nextDayExclusive("2026-01-15"), "2026-01-16T00:00:00+01:00");
    assert.equal(nextDayExclusive("2026-07-15"), "2026-07-16T00:00:00+02:00");
  });

  it("holder midnatt på riktig side av sommertid", () => {
    assert.equal(osloOffsetMinutes(new Date("2026-03-28T23:00:00.000Z")), 60);
    assert.equal(osloOffsetMinutes(new Date("2026-03-29T01:00:00.000Z")), 120);
    assert.equal(osloDayStart("2026-03-29"), "2026-03-29T00:00:00+01:00");
    assert.equal(osloDayStart("2026-10-25"), "2026-10-25T00:00:00+02:00");
    assert.equal(osloDayStart("2026-10-26"), "2026-10-26T00:00:00+01:00");
  });
});

describe("registrationQueryWindow", () => {
  it("kutter inneværende år til siste registreringsdato", () => {
    assert.deepEqual(
      registrationQueryWindow(filters(), NOV_1_UTC),
      { from: "2026-01-01", to: "2026-10-17" },
    );
  });

  it("lar et avsluttet år stå urørt", () => {
    assert.deepEqual(
      registrationQueryWindow(filters({ year: 2025, dataThrough: "2026-10-17" }), NOV_1_UTC),
      { from: "2025-01-01", to: "2025-12-31" },
    );
  });

  it("skjærer valgt måned mot siste dato", () => {
    assert.deepEqual(
      registrationQueryWindow(filters({ month: 10 }), NOV_1_UTC),
      { from: "2026-10-01", to: "2026-10-17" },
    );
    assert.deepEqual(
      registrationQueryWindow(filters({ month: 3 }), NOV_1_UTC),
      { from: "2026-03-01", to: "2026-03-31" },
    );
  });

  it("sammenligner YoY med samme spenn, ikke med dagens dato", () => {
    const current = filters();
    const previous = previousPeriodFilters(current, NOV_1_UTC);
    assert.equal(previous?.from, "2025-01-01");
    assert.equal(previous?.to, "2025-10-17");
    assert.equal(previous?.month, null);
    assert.equal(comparisonPeriodLabel(current, NOV_1_UTC), "YTD 2025");
  });

  it("flytter en valgt måned ett år tilbake", () => {
    const previous = previousPeriodFilters(filters({ month: 3 }), NOV_1_UTC);
    assert.equal(previous?.from, "2025-03-01");
    assert.equal(previous?.to, "2025-03-31");
  });

  it("beskriver kortene med ≥ 16 t", () => {
    assert.equal(
      registrationPeriodDescription(filters(), NOV_1_UTC),
      "Tunge lastebiler ≥ 16 t YTD 2026",
    );
    assert.match(
      registrationPeriodDescription(filters({ month: 3 }), NOV_1_UTC),
      /≥ 16 t/,
    );
  });
});
