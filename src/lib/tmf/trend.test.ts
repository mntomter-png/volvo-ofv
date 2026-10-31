import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSegmentTrend, computeVolvoShareTrend, toTrendInfo } from "@/lib/tmf/trend";
import { closeTo, fillSegment, marketRow } from "@/lib/tmf/model-test-helpers";

describe("computeSegmentTrend", () => {
  it("clamps a steep historical CAGR to ±10 %", () => {
    const rows = fillSegment([2023, 2024, 2025], "Construction", (year) => {
      if (year === 2023) return 100;
      if (year === 2024) return 200;
      return 400;
    });

    const trend = computeSegmentTrend(rows, "Construction", new Date(2026, 0, 15));

    assert.deepEqual(trend.yearsUsed, [2023, 2024, 2025]);
    closeTo(trend.historicalCagr, 0.1);
    assert.equal(trend.ytdMomentum, null);
    assert.equal(trend.ytdWeight, 0);
    closeTo(trend.nextYearMultiplier, 1.1);
  });

  it("blends YTD momentum into the historical CAGR once three months are complete", () => {
    const rows = [
      ...fillSegment([2023, 2024], "Distribution", () => 100),
      ...fillSegment([2025], "Distribution", (_year, month) => (month <= 6 ? 120 : 100)),
    ];
    // Juli: siste fullførte måned er juni, så YTD-vekten er 6/12 = 0,5.
    const trend = computeSegmentTrend(rows, "Distribution", new Date(2025, 6, 15));

    closeTo(trend.historicalCagr, 0);
    closeTo(trend.ytdMomentum ?? 0, 0.2);
    closeTo(trend.ytdWeight, 0.5);
    assert.equal(trend.ytdMonthsUsed, 6);
    // 20 % YTD klemmes til 10 % før blanding: 0,5 * 0 + 0,5 * 0,10.
    closeTo(trend.cagr, 0.05);
    closeTo(trend.nextYearMultiplier, 1.05);
  });

  it("ignores YTD before three complete months", () => {
    const rows = fillSegment([2023, 2024, 2025], "Long Haul", (year, month) =>
      year === 2025 && month <= 2 ? 500 : 100,
    );
    const trend = computeSegmentTrend(rows, "Long Haul", new Date(2025, 2, 10));

    assert.equal(trend.ytdMomentum, null);
    assert.equal(trend.ytdMonthsUsed, 2);
    closeTo(trend.cagr, trend.historicalCagr);
  });

  it("uses clamped YTD alone when two full years are missing", () => {
    const rows = [
      ...fillSegment([2025], "Annet", () => 10),
      ...[1, 2, 3, 4, 5, 6].map((month) => marketRow(2026, month, "Annet", 20)),
    ];
    const trend = computeSegmentTrend(rows, "Annet", new Date(2026, 6, 1));

    assert.deepEqual(trend.yearsUsed, [2025]);
    closeTo(trend.ytdMomentum ?? 0, 1);
    closeTo(trend.cagr, 0.1);
    closeTo(trend.nextYearMultiplier, 1.1);
  });

  it("is flat without history", () => {
    const trend = computeSegmentTrend([], "Construction", new Date(2026, 5, 1));
    assert.equal(trend.nextYearMultiplier, 1);
    assert.equal(trend.cagr, 0);
    assert.deepEqual(toTrendInfo(trend).yearsUsed, []);
  });
});

describe("computeVolvoShareTrend", () => {
  const reference = new Date(2026, 6, 15);

  function rows() {
    return [
      ...fillSegment([2025], "Construction", () => 10, 0.2),
      ...[1, 2, 3, 4, 5, 6].map((month) => marketRow(2026, month, "Construction", 10, 0.5)),
    ];
  }

  it("keeps the trailing share when the calibrated weight is zero", () => {
    const trend = computeVolvoShareTrend(rows(), "Construction", 30, reference, 0);
    closeTo(trend.ytdPct ?? 0, 50);
    closeTo(trend.ytdWeight, 0.5);
    assert.equal(trend.ytdMonthsUsed, 6);
    closeTo(trend.effectivePct, 30);
  });

  it("moves toward YTD by the season weight times the calibrated weight", () => {
    const full = computeVolvoShareTrend(rows(), "Construction", 30, reference, 1);
    const half = computeVolvoShareTrend(rows(), "Construction", 30, reference, 0.5);
    // 30 + 0,5 * (50 - 30) = 40, og halv vekt gir halvparten av utslaget.
    closeTo(full.effectivePct, 40);
    closeTo(half.effectivePct, 35);
  });

  it("does not use YTD in January, when no month of the new year is complete", () => {
    const trend = computeVolvoShareTrend(
      rows(),
      "Construction",
      30,
      new Date(2026, 0, 20),
      1,
    );
    assert.equal(trend.ytdPct, null);
    closeTo(trend.effectivePct, 30);
  });
});
