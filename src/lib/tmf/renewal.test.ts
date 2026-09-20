import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRenewalSignal,
  MAX_RENEWAL_EFFECT_PCT,
  NEUTRAL_RENEWAL_SIGNAL,
  RENEWAL_OVERDUE_WEIGHT,
  RENEWAL_PASS_THROUGH,
  type TmfRenewalPoolRow,
} from "@/lib/tmf/renewal";

function row(
  pabygg: string,
  stock: number,
  old: number,
  overdue = 0,
  due90 = 0,
  focusOld = 0,
): TmfRenewalPoolRow {
  return {
    pabygg,
    stockCount: stock,
    oldCount: old,
    overdueCount: overdue,
    due90Count: due90,
    focusOldCount: focusOld,
  };
}

describe("buildRenewalSignal", () => {
  it("is neutral without pool rows", () => {
    assert.deepEqual(buildRenewalSignal([], {}), NEUTRAL_RENEWAL_SIGNAL);
  });

  it("lifts segments with above-market cover and demotes the rest", () => {
    // Construction: 2000/1000 = 2 år. Distribution: 500/1000 = 0.5 år.
    // Markedssnitt: 2500/2000 = 1.25 år.
    const signal = buildRenewalSignal(
      [row("Construction", 8000, 2000), row("Distribution", 6000, 500)],
      { Construction: 1000, Distribution: 1000 },
    );

    const construction = signal.byPabygg.Construction!;
    const distribution = signal.byPabygg.Distribution!;
    assert.ok(Math.abs(signal.marketCoverYears - 1.25) < 1e-9);
    assert.ok(construction.effectPct > 0);
    assert.ok(distribution.effectPct < 0);
    // Volumvektet snitt skal ligge nær 0 (ren omfordeling).
    assert.ok(Math.abs(signal.effectPct) < 0.05);
  });

  it("counts overdue PKK at a reduced weight", () => {
    const signal = buildRenewalSignal(
      [row("Annet", 5000, 800, 400)],
      { Annet: 1000 },
    );
    const expectedPool = 800 + RENEWAL_OVERDUE_WEIGHT * 400;
    assert.ok(Math.abs(signal.byPabygg.Annet!.poolCount - expectedPool) < 1e-9);
  });

  it("stays neutral when trailing volume is missing", () => {
    const signal = buildRenewalSignal([row("Long Haul", 1000, 200)], {});
    assert.deepEqual(signal.segments, []);
    assert.equal(signal.effectPct, 0);
  });

  it("clamps extreme relative pressure", () => {
    const signal = buildRenewalSignal(
      [row("Construction", 20000, 10000), row("Distribution", 5000, 10)],
      { Construction: 500, Distribution: 2000 },
    );
    assert.equal(signal.byPabygg.Construction!.effectPct, MAX_RENEWAL_EFFECT_PCT);
    assert.equal(signal.byPabygg.Construction!.clamped, true);
    assert.ok(signal.byPabygg.Distribution!.effectPct < 0);
  });

  it("scales pass-through against relative pressure", () => {
    const signal = buildRenewalSignal(
      [row("Construction", 8000, 1400), row("Distribution", 6000, 1000)],
      { Construction: 1000, Distribution: 1000 },
    );
    const marketCover = 2400 / 2000;
    const constructionPressure = (1400 / 1000 / marketCover - 1) * 100;
    assert.ok(
      Math.abs(
        signal.byPabygg.Construction!.effectPct -
          constructionPressure * RENEWAL_PASS_THROUGH,
      ) < 1e-9,
    );
  });
});
