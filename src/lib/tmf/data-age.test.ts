import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SSB_INDICATOR_SOURCES } from "@/lib/ssb/indicators";
import type { TmfCommercialIndicator } from "@/lib/tmf/commercial";
import {
  assessTmfDataAge,
  COMMERCIAL_STALE_DAYS,
  expectedCommercialPeriod,
  OFV_DATA_STALE_DAYS,
  type TmfDataAgeInput,
} from "@/lib/tmf/data-age";

const NOW = new Date("2026-10-31T12:00:00.000Z");

function indicator(
  kind: TmfCommercialIndicator["kind"],
  periodYear: number,
  monthsCovered: number,
  updatedAt: string,
): TmfCommercialIndicator {
  return {
    id: `${kind}-${periodYear}`,
    kind,
    periodYear,
    monthsCovered,
    yoyPct: 0,
    note: null,
    updatedAt,
  };
}

function input(overrides: Partial<TmfDataAgeInput> = {}): TmfDataAgeInput {
  return {
    now: NOW,
    commercial: [
      indicator("order_intake", 2026, 8, "2026-10-20T08:00:00.000Z"),
      indicator("quote_activity", 2026, 8, "2026-10-20T08:00:00.000Z"),
    ],
    ssbIndicators: [
      {
        indicatorKey: "makro_hovedstorrelser",
        label: "Makroøkonomiske hovedstørrelser",
        latestPeriod: "2026M08",
      },
      {
        indicatorKey: "investering_bygg_anlegg",
        label: "Bruttoinvestering bygge- og anleggsvirksomhet",
        latestPeriod: "2025",
      },
    ],
    registrations: {
      publishDate: "2026-10-30",
      syncedAt: "2026-10-31T08:00:00.000Z",
    },
    population: {
      publishDate: "2026-10-30",
      syncedAt: "2026-10-31T08:00:00.000Z",
    },
    ...overrides,
  };
}

function warning(report: ReturnType<typeof assessTmfDataAge>, id: string) {
  return report.warnings.find((item) => item.id === id);
}

describe("expectedCommercialPeriod", () => {
  it("expects August when today is 31 October, after the 45-day grace", () => {
    assert.deepEqual(expectedCommercialPeriod(NOW), { year: 2026, month: 8 });
  });

  it("still expects November on 10 February, before December's 45-day grace ends", () => {
    assert.deepEqual(expectedCommercialPeriod(new Date("2026-02-10T00:00:00.000Z")), {
      year: 2025,
      month: 11,
    });
  });
});

describe("assessTmfDataAge", () => {
  it("is quiet when every input is within the limits", () => {
    const report = assessTmfDataAge(input());
    assert.equal(report.warnings.length, 0);
    assert.equal(report.items.find((item) => item.id === "registrations")?.ageLabel, "1 dag siden");
    assert.match(
      report.items.find((item) => item.id === "commercial:order_intake")?.detail ?? "",
      /2026, 8 av 12 måneder/,
    );
  });

  it("warns when commercial figures are older than 45 days", () => {
    const updatedAt = new Date(NOW.getTime() - (COMMERCIAL_STALE_DAYS + 1) * 86_400_000).toISOString();
    const report = assessTmfDataAge(
      input({
        commercial: [
          indicator("order_intake", 2026, 8, updatedAt),
          indicator("quote_activity", 2026, 8, "2026-10-20T08:00:00.000Z"),
        ],
      }),
    );
    const order = warning(report, "commercial:order_intake");
    assert.ok(order);
    assert.match(order.detail ?? "", /ikke oppdatert på 46 dager/);
    assert.equal(warning(report, "commercial:quote_activity"), undefined);
  });

  it("warns when recent months are missing, including when nothing is entered", () => {
    const report = assessTmfDataAge(
      input({
        commercial: [indicator("order_intake", 2026, 6, "2026-10-30T08:00:00.000Z")],
      }),
    );
    assert.match(
      warning(report, "commercial:order_intake")?.detail ?? "",
      /mangler for de siste månedene/,
    );
    assert.match(warning(report, "commercial:order_intake")?.detail ?? "", /august 2026/);
    assert.match(warning(report, "commercial:quote_activity")?.detail ?? "", /ikke ført inn/);
  });

  it("warns when registrations or population are older than a few days or missing", () => {
    const report = assessTmfDataAge(
      input({
        registrations: {
          publishDate: "2026-10-27",
          syncedAt: "2026-10-27T08:00:00.000Z",
        },
        population: { publishDate: null, syncedAt: null },
      }),
    );
    const registrations = warning(report, "registrations");
    assert.ok(registrations);
    assert.equal(registrations.ageLabel, "4 dager siden");
    assert.match(registrations.detail ?? "", new RegExp(`${OFV_DATA_STALE_DAYS} dager`));
    assert.match(warning(report, "population")?.detail ?? "", /ikke synket/);

    const onTheLimit = assessTmfDataAge(
      input({
        registrations: { publishDate: "2026-10-28", syncedAt: null },
      }),
    );
    assert.equal(warning(onTheLimit, "registrations"), undefined);
  });

  it("flags an SSB series stuck on 2024 while others reach 2025 and 2026", () => {
    const report = assessTmfDataAge(
      input({
        ssbIndicators: [
          ...input().ssbIndicators,
          {
            indicatorKey: "bygg_anlegg_omsetning",
            label: "Omsetning bygge- og anleggsvirksomhet",
            latestPeriod: "2024",
          },
        ],
      }),
    );
    const bygg = warning(report, "ssb:bygg_anlegg_omsetning");
    assert.ok(bygg);
    assert.match(bygg.detail ?? "", /2024/);
    assert.match(bygg.detail ?? "", /august 2026/);
    assert.match(bygg.detail ?? "", /12939/);
    assert.match(bygg.detail ?? "", /13430/);
    assert.equal(warning(report, "ssb:investering_bygg_anlegg"), undefined);
    assert.equal(warning(report, "ssb:makro_hovedstorrelser"), undefined);
  });

  it("flags 2024 against another annual series even without monthly data", () => {
    const report = assessTmfDataAge(
      input({
        ssbIndicators: [
          {
            indicatorKey: "bygg_anlegg_omsetning",
            label: "Omsetning bygge- og anleggsvirksomhet",
            latestPeriod: "2024",
          },
          {
            indicatorKey: "investering_bygg_anlegg",
            label: "Bruttoinvestering",
            latestPeriod: "2025",
          },
        ],
      }),
    );
    assert.ok(warning(report, "ssb:bygg_anlegg_omsetning"));
    assert.equal(warning(report, "ssb:investering_bygg_anlegg"), undefined);
  });

  it("does not flag a normal annual lag against a monthly series", () => {
    const report = assessTmfDataAge(
      input({
        ssbIndicators: [
          { indicatorKey: "annual", label: "Årstall", latestPeriod: "2025" },
          { indicatorKey: "monthly", label: "Måned", latestPeriod: "2026M08" },
        ],
      }),
    );
    assert.equal(report.warnings.length, 0);
  });

  it("flags a monthly series several months behind its peers", () => {
    const report = assessTmfDataAge(
      input({
        ssbIndicators: [
          { indicatorKey: "old", label: "Gammel måned", latestPeriod: "2026M01" },
          { indicatorKey: "new", label: "Ny måned", latestPeriod: "2026M08" },
        ],
      }),
    );
    assert.ok(warning(report, "ssb:old"));
    assert.equal(warning(report, "ssb:new"), undefined);
  });

  it("keeps construction turnover on table 12939", () => {
    const source = SSB_INDICATOR_SOURCES.find(
      (item) => item.indicatorKey === "bygg_anlegg_omsetning",
    );
    assert.equal(source?.tableId, "12939");
    assert.match(source?.stalenessNote ?? "", /ikke avviklet/);
    assert.match(source?.valuecodes.ContentsCode ?? "", /^Oms$/);
  });
});
