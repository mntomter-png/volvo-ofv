import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TmfCommercialIndicator } from "@/lib/tmf/commercial";
import { buildTmfEstimate, forecastYearAtReference } from "@/lib/tmf/model";
import { buildRenewalSignal, type TmfRenewalPoolRow } from "@/lib/tmf/renewal";
import type { TmfBacktestResult, TmfYearEstimateSegment } from "@/lib/tmf/types";
import {
  closeTo,
  EMPTY_INPUT,
  fillSegment,
  marketRow,
} from "@/lib/tmf/model-test-helpers";

const JANUARY_2026 = new Date(2026, 0, 15);

function segment(estimate: { segments: TmfYearEstimateSegment[] }, pabygg: string) {
  const found = estimate.segments.find((row) => row.pabygg === pabygg);
  assert.ok(found, pabygg);
  return found;
}

describe("seasonality", () => {
  it("lifts December and damps a normal month around the same annual total", () => {
    const rows = fillSegment(
      [2021, 2022, 2023, 2024, 2025],
      "Construction",
      (_year, month) => (month === 12 ? 40 : 10),
      0.4,
      0.25,
    );

    const forecast = forecastYearAtReference(
      rows,
      JANUARY_2026,
      2026,
      "basis",
      [],
      {},
      {},
    );
    const construction = segment(forecast, "Construction");
    const january = construction.monthly[0];
    const december = construction.monthly[11];
    assert.ok(january && december);

    // Snitt per måned over de fem hele årene: 11*10 + 40 = 150, / 12 = 12,5.
    // Desemberfaktoren er 40/12,5. Januar er 10/12,5. Året summerer til 150.
    closeTo(january.forecast, 10);
    closeTo(december.forecast, 40);
    closeTo(construction.annualMarket, 150);
    closeTo(construction.annualVolvo, 60);
    closeTo(construction.emobSharePct, 25);
    closeTo(construction.annualEmob, 37.5);
    closeTo(construction.annualIce, 112.5);
    closeTo(forecast.total.annualIce, forecast.total.annualMarket - forecast.total.annualEmob);
  });
});

describe("trend, scenario and manual adjustments", () => {
  it("scales next year's baseline by the calibrated trend weight", () => {
    const rows = fillSegment([2023, 2024, 2025], "Construction", (year) => {
      if (year === 2023) return 100;
      if (year === 2024) return 110;
      return 121;
    });

    const off = forecastYearAtReference(rows, JANUARY_2026, 2027, "basis", [], {}, {}, {
      trendWeight: 0,
    });
    const on = forecastYearAtReference(rows, JANUARY_2026, 2027, "basis", [], {}, {}, {
      trendWeight: 1,
    });

    closeTo(off.total.annualMarket, 121 * 12);
    closeTo(on.total.annualMarket, 121 * 1.1 * 12);
    assert.equal(on.trendApplied, true);
    assert.equal(off.trendApplied, false);
  });

  it("applies the scenario on top of a manual percent adjustment", () => {
    const rows = fillSegment([2021, 2022, 2023, 2024, 2025], "Construction", () => 10);
    const adjusted = buildTmfEstimate(
      rows,
      [],
      {
        ...EMPTY_INPUT,
        scenarioId: "optimistic",
        segmentAdjustments: { Construction: 10 },
      },
      JANUARY_2026,
    );
    const construction = segment(adjusted.nextYear, "Construction");
    const january = construction.monthly[0];
    assert.ok(january);

    closeTo(january.forecast, 10);
    // Optimistisk anlegg er 1,05, og +10 % analytiker er 1,10.
    closeTo(january.adjustedForecast, 11.55);
    closeTo(construction.annualMarket, 138.6);
    closeTo(construction.analystAdjustmentPct, 10);
    assert.equal(adjusted.scenarioLabel, "Optimistisk");
  });

  it("keeps a basis year at the trailing level when nothing is adjusted", () => {
    const rows = fillSegment([2021, 2022, 2023, 2024, 2025], "Construction", () => 10);
    const estimate = buildTmfEstimate(rows, [], EMPTY_INPUT, JANUARY_2026);
    closeTo(estimate.nextYear.total.annualMarket, 120);
    closeTo(estimate.scenarioEnvelope.optimisticMarket, 126);
    closeTo(estimate.scenarioEnvelope.conservativeMarket, 114);
  });
});

describe("commercial and renewal signals", () => {
  const rows = fillSegment([2021, 2022, 2023, 2024, 2025], "Construction", () => 10);

  const order: TmfCommercialIndicator = {
    id: "order-2026",
    kind: "order_intake",
    periodYear: 2026,
    monthsCovered: 6,
    yoyPct: 10,
    note: null,
    updatedAt: "2026-01-15T00:00:00.000Z",
  };

  it("lifts Volvo volume from order intake and leaves the market unchanged", () => {
    const estimate = buildTmfEstimate(
      rows,
      [],
      EMPTY_INPUT,
      JANUARY_2026,
      null,
      null,
      [order],
    );
    const construction = segment(estimate.nextYear, "Construction");

    closeTo(estimate.nextYear.total.annualMarket, 120);
    closeTo(construction.volvoShareBeforeCommercialPct, 40);
    closeTo(construction.volvoSharePct, 42.4);
    closeTo(construction.annualVolvo, 50.88);
    assert.equal(construction.volvoShareOverridden, false);
    closeTo(estimate.nextYear.commercialSignal.effectPct, 6);
  });

  it("lets a manual Volvo share replace the order signal", () => {
    const estimate = buildTmfEstimate(
      rows,
      [],
      { ...EMPTY_INPUT, volvoShareOverrides: { Construction: 25 } },
      JANUARY_2026,
      null,
      null,
      [order],
    );
    const construction = segment(estimate.nextYear, "Construction");

    assert.equal(construction.volvoShareOverridden, true);
    closeTo(construction.volvoSharePct, 25);
    closeTo(construction.annualVolvo, 30);
    closeTo(construction.annualMarket, 120);
  });

  it("moves market volume between segments and keeps the Volvo share", () => {
    const both = [
      ...fillSegment([2025], "Construction", () => 100, 0.4),
      ...fillSegment([2025], "Distribution", () => 100, 0.4),
    ];
    const pool: TmfRenewalPoolRow[] = [
      {
        pabygg: "Construction",
        stockCount: 8000,
        oldCount: 2400,
        overdueCount: 0,
        due90Count: 0,
        focusOldCount: 0,
      },
      {
        pabygg: "Distribution",
        stockCount: 6000,
        oldCount: 600,
        overdueCount: 0,
        due90Count: 0,
        focusOldCount: 0,
      },
    ];
    const signal = buildRenewalSignal(pool, { Construction: 1200, Distribution: 1200 });
    const estimate = buildTmfEstimate(
      both,
      [],
      EMPTY_INPUT,
      JANUARY_2026,
      null,
      null,
      [],
      pool,
    );

    const construction = segment(estimate.nextYear, "Construction");
    const distribution = segment(estimate.nextYear, "Distribution");
    closeTo(construction.renewalMultiplier, signal.byPabygg.Construction?.multiplier ?? 0);
    closeTo(distribution.renewalMultiplier, signal.byPabygg.Distribution?.multiplier ?? 0);
    assert.ok(construction.annualMarket > 1200);
    assert.ok(distribution.annualMarket < 1200);
    closeTo(construction.volvoSharePct, 40);
    closeTo(distribution.volvoSharePct, 40);
    // Signalet omfordeler. Totalen skal ikke flytte seg mer enn pass-through-støyen.
    closeTo(estimate.nextYear.total.annualMarket, 2400, 2400 * 0.01);
  });

  it("blends a higher YTD Volvo share when the share weight is on", () => {
    const history = [
      ...fillSegment([2024, 2025], "Construction", () => 10, 0.2),
      ...[1, 2, 3, 4, 5, 6, 7].map((month) => marketRow(2026, month, "Construction", 10, 0.8)),
    ];
    const reference = new Date(2026, 7, 15);
    const trailing = forecastYearAtReference(history, reference, 2027, "basis", [], {}, {}, {
      shareTrendWeight: 0,
    });
    const blended = forecastYearAtReference(history, reference, 2027, "basis", [], {}, {}, {
      shareTrendWeight: 1,
    });

    closeTo(trailing.total.volvoSharePct, 55);
    closeTo(blended.total.volvoSharePct, 55 + (7 / 12) * (80 - 55));
    closeTo(trailing.total.annualMarket, blended.total.annualMarket);
  });
});

describe("uncertainty bands", () => {
  function shippedBacktest(
    marketDown: number,
    marketUp: number,
    volvoDown: number,
    volvoUp: number,
    segmentDown = marketDown,
    segmentUp = marketUp,
  ): TmfBacktestResult {
    return {
      models: [
        {
          modelId: "full_trend",
          modelLabel: "Levert modell",
          description: "test",
          years: [],
          mapeTotal: 11,
          biasPct: 0,
          downsidePct: marketDown,
          upsidePct: marketUp,
          volvoMapeTotal: 14,
          volvoBiasPct: 0,
          volvoDownsidePct: volvoDown,
          volvoUpsidePct: volvoUp,
          mapeBySegment: {
            "Long Haul": {
              label: "Langtransport",
              mape: 11,
              observations: 4,
              downsidePct: segmentDown,
              upsidePct: segmentUp,
            },
          },
        },
      ],
      driverCorrelations: [],
      firstBacktestYear: 2022,
      lastBacktestYear: 2025,
      asOfMonth: 1,
      shippedModelId: "full_trend",
      notes: [],
    };
  }

  const rows = fillSegment([2021, 2022, 2023, 2024, 2025], "Long Haul", () => 100);

  it("uses the shipped model's asymmetric widths and the 5 % floor", () => {
    const wide = buildTmfEstimate(
      rows,
      [],
      EMPTY_INPUT,
      JANUARY_2026,
      shippedBacktest(20, 8, 30, 12),
    );
    closeTo(wide.nextYear.total.annualMarket, 1200);
    closeTo(wide.confidence.market.p50, 1200);
    closeTo(wide.confidence.market.p10, 960);
    closeTo(wide.confidence.market.p90, 1296);
    closeTo(wide.confidence.volvo.p50, 480);
    closeTo(wide.confidence.volvo.p10, 336);
    closeTo(wide.confidence.volvo.p90, 537.6);
    assert.equal(wide.confidence.mapeUsed, 11);
    assert.equal(wide.confidence.modelLabel, "Levert modell");

    const narrow = buildTmfEstimate(
      rows,
      [],
      EMPTY_INPUT,
      JANUARY_2026,
      shippedBacktest(1, 1, 1, 1),
    );
    // Langtransport-scenariet er bare ±3 %. Gulvet på 5 % er bredere enn det.
    closeTo(narrow.confidence.market.p10, 1140);
    closeTo(narrow.confidence.market.p90, 1260);
  });

  it("keeps segment Volvo bands on the market half-width", () => {
    const estimate = buildTmfEstimate(
      rows,
      [],
      EMPTY_INPUT,
      JANUARY_2026,
      shippedBacktest(20, 8, 30, 12, 1, 1),
    );
    const band = estimate.confidence.segments.find((row) => row.pabygg === "Long Haul");
    assert.ok(band);
    assert.equal(band.observations, 4);
    // Segmentet har egen 1 %-feil, som heves til gulvet på 5 %.
    // Totalens Volvo-bånd bruker 30 %, men segmentets Volvo-bånd gjør ikke det.
    closeTo(band.market.p10, 1200 * 0.95);
    closeTo(band.volvo.p10, 480 * 0.95);
    closeTo(estimate.confidence.volvo.p10, 480 * 0.7);
  });
});

describe("current-year landing", () => {
  it("uses actuals through the last complete month and forecasts the rest", () => {
    const rows = [
      ...fillSegment([2024, 2025], "Construction", () => 10),
      ...[1, 2, 3, 4, 5].map((month) => marketRow(2026, month, "Construction", 20)),
    ];
    const estimate = buildTmfEstimate(rows, [], EMPTY_INPUT, new Date(2026, 5, 15));
    const july = estimate.currentYear.total.monthly[6];
    const january = estimate.currentYear.total.monthly[0];
    assert.ok(july && january);

    assert.equal(january.actual, 20);
    assert.equal(july.actual, null);
    assert.equal(estimate.currentYear.total.landingActualMonths, 5);
    assert.equal(estimate.currentYear.total.ytdActual, 100);
    // Trailing jun 2025–mai 2026 = 7*10 + 5*20 = 170. Resten av året er 7/12 av det.
    closeTo(estimate.currentYear.total.annualLandingEstimate, 100 + (7 * 170) / 12);
  });
});
