import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runTmfBacktest } from "@/lib/tmf/backtest";
import { forecastYearAtReference } from "@/lib/tmf/model";
import type { SsbIndicatorPoint } from "@/lib/ssb/queries";
import { closeTo, fillSegment } from "@/lib/tmf/model-test-helpers";

const REFERENCE = new Date(2026, 0, 15);
const WEIGHTS = { trendWeight: 0, shareTrendWeight: 0 };

function coreBacktest(countFor: (year: number, month: number) => number) {
  const rows = fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Construction", countFor);
  return runTmfBacktest(rows, [], [], REFERENCE, undefined, WEIGHTS);
}

describe("runTmfBacktest MAPE", () => {
  it("is zero when every later year repeats the baseline", () => {
    const result = coreBacktest(() => 100);
    const core = result.models.find((model) => model.modelId === "core");
    assert.ok(core);
    assert.equal(result.asOfMonth, 1);
    assert.equal(result.firstBacktestYear, 2022);
    assert.equal(result.lastBacktestYear, 2025);
    assert.equal(result.shippedModelId, "full_trend");
    closeTo(core.mapeTotal, 0);
    closeTo(core.volvoMapeTotal, 0);
    closeTo(core.biasPct, 0);
    assert.equal(core.years.length, 4);
  });

  it("averages absolute percent error and splits over- and underestimates", () => {
    // Januar-kjøring: prognosen for år Y er kalenderåret Y−2.
    // 2022/23 ble undervurdert (1200 mot 2160). 2024/25 ble overvurdert (2160 mot 1800).
    const result = coreBacktest((year) => {
      if (year <= 2021) return 100;
      if (year <= 2023) return 180;
      return 150;
    });
    const core = result.models.find((model) => model.modelId === "core");
    assert.ok(core);

    const year2022 = core.years.find((year) => year.year === 2022);
    const year2024 = core.years.find((year) => year.year === 2024);
    assert.ok(year2022 && year2024);

    closeTo(year2022.forecastTotal, 1200);
    closeTo(year2022.actualTotal, 2160);
    closeTo(year2022.errorPct, 400 / 9);
    closeTo(year2022.volvoErrorPct, 400 / 9);
    closeTo(year2024.forecastTotal, 2160);
    closeTo(year2024.actualTotal, 1800);
    closeTo(year2024.errorPct, -20);

    closeTo(core.mapeTotal, 290 / 9);
    closeTo(core.volvoMapeTotal, 290 / 9);
    closeTo(core.downsidePct, 20);
    closeTo(core.upsidePct, 400 / 9);

    const construction = year2022.segments.find((row) => row.pabygg === "Construction");
    assert.ok(construction);
    closeTo(construction.absErrorPct, 400 / 9);
    closeTo(core.mapeBySegment.Construction?.mape ?? 0, 290 / 9);
    assert.equal(core.mapeBySegment.Construction?.observations, 4);
  });

  it("matches a direct forecast for the same as-of month", () => {
    const rows = fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Long Haul", (year) =>
      year < 2023 ? 80 : 50,
    );
    const result = runTmfBacktest(rows, [], [], REFERENCE, undefined, WEIGHTS);
    const core = result.models.find((model) => model.modelId === "core");
    assert.ok(core);
    const year = core.years.find((row) => row.year === 2024);
    assert.ok(year);
    const direct = forecastYearAtReference(
      rows,
      new Date(2023, 0, 1),
      2024,
      "basis",
      [],
      {},
      {},
      WEIGHTS,
    );
    closeTo(year.forecastTotal, direct.total.annualMarket);
    closeTo(year.volvoForecastTotal, direct.total.annualVolvo);
    closeTo(year.errorPct, ((year.actualTotal - year.forecastTotal) / year.actualTotal) * 100);
  });

  it("says so when there are not enough years", () => {
    const rows = fillSegment([2024], "Construction", () => 10);
    const result = runTmfBacktest(rows, [], [], new Date(2025, 5, 1));
    assert.equal(result.models.length, 0);
    assert.ok(result.notes.some((note) => note.includes("Utilstrekkelig historikk")));
  });
});

describe("driver correlations", () => {
  it("correlates registration growth with the SSB series for that driver", () => {
    const rows = fillSegment([2021, 2022, 2023, 2024], "Construction", (year) => 100 + (year - 2021) * 10);
    const points: SsbIndicatorPoint[] = [2021, 2022, 2023, 2024].map((year) => ({
      indicator_key: "bygg_anlegg_omsetning",
      label: "Omsetning",
      period: String(year),
      value: 50 + (year - 2021) * 5,
      unit: "mill. kr",
      tmf_driver: "construction",
      ssb_table_id: "12939",
      synced_at: "2026-01-01T00:00:00.000Z",
    }));

    const result = runTmfBacktest(rows, [], points, REFERENCE, undefined, WEIGHTS);
    const construction = result.driverCorrelations.find((row) => row.driver === "construction");
    assert.ok(construction);
    assert.equal(construction.observations, 3);
    closeTo(construction.correlation ?? 0, 1);
  });
});
