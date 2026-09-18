import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCommercialSignal,
  MAX_COMMERCIAL_EFFECT_PCT,
  NEUTRAL_COMMERCIAL_SIGNAL,
  ORDER_PASS_THROUGH,
  QUOTE_BLEND_WEIGHT,
  QUOTE_ONLY_PASS_THROUGH,
  type TmfCommercialIndicator,
} from "@/lib/tmf/commercial";

function indicator(
  kind: TmfCommercialIndicator["kind"],
  periodYear: number,
  yoyPct: number,
  monthsCovered = 8,
): TmfCommercialIndicator {
  return {
    id: `${kind}-${periodYear}`,
    kind,
    periodYear,
    monthsCovered,
    yoyPct,
    note: null,
    updatedAt: "2026-09-18T00:00:00.000Z",
  };
}

describe("buildCommercialSignal", () => {
  it("is neutral without indicators", () => {
    assert.deepEqual(buildCommercialSignal([], 2026), NEUTRAL_COMMERCIAL_SIGNAL);
  });

  it("applies order intake with 0.6 pass-through", () => {
    const signal = buildCommercialSignal([indicator("order_intake", 2026, 10)], 2026);
    assert.equal(signal.effectPct, 10 * ORDER_PASS_THROUGH);
    assert.equal(signal.multiplier, 1.06);
    assert.equal(signal.clamped, false);
    assert.equal(signal.periodYear, 2026);
  });

  it("uses quotes alone at the lower pass-through", () => {
    const signal = buildCommercialSignal([indicator("quote_activity", 2026, 20)], 2026);
    assert.equal(signal.effectPct, 20 * QUOTE_ONLY_PASS_THROUGH);
    assert.equal(signal.multiplier, 1.06);
  });

  it("blends order and quotes instead of adding them", () => {
    const signal = buildCommercialSignal(
      [indicator("order_intake", 2026, 10), indicator("quote_activity", 2026, 30)],
      2026,
    );
    const blended = (1 - QUOTE_BLEND_WEIGHT) * 10 + QUOTE_BLEND_WEIGHT * 30;
    assert.equal(signal.effectPct, blended * ORDER_PASS_THROUGH);
    // Adding would have been 10*0.6 + 30*0.3 = 15, which hits the cap. Blend must stay below.
    assert.ok(signal.effectPct < 15);
    assert.equal(signal.contributions.length, 2);
  });

  it("does not mix a newer order year with an older quote year", () => {
    const signal = buildCommercialSignal(
      [indicator("order_intake", 2026, 10), indicator("quote_activity", 2025, 40)],
      2026,
    );
    assert.equal(signal.periodYear, 2026);
    assert.equal(signal.contributions.length, 1);
    assert.equal(signal.contributions[0]?.kind, "order_intake");
    assert.equal(signal.effectPct, 10 * ORDER_PASS_THROUGH);
  });

  it("ignores years after the reference year", () => {
    const signal = buildCommercialSignal([indicator("order_intake", 2027, 50)], 2026);
    assert.deepEqual(signal, NEUTRAL_COMMERCIAL_SIGNAL);
  });

  it("clamps extreme values", () => {
    const signal = buildCommercialSignal([indicator("order_intake", 2026, 80)], 2026);
    assert.equal(signal.effectPct, MAX_COMMERCIAL_EFFECT_PCT);
    assert.equal(signal.clamped, true);
    assert.equal(signal.multiplier, 1.15);
  });
});
