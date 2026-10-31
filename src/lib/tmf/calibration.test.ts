import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DRIVER_WEIGHT_CANDIDATES,
  MACRO_WEIGHT_CANDIDATES,
  SHARE_WEIGHT_CANDIDATES,
  TREND_WEIGHT_CANDIDATES,
  calibrateDriverWeight,
} from "@/lib/tmf/calibration";
import { closeTo, fillSegment } from "@/lib/tmf/model-test-helpers";

const REFERENCE = new Date(2026, 0, 15);

function compoundGrowth(year: number): number {
  return 100 * Math.pow(1.1, year - 2020);
}

describe("calibrateDriverWeight", () => {
  it("searches the published weight grids", () => {
    const rows = fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Construction", (year) =>
      compoundGrowth(year),
    );
    const result = calibrateDriverWeight(rows, [], REFERENCE);

    assert.deepEqual(
      result.trendCandidates.map((candidate) => candidate.trendWeight),
      [...TREND_WEIGHT_CANDIDATES],
    );
    assert.equal(result.candidates.length, DRIVER_WEIGHT_CANDIDATES.length * MACRO_WEIGHT_CANDIDATES.length);
    assert.deepEqual(
      result.shareCandidates.map((candidate) => candidate.shareTrendWeight),
      [...SHARE_WEIGHT_CANDIDATES],
    );
    assert.equal(result.indexMin, 0.88);
    assert.equal(result.indexMax, 1.12);
  });

  it("picks the lowest market MAPE, and the first weight when they tie", () => {
    const flat = calibrateDriverWeight(
      fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Construction", () => 80),
      [],
      REFERENCE,
    );
    const growth = calibrateDriverWeight(
      fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Construction", (year) =>
        compoundGrowth(year),
      ),
      [],
      REFERENCE,
    );

    assert.equal(flat.trendWeight, 0);
    closeTo(flat.noSsbMape, 0);

    const growthMape = growth.trendCandidates.map((candidate) => candidate.mape);
    const bestMape = Math.min(...growthMape);
    const firstBest = growth.trendCandidates.find((candidate) => candidate.mape === bestMape);
    assert.equal(growth.trendWeight, firstBest?.trendWeight);
    assert.equal(growth.trendWeight, 1);
    assert.ok((growth.trendCandidates[0]?.mape ?? 0) > bestMape);
  });

  it("damps SSB weights when the signal does not beat the model without SSB", () => {
    const result = calibrateDriverWeight(
      fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Construction", (year) =>
        compoundGrowth(year),
      ),
      [],
      REFERENCE,
    );

    assert.equal(result.beatsNoSsb, false);
    // Første rute er 0,3 / 0, og den er like god som alle andre uten drivere.
    assert.equal(result.signalWeight, 0.3);
    assert.equal(result.macroWeight, 0);
    closeTo(result.mapeAtWeight, result.noSsbMape);
  });

  it("drops the Volvo share weight when the candidates barely differ", () => {
    const result = calibrateDriverWeight(
      fillSegment([2020, 2021, 2022, 2023, 2024, 2025], "Distribution", () => 50, 0.4),
      [],
      REFERENCE,
    );
    const volvos = result.shareCandidates.map((candidate) => candidate.volvoMape);
    const spread = Math.max(...volvos) - Math.min(...volvos);

    assert.ok(spread < 0.5);
    assert.equal(result.shareTrendWeight, 0);
    closeTo(result.volvoMapeAtWeight, result.volvoMapeTrailing);
    assert.match(result.note, /tynt/);
  });
});
