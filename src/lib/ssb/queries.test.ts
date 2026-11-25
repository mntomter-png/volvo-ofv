import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDriverGroups,
  formatChangePct,
  type SsbIndicatorPoint,
} from "@/lib/ssb/queries";

function point(
  overrides: Partial<SsbIndicatorPoint> &
    Pick<SsbIndicatorPoint, "indicator_key" | "period" | "value">,
): SsbIndicatorPoint {
  return {
    label: "Produksjonsindeks bygge- og anleggsvirksomhet",
    unit: "indeks (2021=100)",
    tmf_driver: "construction",
    ssb_table_id: "13430",
    synced_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDriverGroups monthly construction index", () => {
  it("computes same-month YoY and formats −0,9 % for 111,2 against 112,2", () => {
    const groups = buildDriverGroups([
      point({ indicator_key: "bygg_anlegg_produksjon", period: "2026M08", value: 98.2 }),
      point({ indicator_key: "bygg_anlegg_produksjon", period: "2025M09", value: 112.2 }),
      point({ indicator_key: "bygg_anlegg_produksjon", period: "2026M09", value: 111.2 }),
    ]);

    const construction = groups.find((group) => group.driver === "construction");
    assert.ok(construction);
    const indicator = construction.indicators.find(
      (item) => item.indicator_key === "bygg_anlegg_produksjon",
    );
    assert.ok(indicator);
    assert.equal(indicator.latestPeriod, "2026M09");
    assert.equal(indicator.latestValue, 111.2);
    assert.equal(indicator.previousValue, 112.2);
    assert.ok(indicator.changePct != null);
    const expected = ((111.2 - 112.2) / 112.2) * 100;
    assert.ok(Math.abs(indicator.changePct - expected) < 1e-9);
    assert.equal(formatChangePct(indicator.changePct), "-0.9 %");
  });

  it("drops leftover annual turnover rows so they do not enter Anlegg", () => {
    const groups = buildDriverGroups([
      point({ indicator_key: "bygg_anlegg_produksjon", period: "2026M09", value: 111.2 }),
      point({
        indicator_key: "bygg_anlegg_omsetning",
        label: "Omsetning bygge- og anleggsvirksomhet",
        period: "2024",
        value: 999,
        unit: "mill. kr",
        ssb_table_id: "12939",
      }),
    ]);

    const construction = groups.find((group) => group.driver === "construction");
    assert.ok(construction);
    assert.deepEqual(
      construction.indicators.map((item) => item.indicator_key),
      ["bygg_anlegg_produksjon"],
    );
  });
});
